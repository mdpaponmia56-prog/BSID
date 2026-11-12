import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { requireAdmin } from "@/lib/auth";
import { getSql, getStoredFile, logAudit } from "@/lib/db";
import { handleAdminApiError } from "@/lib/api-helpers";
import { generateAndSaveApplicationCards } from "@/lib/card-service";
import { ApplicationRecord } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = (await req.json()) as {
      ids?: string[];
      format?: "all" | "png" | "pdf";
    };

    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
    const format = body.format || "all";

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Select at least one application for bulk download." },
        { status: 400 }
      );
    }

    const sql = getSql();
    const zip = new JSZip();

    for (const id of ids) {
      const rows = (await sql`
        SELECT * FROM applications WHERE id = ${id}::uuid LIMIT 1
      `) as unknown as ApplicationRecord[];

      let app = rows[0];
      if (!app) continue;

      if (
        !app.generated_card_front_file_id ||
        !app.generated_card_back_file_id ||
        !app.generated_card_pdf_file_id
      ) {
        app = await generateAndSaveApplicationCards({
          applicationId: app.id,
          adminId: admin.id,
          adminEmail: admin.email,
        });
      }

      const safeBsId = app.bs_id.replace(/[^A-Za-z0-9_-]/g, "_");

      if (format === "all" || format === "png") {
        const [front, back] = await Promise.all([
          app.generated_card_front_file_id
            ? getStoredFile(app.generated_card_front_file_id)
            : null,
          app.generated_card_back_file_id
            ? getStoredFile(app.generated_card_back_file_id)
            : null,
        ]);
        if (front) zip.file(`BS-ID-${safeBsId}-front.png`, front.data);
        if (back) zip.file(`BS-ID-${safeBsId}-back.png`, back.data);
      }

      if (format === "all" || format === "pdf") {
        const pdf = app.generated_card_pdf_file_id
          ? await getStoredFile(app.generated_card_pdf_file_id)
          : null;
        if (pdf) zip.file(`BS-ID-${safeBsId}.pdf`, pdf.data);
      }
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    await logAudit({
      administratorId: admin.id,
      administratorEmail: admin.email,
      applicationId: null,
      actionType: "BULK_DOWNLOAD",
      previousValues: null,
      updatedValues: { count: ids.length, format, ids },
    });

    const dateSlug = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="BS-ID-Cards-${dateSlug}.zip"`,
      },
    });
  } catch (err) {
    return handleAdminApiError(err);
  }
}
