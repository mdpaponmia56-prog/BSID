import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { ensureDefaultTemplateSeeded, getStoredFile } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const side = req.nextUrl.searchParams.get("side") || "front";

    if (side === "qr-seal") {
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
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    if (side !== "front" && side !== "back") {
      return NextResponse.json({ error: "Invalid side." }, { status: 400 });
    }

    const template = await ensureDefaultTemplateSeeded();
    const fileId =
      side === "front"
        ? template.front_background_file_id
        : template.back_background_file_id;

    if (!fileId) {
      return NextResponse.json(
        { error: "Template background not found." },
        { status: 404 }
      );
    }

    const file = await getStoredFile(fileId);
    if (!file) {
      return NextResponse.json(
        { error: "Template image not found." },
        { status: 404 }
      );
    }

    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.mime_type,
        "Cache-Control": "public, max-age=120",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load template image.",
      },
      { status: 500 }
    );
  }
}
