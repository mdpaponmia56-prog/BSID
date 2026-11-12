import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { handleAdminApiError } from "@/lib/api-helpers";
import { generateAndSaveApplicationCards } from "@/lib/card-service";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;

    const updated = await generateAndSaveApplicationCards({
      applicationId: id,
      adminId: admin.id,
      adminEmail: admin.email,
    });

    return NextResponse.json({ application: updated });
  } catch (err) {
    return handleAdminApiError(err);
  }
}
