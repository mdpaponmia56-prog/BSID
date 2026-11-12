import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  ensureDefaultTemplateSeeded,
  getSql,
  logAudit,
  storeFile,
} from "@/lib/db";
import { handleAdminApiError } from "@/lib/api-helpers";
import { generateAndSaveApplicationCards } from "@/lib/card-service";
import {
  applicationSchema,
  normalizeBsId,
  validateAndNormalizePhoto,
} from "@/lib/validation";
import { ApplicationRecord, ApplicationStatus, AuditLogRecord } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const sql = getSql();

    const rows = (await sql`
      SELECT * FROM applications WHERE id = ${id}::uuid LIMIT 1
    `) as unknown as ApplicationRecord[];

    if (!rows[0]) {
      return NextResponse.json(
        { error: "Application not found." },
        { status: 404 }
      );
    }

    const [auditLogs, activeTemplate] = await Promise.all([
      sql`
        SELECT * FROM audit_logs
        WHERE application_id = ${id}::uuid
        ORDER BY timestamp DESC
        LIMIT 100
      ` as unknown as Promise<AuditLogRecord[]>,
      ensureDefaultTemplateSeeded(),
    ]);

    return NextResponse.json({
      application: rows[0],
      auditLogs,
      activeTemplate,
    });
  } catch (err) {
    return handleAdminApiError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const sql = getSql();

    const existingRows = (await sql`
      SELECT * FROM applications WHERE id = ${id}::uuid LIMIT 1
    `) as unknown as ApplicationRecord[];

    const existing = existingRows[0];
    if (!existing) {
      return NextResponse.json(
        { error: "Application not found." },
        { status: 404 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    let bodyFields: Record<string, string | null | undefined> = {};
    let newPhotoFile: File | null = null;
    let regenerateCard = false;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const keys = [
        "full_name",
        "bs_id",
        "blood_group",
        "father_name",
        "mother_name",
        "contact_number",
        "email",
        "present_address",
        "application_status",
        "rejection_reason",
      ];
      for (const k of keys) {
        if (formData.has(k)) {
          bodyFields[k] = String(formData.get(k) ?? "");
        }
      }
      const photo = formData.get("photograph");
      if (photo instanceof File && photo.size > 0) {
        newPhotoFile = photo;
      }
      regenerateCard = formData.get("regenerate_card") === "true";
    } else {
      const json = (await req.json()) as Record<string, unknown>;
      for (const [k, v] of Object.entries(json)) {
        if (k === "regenerate_card") {
          regenerateCard = Boolean(v);
        } else if (typeof v === "string" || v === null) {
          bodyFields[k] = v;
        }
      }
    }

    const mergedForValidation = {
      full_name: bodyFields.full_name ?? existing.full_name,
      bs_id: bodyFields.bs_id ?? existing.bs_id,
      blood_group: bodyFields.blood_group ?? existing.blood_group,
      father_name: bodyFields.father_name ?? existing.father_name,
      mother_name: bodyFields.mother_name ?? existing.mother_name,
      contact_number: bodyFields.contact_number ?? existing.contact_number,
      email: bodyFields.email ?? existing.email,
      present_address: bodyFields.present_address ?? existing.present_address,
    };

    const parsed = applicationSchema.safeParse(mergedForValidation);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "Invalid application fields provided.",
        },
        { status: 400 }
      );
    }

    const normalizedBsId = normalizeBsId(parsed.data.bs_id);
    if (normalizedBsId !== normalizeBsId(existing.bs_id)) {
      const dup = (await sql`
        SELECT id FROM applications
        WHERE UPPER(TRIM(bs_id)) = ${normalizedBsId}
          AND id <> ${existing.id}::uuid
        LIMIT 1
      `) as Array<{ id: string }>;
      if (dup.length > 0) {
        return NextResponse.json(
          {
            error: `BS ID "${normalizedBsId}" is already assigned to another application.`,
          },
          { status: 409 }
        );
      }
    }

    let nextStatus = existing.application_status;
    if (bodyFields.application_status) {
      if (
        !["Pending", "Approved", "Rejected"].includes(
          bodyFields.application_status
        )
      ) {
        return NextResponse.json(
          { error: "Invalid application status." },
          { status: 400 }
        );
      }
      nextStatus = bodyFields.application_status as ApplicationStatus;
    }

    let nextRejectionReason =
      bodyFields.rejection_reason !== undefined
        ? bodyFields.rejection_reason
        : existing.rejection_reason;

    if (nextStatus !== "Rejected") {
      nextRejectionReason = null;
    }

    let nextPhotoUrl = existing.photograph_url;
    let nextPhotoFileId = existing.photograph_file_id;
    if (newPhotoFile) {
      const normalizedPhoto = await validateAndNormalizePhoto(newPhotoFile);
      const storedPhoto = await storeFile({
        fileName: `photo-${normalizedBsId.replace(/[^A-Za-z0-9_-]/g, "_")}.png`,
        mimeType: normalizedPhoto.mimeType,
        category: "photograph",
        isPublic: false,
        data: normalizedPhoto.buffer,
      });
      nextPhotoUrl = storedPhoto.url;
      nextPhotoFileId = storedPhoto.id;
    }

    const approvedDateSql =
      nextStatus === "Approved" && existing.application_status !== "Approved"
        ? new Date().toISOString()
        : nextStatus === "Approved"
        ? existing.approved_date
        : null;

    const updatedRows = (await sql`
      UPDATE applications
      SET
        full_name = ${parsed.data.full_name},
        bs_id = ${normalizedBsId},
        blood_group = ${parsed.data.blood_group},
        father_name = ${parsed.data.father_name},
        mother_name = ${parsed.data.mother_name},
        contact_number = ${parsed.data.contact_number},
        email = ${parsed.data.email},
        present_address = ${parsed.data.present_address},
        photograph_url = ${nextPhotoUrl},
        photograph_file_id = ${nextPhotoFileId}::uuid,
        application_status = ${nextStatus},
        rejection_reason = ${nextRejectionReason},
        approved_date = ${approvedDateSql}::timestamptz,
        updated_date = NOW()
      WHERE id = ${existing.id}::uuid
      RETURNING *
    `) as unknown as ApplicationRecord[];

    let updated = updatedRows[0];

    // Record detailed audit log of changes
    const prevSnapshot: Record<string, unknown> = {};
    const nextSnapshot: Record<string, unknown> = {};
    const trackKeys: Array<keyof ApplicationRecord> = [
      "full_name",
      "bs_id",
      "blood_group",
      "father_name",
      "mother_name",
      "contact_number",
      "email",
      "present_address",
      "photograph_url",
      "application_status",
      "rejection_reason",
    ];
    for (const k of trackKeys) {
      if (existing[k] !== updated[k]) {
        prevSnapshot[k] = existing[k];
        nextSnapshot[k] = updated[k];
      }
    }

    const statusChanged =
      existing.application_status !== updated.application_status;

    if (Object.keys(nextSnapshot).length > 0) {
      await logAudit({
        administratorId: admin.id,
        administratorEmail: admin.email,
        applicationId: updated.id,
        actionType: statusChanged
          ? `STATUS_${updated.application_status.toUpperCase()}`
          : "APPLICATION_UPDATED",
        previousValues: prevSnapshot,
        updatedValues: nextSnapshot,
      });
    }

    // Automatically generate ID card when approved or explicitly requested
    const shouldGenerate =
      regenerateCard ||
      (updated.application_status === "Approved" &&
        !updated.generated_card_front_file_id) ||
      (statusChanged && updated.application_status === "Approved");

    if (shouldGenerate) {
      updated = await generateAndSaveApplicationCards({
        applicationId: updated.id,
        adminId: admin.id,
        adminEmail: admin.email,
      });
    }

    const auditLogs = (await sql`
      SELECT * FROM audit_logs
      WHERE application_id = ${updated.id}::uuid
      ORDER BY timestamp DESC
      LIMIT 100
    `) as unknown as AuditLogRecord[];

    return NextResponse.json({
      application: updated,
      auditLogs,
    });
  } catch (err) {
    return handleAdminApiError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const sql = getSql();

    const rows = (await sql`
      SELECT * FROM applications WHERE id = ${id}::uuid LIMIT 1
    `) as unknown as ApplicationRecord[];

    const existing = rows[0];
    if (!existing) {
      return NextResponse.json(
        { error: "Application not found." },
        { status: 404 }
      );
    }

    await logAudit({
      administratorId: admin.id,
      administratorEmail: admin.email,
      applicationId: null,
      actionType: "APPLICATION_DELETED",
      previousValues: {
        deleted_application_id: existing.id,
        application_reference: existing.application_reference,
        full_name: existing.full_name,
        bs_id: existing.bs_id,
        application_status: existing.application_status,
      },
      updatedValues: null,
    });

    await sql`DELETE FROM applications WHERE id = ${id}::uuid`;

    // Clean up orphaned stored_files if desired
    const fileIds = [
      existing.photograph_file_id,
      existing.generated_card_front_file_id,
      existing.generated_card_back_file_id,
      existing.generated_card_pdf_file_id,
    ].filter(Boolean) as string[];

    for (const fid of fileIds) {
      await sql`DELETE FROM stored_files WHERE id = ${fid}::uuid`;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleAdminApiError(err);
  }
}
