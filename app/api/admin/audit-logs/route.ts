import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { handleAdminApiError } from "@/lib/api-helpers";
import { AuditLogRecord } from "@/lib/types";

export async function GET() {
  try {
    await requireAdmin();
    const sql = getSql();
    const logs = (await sql`
      SELECT *
      FROM audit_logs
      ORDER BY timestamp DESC
      LIMIT 100
    `) as unknown as AuditLogRecord[];

    return NextResponse.json({ logs });
  } catch (err) {
    return handleAdminApiError(err);
  }
}
