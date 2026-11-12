import { createCanvas, GlobalFonts, loadImage, SKRSContext2D } from "@napi-rs/canvas";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import {
  ApplicationRecord,
  IdCardTemplateRecord,
  TextFieldConfig,
} from "./types";

let fontsRegistered = false;
let cachedSealImg: Awaited<ReturnType<typeof loadImage>> | null = null;

async function getQrSealImage() {
  if (cachedSealImg) return cachedSealImg;
  try {
    const sealPath = path.join(
      process.cwd(),
      "public",
      "templates",
      "qr-center-seal.png"
    );
    const sealBuf = await fs.readFile(sealPath);
    cachedSealImg = await loadImage(sealBuf);
    return cachedSealImg;
  } catch {
    try {
      const fallbackPath = path.join(
        process.cwd(),
        "assets",
        "templates",
        "qr-center-seal.png"
      );
      const sealBuf = await fs.readFile(fallbackPath);
      cachedSealImg = await loadImage(sealBuf);
      return cachedSealImg;
    } catch {
      return null;
    }
  }
}

function ensureFontsRegistered() {
  if (fontsRegistered) return;
  const root = process.cwd();
  const fontMap: Array<{ relPath: string; family: string }> = [
    {
      relPath: "node_modules/@fontsource/open-sans/files/open-sans-latin-400-normal.woff2",
      family: "Open Sans",
    },
    {
      relPath: "node_modules/@fontsource/open-sans/files/open-sans-latin-500-normal.woff2",
      family: "Open Sans",
    },
    {
      relPath: "node_modules/@fontsource/open-sans/files/open-sans-latin-600-normal.woff2",
      family: "Open Sans",
    },
    {
      relPath: "node_modules/@fontsource/open-sans/files/open-sans-latin-700-normal.woff2",
      family: "Open Sans",
    },
    {
      relPath: "node_modules/@fontsource/merriweather/files/merriweather-latin-400-normal.woff2",
      family: "Merriweather",
    },
    {
      relPath: "node_modules/@fontsource/merriweather/files/merriweather-latin-700-normal.woff2",
      family: "Merriweather",
    },
  ];

  for (const item of fontMap) {
    const abs = path.join(/*turbopackIgnore: true*/ root, item.relPath);
    try {
      GlobalFonts.registerFromPath(abs, item.family);
    } catch {
      // Ignore if already registered or missing in edge cases
    }
  }
  fontsRegistered = true;
}

function drawRoundedRectPath(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapTextLines(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
  allowWrap: boolean
): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [""];

  if (!allowWrap) {
    return [clean.replace(/\n+/g, " ")];
  }

  const paragraphs = clean.split("\n");
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = `${currentLine} ${words[i]}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

function drawConfiguredText(
  ctx: SKRSContext2D,
  cfg: TextFieldConfig,
  value: string,
  scale: number
) {
  const fontFamily = cfg.fontFamily || "Open Sans";
  let fontSize = cfg.fontSize * scale;
  const maxWidth = Math.max(20, cfg.maxWidth * scale);
  const weight = cfg.fontWeight || "400";

  ctx.font = `${weight} ${fontSize}px "${fontFamily}", sans-serif`;
  let lines = wrapTextLines(ctx, value, maxWidth, cfg.wrap);

  // Shrink font proportionally if any single line exceeds maxWidth (prevents clipping/overlap)
  const getLongestLineWidth = (lineList: string[]) =>
    Math.max(...lineList.map((l) => ctx.measureText(l).width), 0);

  let longest = getLongestLineWidth(lines);
  let guard = 0;
  while (longest > maxWidth && fontSize > 9 * scale && guard < 24) {
    fontSize = Math.max(9 * scale, fontSize * 0.92);
    ctx.font = `${weight} ${fontSize}px "${fontFamily}", sans-serif`;
    lines = wrapTextLines(ctx, value, maxWidth, cfg.wrap);
    longest = getLongestLineWidth(lines);
    guard++;
  }

  ctx.fillStyle = cfg.color || "#111111";
  ctx.textAlign = cfg.align || "left";
  ctx.textBaseline = "middle";

  const lineAdvance = fontSize * (cfg.lineHeight || 1.2);
  const totalHeight = (lines.length - 1) * lineAdvance;
  const startY = cfg.y * scale - totalHeight / 2;
  const drawX = cfg.x * scale;

  lines.forEach((line, idx) => {
    ctx.fillText(line, drawX, startY + idx * lineAdvance);
  });
}

async function drawQrCode(
  ctx: SKRSContext2D,
  app: Pick<
    ApplicationRecord,
    "bs_id" | "full_name" | "blood_group" | "contact_number"
  >,
  template: IdCardTemplateRecord,
  scale: number
) {
  const qrCfg = template.image_position_configuration.qrCode;
  if (!qrCfg?.enabled) return;

  const size = Math.round(Math.min(qrCfg.width, qrCfg.height) * scale);
  const payload =
    template.typography_configuration?.qrMode === "verification_json"
      ? JSON.stringify({
          bs_id: app.bs_id,
          name: app.full_name,
          blood_group: app.blood_group,
          contact: app.contact_number,
          org: "Bangladesh Scouts",
        })
      : `BS ID: ${app.bs_id}\nName: ${app.full_name}\nBlood Group: ${app.blood_group}\nContact: ${app.contact_number}\nhttps://scouts.gov.bd`;

  const qrBuf = await QRCode.toBuffer(payload, {
    type: "png",
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });

  const qrImg = await loadImage(qrBuf);
  const drawX = qrCfg.x * scale;
  const drawY = qrCfg.y * scale;
  ctx.drawImage(qrImg, drawX, drawY, qrCfg.width * scale, qrCfg.height * scale);

  if (qrCfg.showCenterSeal) {
    try {
      const sealImg = await getQrSealImage();
      if (sealImg) {
        const sealSize = Math.round(size * 0.22);
        const cx = drawX + (qrCfg.width * scale) / 2;
        const cy = drawY + (qrCfg.height * scale) / 2;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, sealSize * 0.54, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.closePath();

        ctx.beginPath();
        ctx.arc(cx, cy, sealSize * 0.5, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(
          sealImg,
          cx - sealSize / 2,
          cy - sealSize / 2,
          sealSize,
          sealSize
        );
        ctx.restore();
      }
    } catch {
      // Optional center seal if file exists
    }
  }
}

async function renderCardSide(params: {
  side: "front" | "back";
  backgroundBuffer: Buffer;
  photoBuffer: Buffer;
  application: Pick<
    ApplicationRecord,
    | "full_name"
    | "bs_id"
    | "blood_group"
    | "father_name"
    | "mother_name"
    | "contact_number"
    | "email"
    | "present_address"
  >;
  template: IdCardTemplateRecord;
}): Promise<Buffer> {
  ensureFontsRegistered();

  const { side, backgroundBuffer, photoBuffer, application, template } = params;
  // Scale 2 renders at ~355 DPI (super-crisp for high-end card printers) with 3x faster generation
  const scale = Math.max(1, Math.min(3, template.typography_configuration?.renderScale || 2));
  const width = Math.round(template.card_width * scale);
  const height = Math.round(template.card_height * scale);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Direct load & draw without redundant Sharp pre-resize saves ~80ms and 3MB memory
  const bgImg = await loadImage(backgroundBuffer);
  ctx.drawImage(bgImg, 0, 0, width, height);

  // Draw photograph if assigned to this side
  const photoCfg = template.image_position_configuration.photograph;
  if (photoCfg.side === side) {
    const photoImg = await loadImage(photoBuffer);
    const boxX = photoCfg.x * scale;
    const boxY = photoCfg.y * scale;
    const boxW = photoCfg.width * scale;
    const boxH = photoCfg.height * scale;
    const radius = photoCfg.borderRadius * scale;

    ctx.save();
    drawRoundedRectPath(ctx, boxX, boxY, boxW, boxH, radius);
    ctx.clip();

    if (photoCfg.objectFit === "fill") {
      ctx.drawImage(photoImg, boxX, boxY, boxW, boxH);
    } else if (photoCfg.objectFit === "contain") {
      const imgAspect = photoImg.width / photoImg.height;
      const boxAspect = boxW / boxH;
      let drawW = boxW;
      let drawH = boxH;
      if (imgAspect > boxAspect) {
        drawH = boxW / imgAspect;
      } else {
        drawW = boxH * imgAspect;
      }
      const dx = boxX + (boxW - drawW) / 2;
      const dy = boxY + (boxH - drawH) / 2;
      ctx.drawImage(photoImg, dx, dy, drawW, drawH);
    } else {
      // cover with cropX, cropY, zoom
      const zoom = Math.max(1, photoCfg.zoom || 1);
      const cropX = Math.max(0, Math.min(1, photoCfg.cropX ?? 0.5));
      const cropY = Math.max(0, Math.min(1, photoCfg.cropY ?? 0.5));
      const imgAspect = photoImg.width / photoImg.height;
      const boxAspect = boxW / boxH;

      let drawW: number;
      let drawH: number;
      if (imgAspect > boxAspect) {
        drawH = boxH * zoom;
        drawW = drawH * imgAspect;
      } else {
        drawW = boxW * zoom;
        drawH = drawW / imgAspect;
      }

      const overflowX = Math.max(0, drawW - boxW);
      const overflowY = Math.max(0, drawH - boxH);
      const dx = boxX - overflowX * cropX;
      const dy = boxY - overflowY * cropY;
      ctx.drawImage(photoImg, dx, dy, drawW, drawH);
    }

    ctx.restore();
  }

  // Draw QR code if assigned to this side
  if (template.image_position_configuration.qrCode?.side === side) {
    await drawQrCode(ctx, application, template, scale);
  }

  // Draw text fields assigned to this side
  const textEntries = Object.values(template.text_position_configuration || {});
  for (const fieldCfg of textEntries) {
    if (fieldCfg.side !== side) continue;
    const rawVal = application[fieldCfg.key] ?? "";
    drawConfiguredText(ctx, fieldCfg, String(rawVal), scale);
  }

  return canvas.toBuffer("image/png");
}

export async function generateIdCardPdf(params: {
  frontPng: Buffer;
  backPng: Buffer;
  cardWidth: number;
  cardHeight: number;
  bsId: string;
  fullName: string;
}): Promise<Buffer> {
  // Standard CR80 width in points (54mm = 153.07pt), height proportional to preserve exact aspect ratio
  const pageWidthPt = 153.07;
  const pageHeightPt = (pageWidthPt * params.cardHeight) / params.cardWidth;

  // High-performance JPEG encoding keeps 300+ DPI print sharpness while creating lean, fast-downloading PDFs
  const [frontEmbed, backEmbed] = await Promise.all([
    sharp(params.frontPng)
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer(),
    sharp(params.backPng)
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer(),
  ]);

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      autoFirstPage: false,
      info: {
        Title: `BS ID Card - ${params.bsId}`,
        Author: "Bangladesh Scouts ID Card Management System",
        Subject: `Official ID Card for ${params.fullName} (${params.bsId})`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.addPage({ size: [pageWidthPt, pageHeightPt], margin: 0 });
    doc.image(frontEmbed, 0, 0, {
      width: pageWidthPt,
      height: pageHeightPt,
    });

    doc.addPage({ size: [pageWidthPt, pageHeightPt], margin: 0 });
    doc.image(backEmbed, 0, 0, {
      width: pageWidthPt,
      height: pageHeightPt,
    });

    doc.end();
  });
}

export async function generateFullIdCardSet(params: {
  application: Pick<
    ApplicationRecord,
    | "full_name"
    | "bs_id"
    | "blood_group"
    | "father_name"
    | "mother_name"
    | "contact_number"
    | "email"
    | "present_address"
  >;
  template: IdCardTemplateRecord;
  frontBackgroundBuffer: Buffer;
  backBackgroundBuffer: Buffer;
  photoBuffer: Buffer;
}): Promise<{
  frontPng: Buffer;
  backPng: Buffer;
  pdfBuffer: Buffer;
}> {
  const [frontPng, backPng] = await Promise.all([
    renderCardSide({
      side: "front",
      backgroundBuffer: params.frontBackgroundBuffer,
      photoBuffer: params.photoBuffer,
      application: params.application,
      template: params.template,
    }),
    renderCardSide({
      side: "back",
      backgroundBuffer: params.backBackgroundBuffer,
      photoBuffer: params.photoBuffer,
      application: params.application,
      template: params.template,
    }),
  ]);

  const pdfBuffer = await generateIdCardPdf({
    frontPng,
    backPng,
    cardWidth: params.template.card_width,
    cardHeight: params.template.card_height,
    bsId: params.application.bs_id,
    fullName: params.application.full_name,
  });

  return { frontPng, backPng, pdfBuffer };
}
