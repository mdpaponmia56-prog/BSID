import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ensureDefaultTemplateSeeded, getSql } from "@/lib/db";
import { handleAdminApiError } from "@/lib/api-helpers";
import { ApplicationRecord } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const sql = getSql();

    const statusParam = req.nextUrl.searchParams.get("status") || "all";
    const searchParam = (req.nextUrl.searchParams.get("search") || "").trim();
    const bloodGroupParam = req.nextUrl.searchParams.get("blood_group") || "all";
    const sortParam = req.nextUrl.searchParams.get("sort") || "newest";

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (["Pending", "Approved", "Rejected"].includes(statusParam)) {
      values.push(statusParam);
      conditions.push(`application_status = $${values.length}`);
    }

    if (bloodGroupParam && bloodGroupParam !== "all") {
      values.push(bloodGroupParam);
      conditions.push(`blood_group = $${values.length}`);
    }

    if (searchParam) {
      values.push(`%${searchParam}%`);
      const p = `$${values.length}`;
      conditions.push(
        `(full_name ILIKE ${p} OR bs_id ILIKE ${p} OR application_reference ILIKE ${p} OR email ILIKE ${p} OR contact_number ILIKE ${p})`
      );
    }

    const whereSql =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    let orderSql = "ORDER BY submission_date DESC";
    if (sortParam === "oldest") orderSql = "ORDER BY submission_date ASC";
    else if (sortParam === "name_asc") orderSql = "ORDER BY full_name ASC";
    else if (sortParam === "name_desc") orderSql = "ORDER BY full_name DESC";
    else if (sortParam === "bs_id") orderSql = "ORDER BY bs_id ASC";

    const queryText = `
      SELECT *
      FROM applications
      ${whereSql}
      ${orderSql}
    `;

    const [applications, statsRows] = (await Promise.all([
      sql.query(queryText, values),
      sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE application_status = 'Pending')::int AS pending,
          COUNT(*) FILTER (WHERE application_status = 'Approved')::int AS approved,
          COUNT(*) FILTER (WHERE application_status = 'Rejected')::int AS rejected,
          COUNT(*) FILTER (WHERE generated_card_front_file_id IS NOT NULL)::int AS generated_cards
        FROM applications
      `,
    ])) as unknown as [
      ApplicationRecord[],
      Array<{
        total: number;
        pending: number;
        approved: number;
        rejected: number;
        generated_cards: number;
      }>
    ];

    return NextResponse.json({
      applications,
      stats: statsRows[0] ?? {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        generated_cards: 0,
      },
    });
  } catch (err) {
    return handleAdminApiError(err);
  }
}
