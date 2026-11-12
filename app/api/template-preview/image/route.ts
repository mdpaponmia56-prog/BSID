import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { ensureDefaultTemplateSeeded, getStoredFile } from "@/lib/db";

const imageMemoryCache = new Map<string, Buffer>();

async function getLocalTemplateBuffer(filename: string): Promise<Buffer | null> {
  const cached = imageMemoryCache.get(filename);
  if (cached) return cached;

  const publicPath = path.join(process.cwd(), "public", "templates", filename);
  try {
    const buf = await fs.readFile(publicPath);
    imageMemoryCache.set(filename, buf);
    return buf;
  } catch {
    const assetsPath = path.join(process.cwd(), "assets", "templates", filename);
    try {
      const buf = await fs.readFile(assetsPath);
      imageMemoryCache.set(filename, buf);
      return buf;
    } catch {
      return null;
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const side = req.nextUrl.searchParams.get("side") || "front";

    if (side === "qr-seal") {
      const buf = await getLocalTemplateBuffer("qr-center-seal.png");
      if (buf) {
        return new NextResponse(new Uint8Array(buf), {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          },
        });
      }
    }

    if (side !== "front" && side !== "back") {
      return NextResponse.json({ error: "Invalid side." }, { status: 400 });
    }

    // Fast path: serve default background directly from memory/disk in 0-1ms
    const defaultFileName =
      side === "front"
        ? "template-front-default.png"
        : "template-back-default.png";
    const localBuf = await getLocalTemplateBuffer(defaultFileName);
    if (localBuf) {
      return new NextResponse(new Uint8Array(localBuf), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }

    // Fallback for custom uploaded background
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
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
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
