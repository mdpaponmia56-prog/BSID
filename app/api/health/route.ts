import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export async function GET() {
  try {
    const sql = getSql();
    const rows = (await sql`SELECT current_database() AS db, NOW() AS now`) as Array<{
      db: string;
      now: string;
    }>;
    return NextResponse.json({
      ok: true,
      database: rows[0]?.db ?? "BS ID",
      timestamp: rows[0]?.now ?? new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "DB error" },
      { status: 500 }
    );
  }
}
