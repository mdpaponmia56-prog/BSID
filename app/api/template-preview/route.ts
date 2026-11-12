import { NextResponse } from "next/server";
import { ensureDefaultTemplateSeeded } from "@/lib/db";

export async function GET() {
  try {
    const template = await ensureDefaultTemplateSeeded();

    const isDefault =
      template.template_name === "Bangladesh Scouts Original Canva ID Card";

    const frontUrl = isDefault
      ? "/templates/template-front-default.png"
      : "/api/template-preview/image?side=front";
    const backUrl = isDefault
      ? "/templates/template-back-default.png"
      : "/api/template-preview/image?side=back";

    return NextResponse.json(
      {
        id: template.id,
        template_name: template.template_name,
        front_background_url: frontUrl,
        back_background_url: backUrl,
        card_width: template.card_width,
        card_height: template.card_height,
        text_position_configuration: template.text_position_configuration,
        image_position_configuration: template.image_position_configuration,
        typography_configuration: template.typography_configuration,
        template_status: template.template_status,
        version_number: template.version_number,
      },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load template preview.",
      },
      { status: 500 }
    );
  }
}
