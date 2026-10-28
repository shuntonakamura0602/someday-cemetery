"use client";

import { DESIGNS, buildMemorialImageModel, wrapText, type PublicGraveDto } from "../domain";

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function drawCenteredLines(context: CanvasRenderingContext2D, lines: string[], centerX: number, startY: number, lineHeight: number): number {
  lines.forEach((line, index) => context.fillText(line, centerX, startY + index * lineHeight));
  return startY + lines.length * lineHeight;
}

export async function createDemoImageBlob(grave: PublicGraveDto): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable in this browser.");
  const model = buildMemorialImageModel(grave);
  const colors = DESIGNS[model.style].colors;

  const background = context.createLinearGradient(0, 0, 0, 630);
  background.addColorStop(0, "#152322");
  background.addColorStop(0.55, "#23372f");
  background.addColorStop(1, "#101817");
  context.fillStyle = background;
  context.fillRect(0, 0, 1200, 630);

  context.globalAlpha = 0.3;
  context.fillStyle = "#76917a";
  for (let x = 20; x < 1200; x += 54) context.fillRect(x, 510 + (x % 4) * 6, 3, 120);
  context.globalAlpha = 1;
  context.fillStyle = "#17241f";
  context.beginPath();
  context.ellipse(600, 600, 520, 105, 0, 0, Math.PI * 2);
  context.fill();

  context.shadowColor = colors.glow;
  context.shadowBlur = model.style === "lantern" ? 34 : 10;
  context.fillStyle = colors.stone;
  roundedRect(context, 260, 90, 680, 470, 80);
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = colors.detail;
  context.globalAlpha = 0.6;
  context.lineWidth = 3;
  roundedRect(context, 280, 110, 640, 430, 65);
  context.stroke();
  context.globalAlpha = 1;

  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillStyle = "#f1eee4";
  context.font = "600 23px ui-sans-serif, system-ui, sans-serif";
  context.fillText(model.serviceName.toUpperCase(), 600, 150);
  if (model.isExample) {
    context.fillStyle = "#d8e5cd";
    context.font = "700 18px ui-sans-serif, system-ui, sans-serif";
    context.fillText("EXAMPLE", 600, 183);
  }

  let titleSize = 58;
  let epitaphSize = 29;
  let titleLines: string[] = [];
  let epitaphLines: string[] = [];
  do {
    context.font = `600 ${titleSize}px ui-serif, Georgia, serif`;
    titleLines = wrapText(model.title, 560, (text) => context.measureText(text).width);
    if (model.epitaph) {
      context.font = `400 ${epitaphSize}px ui-sans-serif, system-ui, sans-serif`;
      epitaphLines = wrapText(model.epitaph, 560, (text) => context.measureText(text).width);
    }
    const requiredHeight = titleLines.length * titleSize * 1.08
      + (epitaphLines.length ? 14 + epitaphLines.length * epitaphSize * 1.25 : 0);
    if (requiredHeight <= 270) break;
    titleSize = Math.max(32, titleSize - 2);
    epitaphSize = Math.max(19, epitaphSize - 1);
  } while (titleSize > 32 || epitaphSize > 19);
  context.font = `600 ${titleSize}px ui-serif, Georgia, serif`;
  context.fillStyle = "#f1eee4";
  const titleBottom = drawCenteredLines(context, titleLines, 600, model.isExample ? 245 : 220, titleSize * 1.12);

  let cursor = titleBottom + 12;
  if (model.epitaph) {
    context.font = `400 ${epitaphSize}px ui-sans-serif, system-ui, sans-serif`;
    context.fillStyle = "#f1eee4";
    cursor = drawCenteredLines(context, epitaphLines, 600, cursor, epitaphSize * 1.25) + 8;
  }

  context.font = "500 20px ui-sans-serif, system-ui, sans-serif";
  context.fillStyle = "#d8ded5";
  const dates = [model.startedYear ? `Started ${model.startedYear}` : "", `Laid to rest ${model.buriedDate}`].filter(Boolean).join("  ·  ");
  context.fillText(dates, 600, Math.max(cursor, 505));

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The image could not be created.")), "image/png");
  });
}

export async function downloadDemoImage(grave: PublicGraveDto): Promise<void> {
  const blob = await createDemoImageBlob(grave);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `someday-cemetery-${grave.id}.png`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
