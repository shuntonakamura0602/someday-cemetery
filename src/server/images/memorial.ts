import "server-only";

import sharp from "sharp";

import { DESIGNS, buildMemorialImageModel, wrapText, type PublicGraveDto } from "@/domain";

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]!);
}

function approximateWidth(text: string, fontSize: number) {
  return Array.from(text).reduce((sum, character) => sum + (/[\p{Script=Han}\p{Emoji_Presentation}]/u.test(character) ? 1 : /[MW]/.test(character) ? 0.86 : /[il.,']/u.test(character) ? 0.28 : 0.56) * fontSize, 0);
}

function textLines(lines: string[], y: number, lineHeight: number, fontSize: number, family: string, weight: number, fill: string) {
  return lines.map((line, index) =>
    `<text x="600" y="${y + index * lineHeight}" text-anchor="middle" font-family="${family}" font-size="${fontSize}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`,
  ).join("");
}

export function memorialSvg(grave: PublicGraveDto) {
  const model = buildMemorialImageModel(grave);
  const colors = DESIGNS[model.style].colors;
  let titleSize = 60;
  let epitaphSize = 28;
  let titleLines: string[] = [];
  let epitaphLines: string[] = [];
  do {
    titleLines = wrapText(model.title, 550, (text) => approximateWidth(text, titleSize));
    epitaphLines = model.epitaph ? wrapText(model.epitaph, 560, (text) => approximateWidth(text, epitaphSize)) : [];
    const height = titleLines.length * titleSize * 1.08 + epitaphLines.length * epitaphSize * 1.3;
    if (height <= 260) break;
    titleSize = Math.max(34, titleSize - 2);
    epitaphSize = Math.max(19, epitaphSize - 1);
  } while (titleSize > 34 || epitaphSize > 19);

  const titleY = model.isExample ? 240 : 220;
  const titleHeight = titleLines.length * titleSize * 1.08;
  const epitaphY = titleY + titleHeight + 8;
  const date = [model.startedYear ? `Started ${model.startedYear}` : null, `Laid to rest ${model.buriedDate}`].filter(Boolean).join("  ·  ");
  const decorative = model.style === "moss"
    ? `<path d="M300 130c60-42 144-15 201 8-43 5-88 23-126 47-27-26-54-29-75-55z" fill="${colors.detail}" opacity=".82"/>`
    : model.style === "wildflowers"
      ? `<g transform="translate(830 470)" fill="${colors.detail}"><circle r="12"/><circle cx="32" cy="-18" r="9"/><circle cx="55" cy="7" r="11"/></g>`
      : model.style === "lantern"
        ? `<g transform="translate(820 435)"><rect width="58" height="78" rx="8" fill="#343833"/><rect x="10" y="12" width="38" height="49" rx="4" fill="${colors.glow}"/><circle cx="29" cy="36" r="38" fill="${colors.glow}" opacity=".18"/></g>`
        : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#152322"/><stop offset=".56" stop-color="#263a31"/><stop offset="1" stop-color="#0e1715"/></linearGradient>
      <linearGradient id="stone" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colors.detail}"/><stop offset=".35" stop-color="${colors.stone}"/><stop offset="1" stop-color="#626d67"/></linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="20"/></filter>
    </defs>
    <rect width="1200" height="630" fill="url(#sky)"/>
    <circle cx="1015" cy="92" r="55" fill="#ded9c4" opacity=".72"/>
    <circle cx="1015" cy="92" r="78" fill="#ded9c4" opacity=".13" filter="url(#glow)"/>
    <path d="M0 555c180-82 350-25 571-3 227 23 409-52 629 3v75H0z" fill="#142219"/>
    <g opacity=".7" fill="#1b351f"><path d="M0 500c36-164 114-206 176-44v84H0z"/><path d="M1024 495c57-171 129-189 176-32v85h-176z"/></g>
    <ellipse cx="600" cy="535" rx="350" ry="60" fill="${colors.glow}" opacity=".08" filter="url(#glow)"/>
    <path d="M300 520V205c0-100 73-165 300-165s300 65 300 165v315z" fill="url(#stone)" stroke="#d8e5cd" stroke-opacity=".16" stroke-width="3"/>
    <path d="M325 500V215c0-85 64-145 275-145s275 60 275 145v285" fill="none" stroke="#f1eee4" stroke-opacity=".12" stroke-width="3"/>
    ${decorative}
    <text x="600" y="135" text-anchor="middle" font-family="system-ui, sans-serif" font-size="21" font-weight="700" letter-spacing="5" fill="#f1eee4">SOMEDAY CEMETERY</text>
    ${model.isExample ? `<rect x="540" y="158" width="120" height="30" rx="15" fill="#594b2e"/><text x="600" y="179" text-anchor="middle" font-family="system-ui, sans-serif" font-size="15" font-weight="700" letter-spacing="3" fill="#efd6a0">EXAMPLE</text>` : ""}
    ${textLines(titleLines, titleY, titleSize * 1.08, titleSize, "Georgia, serif", 600, "#f7f2e8")}
    ${textLines(epitaphLines, epitaphY, epitaphSize * 1.3, epitaphSize, "system-ui, sans-serif", 400, "#ede9df")}
    <text x="600" y="493" text-anchor="middle" font-family="system-ui, sans-serif" font-size="19" font-weight="500" fill="#d9ded8">${escapeXml(date)}</text>
    <path d="M260 520h680v25H260z" rx="7" fill="#66716b"/><path d="M238 544h724v20H238z" fill="#4c5751"/>
  </svg>`;
}

export async function renderMemorialPng(grave: PublicGraveDto, scale: 1 | 2) {
  return sharp(Buffer.from(memorialSvg(grave)))
    .resize(1200 * scale, 630 * scale, { fit: "fill" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}
