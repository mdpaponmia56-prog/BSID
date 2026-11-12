import fs from "fs/promises";
import path from "path";
import { getSql, storeFile, ensureDefaultTemplateSeeded } from "../lib/db";

async function main() {
  const root = process.cwd();
  const frontBuf = await fs.readFile(
    path.join(root, "assets", "templates", "template-front-default.png")
  );
  const backBuf = await fs.readFile(
    path.join(root, "assets", "templates", "template-back-default.png")
  );

  const sql = getSql();
  const current = await ensureDefaultTemplateSeeded();
  console.log("Current active template ID:", current.id, "Version:", current.version_number);

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

  console.log("Uploaded new stored files:", frontStored.id, backStored.id);

  const nextVersion = (current.version_number || 1) + 1;
  const updated = await sql`
    UPDATE id_card_templates
    SET
      front_background_url = ${frontStored.url},
      back_background_url = ${backStored.url},
      front_background_file_id = ${frontStored.id}::uuid,
      back_background_file_id = ${backStored.id}::uuid,
      version_number = ${nextVersion},
      updated_date = NOW()
    WHERE id = ${current.id}::uuid
    RETURNING *;
  `;

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
      ${current.id}::uuid,
      ${nextVersion},
      ${current.template_name},
      ${frontStored.url},
      ${backStored.url},
      ${frontStored.id}::uuid,
      ${backStored.id}::uuid,
      ${current.card_width},
      ${current.card_height},
      ${JSON.stringify(current.text_position_configuration)}::jsonb,
      ${JSON.stringify(current.image_position_configuration)}::jsonb,
      ${JSON.stringify(current.typography_configuration)}::jsonb,
      'mdpaponmia56@gmail.com'
    );
  `;

  console.log("Database template successfully updated to Version:", nextVersion);
}

main().catch((err) => {
  console.error("Error updating template dates in DB:", err);
  process.exit(1);
});
