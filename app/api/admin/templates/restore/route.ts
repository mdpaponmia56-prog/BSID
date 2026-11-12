import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  ensureDefaultTemplateSeeded,
  getSql,
  invalidateTemplateCache,
  logAudit,
} from "@/lib/db";
import { handleAdminApiError } from "@/lib/api-helpers";
import { IdCardTemplateRecord, TemplateVersionRecord } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const { versionId } = (await req.json()) as { versionId?: string };

    if (!versionId) {
      return NextResponse.json(
        { error: "versionId is required." },
        { status: 400 }
      );
    }

    const sql = getSql();
    const current = await ensureDefaultTemplateSeeded();

    const versionRows = (await sql`
      SELECT * FROM template_versions
      WHERE id = ${versionId}::uuid AND template_id = ${current.id}::uuid
      LIMIT 1
    `) as unknown as TemplateVersionRecord[];

    const target = versionRows[0];
    if (!target) {
      return NextResponse.json(
        { error: "Template version not found." },
        { status: 404 }
      );
    }

    const nextVersion = current.version_number + 1;
    const updatedRows = (await sql`
      UPDATE id_card_templates
      SET
        template_name = ${target.template_name},
        front_background_url = ${target.front_background_url},
        back_background_url = ${target.back_background_url},
        front_background_file_id = ${target.front_background_file_id}::uuid,
        back_background_file_id = ${target.back_background_file_id}::uuid,
        card_width = ${target.card_width},
        card_height = ${target.card_height},
        text_position_configuration = ${JSON.stringify(
          target.text_position_configuration
        )}::jsonb,
        image_position_configuration = ${JSON.stringify(
          target.image_position_configuration
        )}::jsonb,
        typography_configuration = ${JSON.stringify(
          target.typography_configuration
        )}::jsonb,
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
      actionType: "TEMPLATE_RESTORED",
      previousValues: { version_number: current.version_number },
      updatedValues: {
        restored_from_version: target.version_number,
        new_version_number: updated.version_number,
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
