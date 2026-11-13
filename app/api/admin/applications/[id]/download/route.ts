import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { requireAdmin } from "@/lib/auth";
import { getSql, getStoredFile } from "@/lib/db";
import { handleAdminApiError } from "@/lib/api-helpers";
import { generateAndSaveApplicationCards } from "@/lib/card-service";
import { ApplicationRecord } from "@/lib/types";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const format = req.nextUrl.searchParams.get("format") || "pdf";
    const sql = getSql();

    const rows = (await sql`
      SELECT * FROM applications WHERE id = ${id}::uuid LIMIT 1
    `) as unknown as ApplicationRecord[];

    let app = rows[0];
    if (!app) {
      return NextResponse.json(
        { error: "Application not found." },
        { status: 404 }
      );
    }

    const force =
      req.nextUrl.searchParams.get("force") === "1" ||
      req.nextUrl.searchParams.get("regenerate") === "1" ||
      req.nextUrl.searchParams.get("fresh") === "1";

    // Ensure generated files exist before download or regenerate if forced
    if (
      force ||
      !app.generated_card_front_file_id ||
      !app.generated_card_back_file_id ||
      !app.generated_card_pdf_file_id
    ) {
      app = await generateAndSaveApplicationCards({
        applicationId: app.id,
        adminId: admin.id,
        adminEmail: admin.email,
        actionType: force ? "ID_CARD_FORCE_REGENERATED" : undefined,
      });
    }

    const safeBsId = app.bs_id.replace(/[^A-Za-z0-9_-]/g, "_");

    if (format === "front_png") {
      const f = await getStoredFile(app.generated_card_front_file_id!);
      if (!f) throw new Error("Generated front PNG not found.");
      return new NextResponse(new Uint8Array(f.data), {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="BS-ID-${safeBsId}.png"`,
        },
      });
    }

    if (format === "back_png") {
      const f = await getStoredFile(app.generated_card_back_file_id!);
      if (!f) throw new Error("Generated back PNG not found.");
      return new NextResponse(new Uint8Array(f.data), {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="BS-ID-${safeBsId}-back.png"`,
        },
      });
    }

    if (format === "zip") {
      const [front, back, pdf] = await Promise.all([
        getStoredFile(app.generated_card_front_file_id!),
        getStoredFile(app.generated_card_back_file_id!),
        getStoredFile(app.generated_card_pdf_file_id!),
      ]);
      const zip = new JSZip();
      if (front) zip.file(`BS-ID-${safeBsId}-front.png`, front.data);
      if (back) zip.file(`BS-ID-${safeBsId}-back.png`, back.data);
      if (pdf) zip.file(`BS-ID-${safeBsId}.pdf`, pdf.data);
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      return new NextResponse(new Uint8Array(zipBuffer), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="BS-ID-${safeBsId}.zip"`,
        },
      });
    }

    // Default: PDF
    const pdf = await getStoredFile(app.generated_card_pdf_file_id!);
    if (!pdf) throw new Error("Generated PDF not found.");
    return new NextResponse(new Uint8Array(pdf.data), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="BS-ID-${safeBsId}.pdf"`,
      },
    });
  } catch (err) {
    return handleAdminApiError(err);
  }
}
