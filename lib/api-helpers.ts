import { NextResponse } from "next/server";
import { AdminAuthError } from "./auth";

export function handleAdminApiError(err: unknown) {
  if (err instanceof AdminAuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message =
    err instanceof Error ? err.message : "An unexpected server error occurred.";
  return NextResponse.json({ error: message }, { status: 500 });
}
