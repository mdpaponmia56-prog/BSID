import { NextResponse } from "next/server";
import { ensureDefaultTemplateSeeded } from "@/lib/db";

export async function GET() {
  try {
    const template = await ensureDefaultTemplateSeeded();

    return NextResponse.json({
      id: template.id,
      template_name: template.template_name,
      front_background_url: "/api/template-preview/image?side=front",
      back_background_url: "/api/template-preview/image?side=back",
      card_width: template.card_width,
      card_height: template.card_height,
      text_position_configuration: template.text_position_configuration,
      image_position_configuration: template.image_position_configuration,
      typography_configuration: template.typography_configuration,
      template_status: template.template_status,
      version_number: template.version_number,
    });
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
