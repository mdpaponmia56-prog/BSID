import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  ensureDefaultTemplateSeeded,
  getSql,
  logAudit,
} from "@/lib/db";
import { handleAdminApiError } from "@/lib/api-helpers";
import {
  IdCardTemplateRecord,
  ImageFieldConfig,
  TemplateVersionRecord,
  TextFieldConfig,
  TypographyConfiguration,
} from "@/lib/types";

export async function GET() {
  try {
    await requireAdmin();
    const sql = getSql();
    const activeTemplate = await ensureDefaultTemplateSeeded();

    const versions = (await sql`
      SELECT *
      FROM template_versions
      WHERE template_id = ${activeTemplate.id}::uuid
      ORDER BY version_number DESC
      LIMIT 30
    `) as unknown as TemplateVersionRecord[];

    return NextResponse.json({
      template: activeTemplate,
      versions,
    });
  } catch (err) {
    return handleAdminApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const sql = getSql();
    const current = await ensureDefaultTemplateSeeded();

    const body = (await req.json()) as {
      template_name?: string;
      card_width?: number;
      card_height?: number;
      text_position_configuration?: Record<TextFieldConfig["key"], TextFieldConfig>;
      image_position_configuration?: ImageFieldConfig;
      typography_configuration?: TypographyConfiguration;
    };

    const nextName = (body.template_name || current.template_name).trim();
    const nextWidth = Number(body.card_width || current.card_width);
    const nextHeight = Number(body.card_height || current.card_height);
    const nextTextCfg =
      body.text_position_configuration || current.text_position_configuration;
    const nextImageCfg =
      body.image_position_configuration || current.image_position_configuration;
    const nextTypoCfg =
      body.typography_configuration || current.typography_configuration;
    const nextVersion = current.version_number + 1;

    const updatedRows = (await sql`
      UPDATE id_card_templates
      SET
        template_name = ${nextName},
        card_width = ${nextWidth},
        card_height = ${nextHeight},
        text_position_configuration = ${JSON.stringify(nextTextCfg)}::jsonb,
        image_position_configuration = ${JSON.stringify(nextImageCfg)}::jsonb,
        typography_configuration = ${JSON.stringify(nextTypoCfg)}::jsonb,
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
      actionType: "TEMPLATE_UPDATED",
      previousValues: { version_number: current.version_number },
      updatedValues: {
        version_number: updated.version_number,
        template_name: updated.template_name,
      },
    });

    const versions = (await sql`
      SELECT *
      FROM template_versions
      WHERE template_id = ${updated.id}::uuid
      ORDER BY version_number DESC
      LIMIT 30
    `) as unknown as TemplateVersionRecord[];

    return NextResponse.json({ template: updated, versions });
  } catch (err) {
    return handleAdminApiError(err);
  }
}
