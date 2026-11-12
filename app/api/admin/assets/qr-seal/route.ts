import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireAdmin } from "@/lib/auth";
import { handleAdminApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    await requireAdmin();
    const sealPath = path.join(
      process.cwd(),
      "assets",
      "templates",
      "qr-center-seal.png"
    );
    const buf = await fs.readFile(sealPath);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return handleAdminApiError(err);
  }
}
