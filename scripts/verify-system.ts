import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import JSZip from "jszip";
import {
  ensureDefaultTemplateSeeded,
  getSql,
  getStoredFile,
} from "../lib/db";
import { generateAndSaveApplicationCards } from "../lib/card-service";
import { ApplicationRecord } from "../lib/types";

const BASE_URL = process.env.APP_URL || "http://127.0.0.1:3001";

async function run() {
  const sql = getSql();
  await sql`DELETE FROM applications WHERE bs_id = 'TESTQA01'`;

  console.log("1. Checking health & Neon DB connection...");
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const health = await healthRes.json();
  assert.equal(healthRes.status, 200);
  assert.equal(health.ok, true);
  assert.equal(health.database, "BS ID");
  console.log("   OK:", health);

  console.log("2. Seeding default Canva template into Neon DB...");
  const template = await ensureDefaultTemplateSeeded();
  assert.equal(template.card_width, 591);
  assert.equal(template.card_height, 1004);
  assert.ok(template.front_background_file_id);
  assert.ok(template.back_background_file_id);
  console.log("   OK: Template seeded ->", template.id);

  console.log("3. Testing public submission validation (missing fields)...");
  const badFd = new FormData();
  badFd.append("full_name", "A");
  const badRes = await fetch(`${BASE_URL}/api/applications`, {
    method: "POST",
    body: badFd,
  });
  assert.equal(badRes.status, 400);
  console.log("   OK: Missing fields rejected with 400");

  console.log("4. Testing invalid image format rejection...");
  const badImgFd = new FormData();
  badImgFd.append("full_name", "Test Scout");
  badImgFd.append("bs_id", "TEST9991");
  badImgFd.append("blood_group", "O+");
  badImgFd.append("father_name", "Test Father");
  badImgFd.append("mother_name", "Test Mother");
  badImgFd.append("contact_number", "01800000000");
  badImgFd.append("email", "test@example.com");
  badImgFd.append("present_address", "Gazipur, Bangladesh");
  badImgFd.append(
    "photograph",
    new File([Buffer.from("not an image")], "evil.txt", { type: "text/plain" })
  );
  const badImgRes = await fetch(`${BASE_URL}/api/applications`, {
    method: "POST",
    body: badImgFd,
  });
  assert.equal(badImgRes.status, 400);
  console.log("   OK: Invalid image format rejected with 400");

  console.log("5. Testing oversized photograph rejection (>5 MB)...");
  const bigBuf = Buffer.alloc(5 * 1024 * 1024 + 500, 1);
  const bigFd = new FormData();
  bigFd.append("full_name", "Test Scout");
  bigFd.append("bs_id", "TEST9992");
  bigFd.append("blood_group", "A+");
  bigFd.append("father_name", "Test Father");
  bigFd.append("mother_name", "Test Mother");
  bigFd.append("contact_number", "01800000000");
  bigFd.append("email", "test@example.com");
  bigFd.append("present_address", "Gazipur, Bangladesh");
  bigFd.append(
    "photograph",
    new File([bigBuf], "huge.png", { type: "image/png" })
  );
  const bigRes = await fetch(`${BASE_URL}/api/applications`, {
    method: "POST",
    body: bigFd,
  });
  assert.ok(
    [400, 413].includes(bigRes.status),
    `Expected 400 or 413, got ${bigRes.status}`
  );
  console.log("   OK: Oversized photograph rejected with", bigRes.status);

  console.log("6. Testing valid public application submission...");
  const refPhoto = await sharp(
    path.join(process.cwd(), "assets/originals/front-reference.jpg")
  )
    .extract({ left: 56, top: 242, width: 246, height: 308 })
    .png()
    .toBuffer();

  const testBsId = "TESTQA01";
  const goodFd = new FormData();
  goodFd.append("full_name", "Md Nazmul Miah");
  goodFd.append("bs_id", testBsId);
  goodFd.append("blood_group", "O+");
  goodFd.append("father_name", "Yousuf Miah");
  goodFd.append("mother_name", "Safia Khatun");
  goodFd.append("contact_number", "01851540587");
  goodFd.append("email", "nazmulmia101010@gmail.com");
  goodFd.append("present_address", "Baimail,Konabari,Gazipur");
  goodFd.append(
    "photograph",
    new File([new Uint8Array(refPhoto)], "portrait.png", { type: "image/png" })
  );

  const goodRes = await fetch(`${BASE_URL}/api/applications`, {
    method: "POST",
    body: goodFd,
  });
  const goodBody = (await goodRes.json()) as {
    success: boolean;
    application_reference: string;
    message: string;
  };
  assert.equal(goodRes.status, 201);
  assert.equal(goodBody.success, true);
  assert.ok(goodBody.application_reference.startsWith("BS-"));
  console.log("   OK: Submitted Ref =", goodBody.application_reference);

  console.log("7. Testing duplicate BS ID detection...");
  const checkRes = await fetch(
    `${BASE_URL}/api/applications/check-bs-id?bs_id=${testBsId}`
  );
  const checkJson = (await checkRes.json()) as { exists: boolean };
  assert.equal(checkJson.exists, true);

  const dupRes = await fetch(`${BASE_URL}/api/applications`, {
    method: "POST",
    body: goodFd,
  });
  assert.equal(dupRes.status, 409);
  console.log("   OK: Duplicate BS ID blocked (409)");

  console.log("8. Verifying unauthorized access to admin endpoints is blocked...");
  const unauthApps = await fetch(`${BASE_URL}/api/admin/applications`, {
    redirect: "manual",
  });
  assert.ok([307, 401, 403, 404, 503].includes(unauthApps.status));
  const unauthTpl = await fetch(`${BASE_URL}/api/admin/templates`, {
    redirect: "manual",
  });
  assert.ok([307, 401, 403, 404, 503].includes(unauthTpl.status));
  console.log("   OK: Admin endpoints fail closed ->", unauthApps.status);

  console.log("9. Verifying database record + photograph + ID card generation (PNG & PDF & ZIP)...");
  const rows = (await sql`
    SELECT * FROM applications WHERE bs_id = ${testBsId} LIMIT 1
  `) as unknown as ApplicationRecord[];
  assert.equal(rows.length, 1);
  const app = rows[0];
  assert.equal(app.application_status, "Pending");
  assert.ok(app.photograph_file_id);

  // Verify unauthenticated access to stored photograph URL is also blocked
  const unauthPhoto = await fetch(`${BASE_URL}${app.photograph_url}`, {
    redirect: "manual",
  });
  assert.ok([307, 401, 403, 404, 503].includes(unauthPhoto.status));

  // Generate ID Card via backend service (simulating authorized admin action)
  const generatedApp = await generateAndSaveApplicationCards({
    applicationId: app.id,
    adminId: null,
    adminEmail: "mdpaponmia56@gmail.com",
  });
  assert.ok(generatedApp.generated_card_front_file_id);
  assert.ok(generatedApp.generated_card_back_file_id);
  assert.ok(generatedApp.generated_card_pdf_file_id);

  const frontFile = await getStoredFile(
    generatedApp.generated_card_front_file_id!
  );
  const backFile = await getStoredFile(
    generatedApp.generated_card_back_file_id!
  );
  const pdfFile = await getStoredFile(generatedApp.generated_card_pdf_file_id!);
  assert.ok(frontFile && backFile && pdfFile);

  const frontMeta = await sharp(frontFile.data).metadata();
  const backMeta = await sharp(backFile.data).metadata();
  assert.equal(frontMeta.width, 591 * 3);
  assert.equal(frontMeta.height, 1004 * 3);
  assert.equal(backMeta.width, 591 * 3);
  assert.equal(backMeta.height, 1004 * 3);
  assert.equal(pdfFile.data.subarray(0, 4).toString("utf8"), "%PDF");

  // Verify ZIP packaging
  const zip = new JSZip();
  zip.file(`BS-ID-${testBsId}-front.png`, frontFile.data);
  zip.file(`BS-ID-${testBsId}-back.png`, backFile.data);
  zip.file(`BS-ID-${testBsId}.pdf`, pdfFile.data);
  const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
  const reloadedZip = await JSZip.loadAsync(zipBuf);
  assert.equal(Object.keys(reloadedZip.files).length, 3);
  console.log(
    "   OK: Generated PNGs (1773x3012), PDF (",
    pdfFile.data.byteLength,
    "bytes), ZIP (",
    zipBuf.byteLength,
    "bytes)"
  );

  console.log("10. Cleaning up synthetic QA test records from Neon DB...");
  await sql`DELETE FROM audit_logs WHERE application_id = ${app.id}::uuid`;
  await sql`DELETE FROM applications WHERE id = ${app.id}::uuid`;
  const cleanupIds = [
    app.photograph_file_id,
    generatedApp.generated_card_front_file_id,
    generatedApp.generated_card_back_file_id,
    generatedApp.generated_card_pdf_file_id,
  ].filter(Boolean) as string[];
  for (const fid of cleanupIds) {
    await sql`DELETE FROM stored_files WHERE id = ${fid}::uuid`;
  }
  console.log("   OK: QA test records cleaned up.");

  await fs.rm("/tmp/test-photo.png", { force: true }).catch(() => {});
  console.log("\nALL SYSTEM VERIFICATION TESTS PASSED!");
}

run().catch((err) => {
  console.error("VERIFICATION FAILED:", err);
  process.exit(1);
});
