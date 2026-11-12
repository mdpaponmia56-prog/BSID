import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

GlobalFonts.registerFromPath(
  path.join(rootDir, 'node_modules/@fontsource/merriweather/files/merriweather-latin-700-normal.woff2'),
  'Merriweather'
);
GlobalFonts.registerFromPath(
  path.join(rootDir, 'node_modules/@fontsource/open-sans/files/open-sans-latin-400-normal.woff2'),
  'Open Sans'
);

function interpolateBox(data, width, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) {
    const topY = y0 - 2;
    const botY = y1 + 2;
    const t = (y - topY) / (botY - topY);
    for (let x = x0; x <= x1; x++) {
      const idx = (y * width + x) * 3;
      const topIdx = (topY * width + x) * 3;
      const botIdx = (botY * width + x) * 3;
      for (let c = 0; c < 3; c++) {
        data[idx + c] = Math.round(data[topIdx + c] * (1 - t) + data[botIdx + c] * t);
      }
    }
  }
}

function clearRoundedRect(data, width, x, y, w, h, r, fillRgb) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      const lx = px - x;
      const ly = py - y;
      let inside = true;
      if (lx < r && ly < r) {
        inside = (lx - r) ** 2 + (ly - r) ** 2 <= r * r;
      } else if (lx >= w - r && ly < r) {
        inside = (lx - (w - r - 1)) ** 2 + (ly - r) ** 2 <= r * r;
      } else if (lx < r && ly >= h - r) {
        inside = (lx - r) ** 2 + (ly - (h - r - 1)) ** 2 <= r * r;
      } else if (lx >= w - r && ly >= h - r) {
        inside = (lx - (w - r - 1)) ** 2 + (ly - (h - r - 1)) ** 2 <= r * r;
      }
      if (inside) {
        const idx = (py * width + px) * 3;
        data[idx] = fillRgb[0];
        data[idx + 1] = fillRgb[1];
        data[idx + 2] = fillRgb[2];
      }
    }
  }
}

async function main() {
  // 1. Process Front Reference -> Clean Blank Front Template
  const frontInput = path.join(rootDir, 'assets/originals/front-reference.jpg');
  const frontObj = await sharp(frontInput).raw().toBuffer({ resolveWithObject: true });
  const fData = Buffer.from(frontObj.data);
  const fW = frontObj.info.width;
  const fH = frontObj.info.height;

  // Clear interior of photo frame cleanly (x=53..305, y=238..552, r=24)
  clearRoundedRect(fData, fW, 53, 238, 252, 314, 24, [255, 255, 255]);
  // Clean any colored tie pixels on the bottom border line (x=150..220, y=551..555)
  for (let y = 551; y <= 555; y++) {
    for (let x = 150; x <= 220; x++) {
      const idx = (y * fW + x) * 3;
      const r = fData[idx], g = fData[idx + 1], b = fData[idx + 2];
      if (r > 50 || g > 50 || b > 50) {
        // Restore crisp black border pixel or white outside
        if (y <= 553) {
          fData[idx] = 24;
          fData[idx + 1] = 24;
          fData[idx + 2] = 24;
        }
      }
    }
  }

  // Clean Blood Droplet interior: row-by-row find leftmost & rightmost red pixel of droplet and fill inside
  const dropIdx = (372 * fW + 428) * 3;
  const dropRed = [fData[dropIdx], fData[dropIdx + 1], fData[dropIdx + 2]];
  for (let y = 382; y <= 426; y++) {
    let leftX = -1, rightX = -1;
    for (let x = 398; x <= 460; x++) {
      const idx = (y * fW + x) * 3;
      const r = fData[idx], g = fData[idx + 1], b = fData[idx + 2];
      if (r > 155 && g < 105 && b < 120) {
        if (leftX === -1) leftX = x;
        rightX = x;
      }
    }
    if (leftX !== -1 && rightX - leftX > 10) {
      for (let x = leftX + 2; x <= rightX - 2; x++) {
        const idx = (y * fW + x) * 3;
        fData[idx] = dropRed[0];
        fData[idx + 1] = dropRed[1];
        fData[idx + 2] = dropRed[2];
      }
    }
  }

  // Clean BS ID Pill line 2 (ZM0914 at y=487..526): sample row-by-row left/right purple pill color
  for (let y = 487; y <= 526; y++) {
    let leftX = -1, rightX = -1;
    for (let x = 342; x <= 518; x++) {
      const idx = (y * fW + x) * 3;
      const r = fData[idx], g = fData[idx + 1], b = fData[idx + 2];
      if (r > 80 && r < 170 && g < 45 && b > 80) {
        if (leftX === -1) leftX = x;
        rightX = x;
      }
    }
    if (leftX !== -1 && rightX - leftX > 20) {
      // Sample 4px inside left & right pill edges to preserve exact row gradient
      const sx0 = leftX + 4;
      const sx1 = rightX - 4;
      const lIdx = (y * fW + sx0) * 3;
      const rIdx = (y * fW + sx1) * 3;
      for (let x = sx0 + 1; x < sx1; x++) {
        const t = (x - sx0) / (sx1 - sx0);
        const idx = (y * fW + x) * 3;
        for (let c = 0; c < 3; c++) {
          fData[idx + c] = Math.round(fData[lIdx + c] * (1 - t) + fData[rIdx + c] * t);
        }
      }
    }
  }

  // Clean Md Nazmul Miah (y=597..645, x=60..530) smoothly
  interpolateBox(fData, fW, 60, 597, 530, 645);

  // Update Expire Date to 31-12-2029 (keeping calendar icon at x=117..143)
  for (let y = 950; y <= 988; y++) {
    const topY = 946;
    const botY = 992;
    const t = (y - topY) / (botY - topY);
    for (let x = 150; x <= 470; x++) {
      const idx = (y * fW + x) * 3;
      const topIdx = (topY * fW + x) * 3;
      const botIdx = (botY * fW + x) * 3;
      for (let c = 0; c < 3; c++) {
        fData[idx + c] = Math.round(fData[topIdx + c] * (1 - t) + fData[botIdx + c] * t);
      }
    }
  }

  const baseFrontPng = await sharp(fData, { raw: { width: fW, height: fH, channels: 3 } })
    .png()
    .toBuffer();

  const fImg = await loadImage(baseFrontPng);
  const fCanvas = createCanvas(fW, fH);
  const fCtx = fCanvas.getContext('2d');
  fCtx.drawImage(fImg, 0, 0);

  // Draw updated "Expire Date:31-12-2029" in exact Merriweather Bold 27px font
  fCtx.font = 'bold 27px Merriweather, Georgia, serif';
  fCtx.fillStyle = '#ffffff';
  fCtx.textBaseline = 'alphabetic';
  fCtx.fillText('Expire Date:31-12-2029', 153, 982);

  const finalFrontPng = fCanvas.toBuffer('image/png');
  await sharp(finalFrontPng)
    .png({ compressionLevel: 9 })
    .toFile(path.join(rootDir, 'assets/templates/template-front-default.png'));

  // 2. Process Back Reference -> Clean Blank Back Template + Extract QR Center Seal
  const backInput = path.join(rootDir, 'assets/originals/back-reference.jpg');
  const backObj = await sharp(backInput).raw().toBuffer({ resolveWithObject: true });
  const bData = Buffer.from(backObj.data);
  const bW = backObj.info.width;
  const bH = backObj.info.height;

  await sharp(backInput)
    .extract({ left: 451, top: 289, width: 36, height: 36 })
    .png()
    .toFile(path.join(rootDir, 'assets/templates/qr-center-seal.png'));

  interpolateBox(bData, bW, 102, 227, 336, 256);
  interpolateBox(bData, bW, 102, 335, 336, 364);
  interpolateBox(bData, bW, 102, 439, 336, 467);
  interpolateBox(bData, bW, 100, 510, 535, 545);
  interpolateBox(bData, bW, 100, 676, 535, 718);

  for (let y = 218; y <= 398; y++) {
    for (let x = 380; x <= 560; x++) {
      const idx = (y * bW + x) * 3;
      bData[idx] = 255;
      bData[idx + 1] = 255;
      bData[idx + 2] = 255;
    }
  }

  // Update Issue Date to 15-11-2026 (interpolate away old date)
  for (let y = 770; y <= 810; y++) {
    const topY = 766;
    const botY = 814;
    const t = (y - topY) / (botY - topY);
    for (let x = 55; x <= 495; x++) {
      const idx = (y * bW + x) * 3;
      const topIdx = (topY * bW + x) * 3;
      const botIdx = (botY * bW + x) * 3;
      for (let c = 0; c < 3; c++) {
        bData[idx + c] = Math.round(bData[topIdx + c] * (1 - t) + bData[botIdx + c] * t);
      }
    }
  }

  const baseBackPng = await sharp(bData, { raw: { width: bW, height: bH, channels: 3 } })
    .png()
    .toBuffer();

  const bImg = await loadImage(baseBackPng);
  const bCanvas = createCanvas(bW, bH);
  const bCtx = bCanvas.getContext('2d');
  bCtx.drawImage(bImg, 0, 0);

  // Draw updated "Issue Date: 15-11-2026" in exact Open Sans 38px font
  bCtx.font = '400 38px "Open Sans", Arial, sans-serif';
  bCtx.fillStyle = '#000000';
  bCtx.textAlign = 'center';
  bCtx.textBaseline = 'middle';
  bCtx.fillText('Issue Date: 15-11-2026', 295.5, 791);

  const finalBackPng = bCanvas.toBuffer('image/png');
  await sharp(finalBackPng)
    .png({ compressionLevel: 9 })
    .toFile(path.join(rootDir, 'assets/templates/template-back-default.png'));

  console.log('Templates rebuilt cleanly!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
