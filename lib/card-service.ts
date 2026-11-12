import fs from "fs/promises";
import path from "path";
import {
  ensureDefaultTemplateSeeded,
  getSql,
  getStoredFile,
  logAudit,
  storeFile,
} from "./db";
import { generateFullIdCardSet } from "./card-renderer";
import { ApplicationRecord, IdCardTemplateRecord } from "./types";

let defaultFrontBuf: Buffer | null = null;
let defaultBackBuf: Buffer | null = null;

async function getTemplateBuffers(template: IdCardTemplateRecord): Promise<{
  front: Buffer;
  back: Buffer;
}> {
  // Ultra-fast path: read from local memory/disk cache for default template
  if (
    template.template_name.includes("Original Canva") ||
    !template.front_background_file_id ||
    !template.back_background_file_id
  ) {
    if (!defaultFrontBuf || !defaultBackBuf) {
      const [f, b] = await Promise.all([
        fs
          .readFile(
            path.join(process.cwd(), "public", "templates", "template-front-default.png")
          )
          .catch(() =>
            fs.readFile(
              path.join(process.cwd(), "assets", "templates", "template-front-default.png")
            )
          ),
        fs
          .readFile(
            path.join(process.cwd(), "public", "templates", "template-back-default.png")
          )
          .catch(() =>
            fs.readFile(
              path.join(process.cwd(), "assets", "templates", "template-back-default.png")
            )
          ),
      ]);
      defaultFrontBuf = f;
      defaultBackBuf = b;
    }
    return { front: defaultFrontBuf, back: defaultBackBuf };
  }

  const [frontBgFile, backBgFile] = await Promise.all([
    getStoredFile(template.front_background_file_id),
    getStoredFile(template.back_background_file_id),
  ]);

  if (!frontBgFile || !backBgFile) {
    throw new Error("Template background files could not be loaded from storage.");
  }

  return { front: frontBgFile.data, back: backBgFile.data };
}

export async function generateAndSaveApplicationCards(params: {
  applicationId: string;
  adminId: string | null;
  adminEmail: string;
  templateOverride?: IdCardTemplateRecord;
  actionType?: string;
}): Promise<ApplicationRecord> {
  const sql = getSql();
  const appRows = (await sql`
    SELECT * FROM applications WHERE id = ${params.applicationId}::uuid LIMIT 1
  `) as unknown as ApplicationRecord[];

  const app = appRows[0];
  if (!app) {
    throw new Error("Application not found.");
  }

  if (!app.photograph_file_id) {
    throw new Error("Applicant photograph file is missing.");
  }

  const [template, photoFile] = await Promise.all([
    params.templateOverride ?? ensureDefaultTemplateSeeded(),
    getStoredFile(app.photograph_file_id),
  ]);

  if (!photoFile) {
    throw new Error("Applicant photograph could not be loaded from storage.");
  }

  const { front: frontBgBuffer, back: backBgBuffer } = await getTemplateBuffers(
    template
  );

  const { frontPng, backPng, pdfBuffer } = await generateFullIdCardSet({
    application: app,
    template,
    frontBackgroundBuffer: frontBgBuffer,
    backBackgroundBuffer: backBgBuffer,
    photoBuffer: photoFile.data,
  });

  const safeBsId = app.bs_id.replace(/[^A-Za-z0-9_-]/g, "_");
  const [frontStored, backStored, pdfStored] = await Promise.all([
    storeFile({
      fileName: `BS-ID-${safeBsId}-front.png`,
      mimeType: "image/png",
      category: "card_front",
      isPublic: false,
      data: frontPng,
    }),
    storeFile({
      fileName: `BS-ID-${safeBsId}-back.png`,
      mimeType: "image/png",
      category: "card_back",
      isPublic: false,
      data: backPng,
    }),
    storeFile({
      fileName: `BS-ID-${safeBsId}.pdf`,
      mimeType: "application/pdf",
      category: "card_pdf",
      isPublic: false,
      data: pdfBuffer,
    }),
  ]);

  const updatedRows = (await sql`
    UPDATE applications
    SET
      generated_card_front_url = ${frontStored.url},
      generated_card_back_url = ${backStored.url},
      generated_card_pdf_url = ${pdfStored.url},
      generated_card_front_file_id = ${frontStored.id}::uuid,
      generated_card_back_file_id = ${backStored.id}::uuid,
      generated_card_pdf_file_id = ${pdfStored.id}::uuid,
      template_id = ${template.id}::uuid,
      updated_date = NOW()
    WHERE id = ${app.id}::uuid
    RETURNING *
  `) as unknown as ApplicationRecord[];

  const updated = updatedRows[0];

  await logAudit({
    administratorId: params.adminId,
    administratorEmail: params.adminEmail,
    applicationId: app.id,
    actionType:
      params.actionType ||
      (app.generated_card_front_file_id
        ? "ID_CARD_REGENERATED"
        : "ID_CARD_GENERATED"),
    previousValues: {
      generated_card_front_url: app.generated_card_front_url,
      generated_card_back_url: app.generated_card_back_url,
    },
    updatedValues: {
      generated_card_front_url: updated.generated_card_front_url,
      generated_card_back_url: updated.generated_card_back_url,
      generated_card_pdf_url: updated.generated_card_pdf_url,
      template_id: template.id,
    },
  });

  return updated;
}
