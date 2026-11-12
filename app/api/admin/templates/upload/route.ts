import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { requireAdmin } from "@/lib/auth";
import {
  ensureDefaultTemplateSeeded,
  getSql,
  invalidateTemplateCache,
  logAudit,
  storeFile,
} from "@/lib/db";
import { handleAdminApiError } from "@/lib/api-helpers";
import { IdCardTemplateRecord, TemplateVersionRecord } from "@/lib/types";

const execFileAsync = promisify(execFile);

async function convertUploadToPng(
  file: File
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const rawBuf = Buffer.from(await file.arrayBuffer());
  const isPdf =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    // Attempt macOS sips conversion for PDF page 1
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bsid-pdf-"));
    const pdfPath = path.join(tmpDir, "upload.pdf");
    const pngPath = path.join(tmpDir, "upload.png");
    try {
      await fs.writeFile(pdfPath, rawBuf);
      await execFileAsync("sips", ["-s", "format", "png", pdfPath, "--out", pngPath]);
      const pngBuf = await fs.readFile(pngPath);
      const meta = await sharp(pngBuf).metadata();
      return {
        buffer: pngBuf,
        width: meta.width || 591,
        height: meta.height || 1004,
      };
    } catch {
      throw new Error(
        "PDF background conversion is unavailable in this runtime. Please export your Canva design as high-resolution PNG or JPG."
      );
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  const meta = await sharp(rawBuf).metadata();
  if (!meta.format || !["png", "jpeg", "webp"].includes(meta.format)) {
    throw new Error("Please upload a valid PNG, JPG, JPEG, or PDF template file.");
  }

  const pngBuf = await sharp(rawBuf).png().toBuffer();
  return {
    buffer: pngBuf,
    width: meta.width || 591,
    height: meta.height || 1004,
  };
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const formData = await req.formData();
    const side = String(formData.get("side") || "front");
    const file = formData.get("file");

    if (side !== "front" && side !== "back") {
      return NextResponse.json(
        { error: 'Side must be "front" or "back".' },
        { status: 400 }
      );
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Please select a PNG, JPG, or PDF file." },
        { status: 400 }
      );
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Template background cannot exceed 15 MB." },
        { status: 400 }
      );
    }

    const converted = await convertUploadToPng(file);
    const current = await ensureDefaultTemplateSeeded();

    const stored = await storeFile({
      fileName: `template-${side}-${Date.now()}.png`,
      mimeType: "image/png",
      category: side === "front" ? "template_front" : "template_back",
      isPublic: false,
      data: converted.buffer,
    });

    const sql = getSql();
    const nextVersion = current.version_number + 1;

    const updatedRows = (await sql`
      UPDATE id_card_templates
      SET
        front_background_url = ${
          side === "front" ? stored.url : current.front_background_url
        },
        front_background_file_id = ${
          side === "front" ? stored.id : current.front_background_file_id
        }::uuid,
        back_background_url = ${
          side === "back" ? stored.url : current.back_background_url
        },
        back_background_file_id = ${
          side === "back" ? stored.id : current.back_background_file_id
        }::uuid,
        version_number = ${nextVersion},
        updated_date = NOW()
      WHERE id = ${current.id}::uuid
      RETURNING *
    `) as unknown as IdCardTemplateRecord[];

    const updated = updatedRows[0];

    await sql`
      INSERT INTO template_versions (
        template_id,
        version_number,
        template_name,
        front_background_url,
        back_background_url,
        front_background_file_id,
        back_background_file_id,
        card_width,
        card_height,
        text_position_configuration,
        image_position_configuration,
        typography_configuration,
        saved_by_email
      )
      VALUES (
        ${updated.id}::uuid,
        ${updated.version_number},
        ${updated.template_name},
        ${updated.front_background_url},
        ${updated.back_background_url},
        ${updated.front_background_file_id}::uuid,
        ${updated.back_background_file_id}::uuid,
        ${updated.card_width},
        ${updated.card_height},
        ${JSON.stringify(updated.text_position_configuration)}::jsonb,
        ${JSON.stringify(updated.image_position_configuration)}::jsonb,
        ${JSON.stringify(updated.typography_configuration)}::jsonb,
        ${admin.email}
      )
    `;

    await logAudit({
      administratorId: admin.id,
      administratorEmail: admin.email,
      applicationId: null,
      actionType: `TEMPLATE_${side.toUpperCase()}_BACKGROUND_REPLACED`,
      previousValues: {
        url:
          side === "front"
            ? current.front_background_url
            : current.back_background_url,
      },
      updatedValues: {
        url: stored.url,
        uploadedWidth: converted.width,
        uploadedHeight: converted.height,
        version_number: updated.version_number,
      },
    });

    const versions = (await sql`
      SELECT *
      FROM template_versions
      WHERE template_id = ${updated.id}::uuid
      ORDER BY version_number DESC
      LIMIT 30
    `) as unknown as TemplateVersionRecord[];

    invalidateTemplateCache();
    return NextResponse.json({ template: updated, versions });
  } catch (err) {
    return handleAdminApiError(err);
  }
}
