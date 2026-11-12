import { NextRequest, NextResponse } from "next/server";
import { getSql, storeFile } from "@/lib/db";
import {
  applicationSchema,
  generateApplicationReference,
  normalizeBsId,
  validateAndNormalizePhoto,
} from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const rawFields = {
      full_name: String(formData.get("full_name") ?? ""),
      bs_id: String(formData.get("bs_id") ?? ""),
      blood_group: String(formData.get("blood_group") ?? ""),
      father_name: String(formData.get("father_name") ?? ""),
      mother_name: String(formData.get("mother_name") ?? ""),
      contact_number: String(formData.get("contact_number") ?? ""),
      email: String(formData.get("email") ?? ""),
      present_address: String(formData.get("present_address") ?? ""),
    };

    const parsed = applicationSchema.safeParse(rawFields);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: firstIssue?.message || "Please check all required fields.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const photoEntry = formData.get("photograph");
    if (!(photoEntry instanceof File)) {
      return NextResponse.json(
        { error: "Personal Photograph is required." },
        { status: 400 }
      );
    }

    const normalizedPhoto = await validateAndNormalizePhoto(photoEntry);
    const normalizedBsId = normalizeBsId(parsed.data.bs_id);

    const sql = getSql();

    // Check duplicate BS ID before storing file
    const existing = (await sql`
      SELECT id FROM applications WHERE UPPER(TRIM(bs_id)) = ${normalizedBsId} LIMIT 1
    `) as Array<{ id: string }>;

    if (existing.length > 0) {
      return NextResponse.json(
        {
          error: `An application with BS ID "${normalizedBsId}" already exists. Duplicate BS ID numbers are not allowed.`,
          code: "DUPLICATE_BS_ID",
        },
        { status: 409 }
      );
    }

    const storedPhoto = await storeFile({
      fileName: `photo-${normalizedBsId.replace(/[^A-Za-z0-9_-]/g, "_")}.png`,
      mimeType: normalizedPhoto.mimeType,
      category: "photograph",
      isPublic: false,
      data: normalizedPhoto.buffer,
    });

    // Generate unique application reference with retry on rare collision
    let insertedRef = "";
    let submissionDate = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const ref = generateApplicationReference();
      try {
        const rows = (await sql`
          INSERT INTO applications (
            application_reference,
            full_name,
            bs_id,
            blood_group,
            photograph_url,
            photograph_file_id,
            father_name,
            mother_name,
            contact_number,
            email,
            present_address,
            application_status
          )
          VALUES (
            ${ref},
            ${parsed.data.full_name},
            ${normalizedBsId},
            ${parsed.data.blood_group},
            ${storedPhoto.url},
            ${storedPhoto.id}::uuid,
            ${parsed.data.father_name},
            ${parsed.data.mother_name},
            ${parsed.data.contact_number},
            ${parsed.data.email},
            ${parsed.data.present_address},
            'Pending'
          )
          RETURNING application_reference, submission_date
        `) as Array<{ application_reference: string; submission_date: string }>;

        insertedRef = rows[0].application_reference;
        submissionDate = rows[0].submission_date;
        break;
      } catch (dbErr) {
        const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
        if (msg.includes("idx_applications_bs_id_unique")) {
          return NextResponse.json(
            {
              error: `An application with BS ID "${normalizedBsId}" already exists.`,
              code: "DUPLICATE_BS_ID",
            },
            { status: 409 }
          );
        }
        if (attempt === 4) throw dbErr;
      }
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "Your BS ID Card application has been submitted successfully. Thank you!",
        application_reference: insertedRef,
        submission_date: submissionDate,
      },
      { status: 201 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to submit application.";
    const status =
      message.includes("Invalid image") ||
      message.includes("Unsupported image") ||
      message.includes("Photograph") ||
      message.includes("empty") ||
      message.includes("exceed")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
