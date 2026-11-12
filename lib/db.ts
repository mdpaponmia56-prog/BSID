import { neon, Pool } from "@neondatabase/serverless";
import fs from "fs/promises";
import path from "path";
import {
  DEFAULT_IMAGE_POSITION_CONFIG,
  DEFAULT_TEXT_POSITION_CONFIG,
  DEFAULT_TYPOGRAPHY_CONFIG,
  IdCardTemplateRecord,
} from "./types";

let cachedSql: ReturnType<typeof neon> | null = null;
let cachedPool: Pool | null = null;

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not configured.");
  }
  if (!cachedSql) {
    cachedSql = neon(url);
  }
  return cachedSql;
}

export function getPool() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not configured.");
  }
  if (!cachedPool) {
    cachedPool = new Pool({ connectionString: url });
  }
  return cachedPool;
}

export async function storeFile(params: {
  fileName: string;
  mimeType: string;
  category:
    | "photograph"
    | "card_front"
    | "card_back"
    | "card_pdf"
    | "template_front"
    | "template_back";
  isPublic?: boolean;
  data: Buffer;
}): Promise<{ id: string; url: string }> {
  const pool = getPool();
  const result = await pool.query<{ id: string }>(
    `
    INSERT INTO stored_files (file_name, mime_type, byte_size, category, is_public, data)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
    `,
    [
      params.fileName,
      params.mimeType,
      params.data.byteLength,
      params.category,
      Boolean(params.isPublic),
      params.data,
    ]
  );

  const id = result.rows[0].id;
  return {
    id,
    url: `/api/admin/files/${id}`,
  };
}

export async function getStoredFile(id: string): Promise<{
  id: string;
  file_name: string;
  mime_type: string;
  byte_size: number;
  category: string;
  is_public: boolean;
  data: Buffer;
} | null> {
  const pool = getPool();
  const result = await pool.query<{
    id: string;
    file_name: string;
    mime_type: string;
    byte_size: number;
    category: string;
    is_public: boolean;
    data: Uint8Array | Buffer;
  }>(
    `
    SELECT id, file_name, mime_type, byte_size, category, is_public, data
    FROM stored_files
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [id]
  );

  if (!result.rows[0]) return null;
  const row = result.rows[0];
  return {
    ...row,
    data: Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data),
  };
}

export async function ensureDefaultTemplateSeeded(): Promise<IdCardTemplateRecord> {
  const sql = getSql();
  const existing = (await sql`
    SELECT *
    FROM id_card_templates
    WHERE template_status = 'Active'
    ORDER BY updated_date DESC
    LIMIT 1
  `) as unknown as IdCardTemplateRecord[];

  if (existing[0]) {
    return existing[0];
  }

  const anyTemplate = (await sql`
    SELECT *
    FROM id_card_templates
    ORDER BY created_date DESC
    LIMIT 1
  `) as unknown as IdCardTemplateRecord[];

  if (anyTemplate[0]) {
    return anyTemplate[0];
  }

  const frontPath = path.join(
    process.cwd(),
    "assets",
    "templates",
    "template-front-default.png"
  );
  const backPath = path.join(
    process.cwd(),
    "assets",
    "templates",
    "template-back-default.png"
  );

  const [frontBuf, backBuf] = await Promise.all([
    fs.readFile(frontPath),
    fs.readFile(backPath),
  ]);

  const frontStored = await storeFile({
    fileName: "template-front-default.png",
    mimeType: "image/png",
    category: "template_front",
    isPublic: false,
    data: frontBuf,
  });

  const backStored = await storeFile({
    fileName: "template-back-default.png",
    mimeType: "image/png",
    category: "template_back",
    isPublic: false,
    data: backBuf,
  });

  const inserted = (await sql`
    INSERT INTO id_card_templates (
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
      template_status,
      version_number
    )
    VALUES (
      'Bangladesh Scouts Original Canva ID Card',
      ${frontStored.url},
      ${backStored.url},
      ${frontStored.id}::uuid,
      ${backStored.id}::uuid,
      591,
      1004,
      ${JSON.stringify(DEFAULT_TEXT_POSITION_CONFIG)}::jsonb,
      ${JSON.stringify(DEFAULT_IMAGE_POSITION_CONFIG)}::jsonb,
      ${JSON.stringify(DEFAULT_TYPOGRAPHY_CONFIG)}::jsonb,
      'Active',
      1
    )
    RETURNING *
  `) as unknown as IdCardTemplateRecord[];

  const template = inserted[0];

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
      ${template.id}::uuid,
      1,
      ${template.template_name},
      ${template.front_background_url},
      ${template.back_background_url},
      ${template.front_background_file_id}::uuid,
      ${template.back_background_file_id}::uuid,
      ${template.card_width},
      ${template.card_height},
      ${JSON.stringify(template.text_position_configuration)}::jsonb,
      ${JSON.stringify(template.image_position_configuration)}::jsonb,
      ${JSON.stringify(template.typography_configuration)}::jsonb,
      'mdpaponmia56@gmail.com'
    )
  `;

  return template;
}

export async function logAudit(params: {
  administratorId: string | null;
  administratorEmail: string;
  applicationId?: string | null;
  actionType: string;
  previousValues?: Record<string, unknown> | null;
  updatedValues?: Record<string, unknown> | null;
}) {
  const sql = getSql();
  await sql`
    INSERT INTO audit_logs (
      administrator_id,
      administrator_email,
      application_id,
      action_type,
      previous_values,
      updated_values
    )
    VALUES (
      ${params.administratorId ? params.administratorId : null}::uuid,
      ${params.administratorEmail},
      ${params.applicationId ? params.applicationId : null}::uuid,
      ${params.actionType},
      ${params.previousValues ? JSON.stringify(params.previousValues) : null}::jsonb,
      ${params.updatedValues ? JSON.stringify(params.updatedValues) : null}::jsonb
    )
  `;
}
