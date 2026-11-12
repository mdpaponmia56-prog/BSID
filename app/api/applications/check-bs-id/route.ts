import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { normalizeBsId } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("bs_id") || "";
    const normalized = normalizeBsId(raw);
    if (!normalized) {
      return NextResponse.json({ exists: false });
    }

    const sql = getSql();
    const rows = (await sql`
      SELECT 1 FROM applications WHERE UPPER(TRIM(bs_id)) = ${normalized} LIMIT 1
    `) as Array<{ "?column?": number }>;

    return NextResponse.json({ exists: rows.length > 0 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to verify BS ID" },
      { status: 500 }
    );
  }
}
