import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { requireAdmin } from "@/lib/auth";
import { ensureDefaultTemplateSeeded, getStoredFile } from "@/lib/db";
import { handleAdminApiError } from "@/lib/api-helpers";
import { generateFullIdCardSet } from "@/lib/card-renderer";
import {
  BloodGroup,
  IdCardTemplateRecord,
  ImageFieldConfig,
  TextFieldConfig,
  TypographyConfiguration,
} from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const baseTemplate = await ensureDefaultTemplateSeeded();
    const body = (await req.json()) as {
      text_position_configuration?: Record<TextFieldConfig["key"], TextFieldConfig>;
      image_position_configuration?: ImageFieldConfig;
      typography_configuration?: TypographyConfiguration;
      sample?: {
        full_name?: string;
        bs_id?: string;
        blood_group?: BloodGroup;
        father_name?: string;
        mother_name?: string;
        contact_number?: string;
        email?: string;
        present_address?: string;
      };
    };

    const draftTemplate: IdCardTemplateRecord = {
      ...baseTemplate,
      text_position_configuration:
        body.text_position_configuration ||
        baseTemplate.text_position_configuration,
      image_position_configuration:
        body.image_position_configuration ||
        baseTemplate.image_position_configuration,
      typography_configuration: {
        ...(body.typography_configuration || baseTemplate.typography_configuration),
        renderScale: 2, // Fast high-res test preview
      },
    };

    const [frontFile, backFile] = await Promise.all([
      getStoredFile(draftTemplate.front_background_file_id!),
      getStoredFile(draftTemplate.back_background_file_id!),
    ]);

    if (!frontFile || !backFile) {
      throw new Error("Template background files not found.");
    }

    // Extract clean sample portrait from original reference for realistic preview
    const refPath = path.join(
      process.cwd(),
      "assets",
      "originals",
      "front-reference.jpg"
    );
    let samplePhotoBuf: Buffer;
    try {
      samplePhotoBuf = await sharp(refPath)
        .extract({ left: 56, top: 242, width: 246, height: 308 })
        .png()
        .toBuffer();
    } catch {
      samplePhotoBuf = await fs.readFile(refPath);
    }

    const { frontPng, backPng } = await generateFullIdCardSet({
      application: {
        full_name: body.sample?.full_name || "Md Nazmul Miah",
        bs_id: body.sample?.bs_id || "ZM0914",
        blood_group: body.sample?.blood_group || "O+",
        father_name: body.sample?.father_name || "Yousuf Miah",
        mother_name: body.sample?.mother_name || "Safia Khatun",
        contact_number: body.sample?.contact_number || "01851540587",
        email: body.sample?.email || "nazmulmia101010@gmail.com",
        present_address:
          body.sample?.present_address || "Baimail,Konabari,Gazipur",
      },
      template: draftTemplate,
      frontBackgroundBuffer: frontFile.data,
      backBackgroundBuffer: backFile.data,
      photoBuffer: samplePhotoBuf,
    });

    return NextResponse.json({
      frontDataUrl: `data:image/png;base64,${frontPng.toString("base64")}`,
      backDataUrl: `data:image/png;base64,${backPng.toString("base64")}`,
    });
  } catch (err) {
    return handleAdminApiError(err);
  }
}
