import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getStoredFile } from "@/lib/db";
import { handleAdminApiError } from "@/lib/api-helpers";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: "Invalid file ID." }, { status: 400 });
    }

    const file = await getStoredFile(id);
    if (!file) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    const download = req.nextUrl.searchParams.get("download") === "1";
    const customName = req.nextUrl.searchParams.get("filename");
    const safeName = (customName || file.file_name).replace(/["\r\n]/g, "");

    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch === `"${id}"`) {
      return new NextResponse(null, { status: 304 });
    }

    return new NextResponse(new Uint8Array(file.data), {
      status: 200,
      headers: {
        "Content-Type": file.mime_type,
        "Content-Length": String(file.data.byteLength),
        "Cache-Control": "private, max-age=86400, immutable",
        "ETag": `"${id}"`,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}"`,
      },
    });
  } catch (err) {
    return handleAdminApiError(err);
  }
}
