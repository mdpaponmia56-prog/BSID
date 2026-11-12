import { z } from "zod";
import sharp, { type Metadata } from "sharp";
import { BLOOD_GROUPS, BloodGroup } from "./types";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const ALLOWED_TEMPLATE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
] as const;

export const applicationSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Full Name must be at least 2 characters.")
    .max(150, "Full Name cannot exceed 150 characters."),
  bs_id: z
    .string()
    .trim()
    .min(2, "BS ID is required.")
    .max(50, "BS ID cannot exceed 50 characters.")
    .regex(
      /^[A-Za-z0-9\-_/]+$/,
      "BS ID may contain only letters, numbers, hyphens, underscores, or slashes."
    ),
  blood_group: z.enum(BLOOD_GROUPS as [BloodGroup, ...BloodGroup[]], {
    error: "Please select a valid Blood Group.",
  }),
  father_name: z
    .string()
    .trim()
    .min(2, "Father's Name must be at least 2 characters.")
    .max(150, "Father's Name cannot exceed 150 characters."),
  mother_name: z
    .string()
    .trim()
    .min(2, "Mother's Name must be at least 2 characters.")
    .max(150, "Mother's Name cannot exceed 150 characters."),
  contact_number: z
    .string()
    .trim()
    .min(6, "Contact Number must be at least 6 characters.")
    .max(25, "Contact Number cannot exceed 25 characters.")
    .regex(
      /^[+0-9\s\-()]+$/,
      "Please enter a valid Contact Number."
    ),
  email: z
    .string()
    .trim()
    .email("Please enter a valid Email Address.")
    .max(200, "Email Address cannot exceed 200 characters."),
  present_address: z
    .string()
    .trim()
    .min(5, "Present Address must be at least 5 characters.")
    .max(400, "Present Address cannot exceed 400 characters."),
});

export function normalizeBsId(raw: string): string {
  return raw.trim().toUpperCase();
}

export async function validateAndNormalizePhoto(
  file: File
): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new Error("Personal Photograph is required.");
  }

  if (file.size === 0) {
    throw new Error("Uploaded photograph file is empty.");
  }

  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("Photograph file size must not exceed 5 MB.");
  }

  const lowerType = (file.type || "").toLowerCase();
  const lowerName = (file.name || "").toLowerCase();
  const hasValidMime = (ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(
    lowerType
  );
  const hasValidExt = /\.(jpe?g|png|webp)$/i.test(lowerName);

  if (!hasValidMime && !hasValidExt) {
    throw new Error(
      "Invalid image format. Only JPG, JPEG, PNG, and WEBP files are accepted."
    );
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  let meta: Metadata;
  try {
    meta = await sharp(rawBuffer).metadata();
  } catch {
    throw new Error(
      "The uploaded file is not a valid JPG, JPEG, PNG, or WEBP image."
    );
  }

  if (
    !meta.format ||
    !["jpeg", "png", "webp"].includes(meta.format.toLowerCase())
  ) {
    throw new Error(
      "Unsupported image format detected. Please upload JPG, JPEG, PNG, or WEBP."
    );
  }

  if (!meta.width || !meta.height || meta.width < 50 || meta.height < 50) {
    throw new Error("Photograph dimensions must be at least 50x50 pixels.");
  }

  // Re-encode cleanly with auto-orientation (respecting EXIF rotation from phones!)
  const normalizedBuffer = await sharp(rawBuffer)
    .rotate()
    .resize(1200, 1500, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();

  return {
    buffer: normalizedBuffer,
    mimeType: "image/png",
    ext: "png",
  };
}

export function generateApplicationReference(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `BS-${year}-${rand}`;
}
