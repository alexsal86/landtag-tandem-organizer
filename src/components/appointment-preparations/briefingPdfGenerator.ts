import jsPDF from "jspdf";
import "svg2pdf.js";
import {
  AppointmentPreparation,
  getBriefingNotes,
  getConversationPartnersFromPreparationData,
  getImportantTopicLines,
} from "@/hooks/useAppointmentPreparation";
import { format } from "date-fns";
import { de } from "date-fns/locale";

// ─── Corporate Design ─────────────────────────────────────────────────────────
const GREEN         = [87, 171, 39]   as const;
const GREEN_DARK    = [26, 94, 32]    as const;
const GREEN_BG      = [237, 247, 232] as const; // legacy card background
const SECTION_HEADER_BG = [239, 244, 235] as const;
const GREEN_BG2     = [225, 240, 218] as const; // legacy darker card variant
const GREEN_LINE    = [55, 130, 30]   as const;
const BORDER_SOFT   = [205, 220, 198] as const;
const MAGENTA       = [230, 0, 126]   as const;
const WHITE         = [255, 255, 255] as const;
const TEXT_DARK     = [30, 30, 30]    as const;
const TEXT_MUTED    = [110, 120, 110] as const;

const PAGE_W  = 210;
const PAGE_H  = 297;
const MARGIN  = 14;
const CONTENT = PAGE_W - MARGIN * 2;
const GAP     = 6;
const LEFT_W  = Math.round(CONTENT * 0.52);
const RIGHT_W = CONTENT - LEFT_W - GAP;
const RIGHT_X = MARGIN + LEFT_W + GAP;
const FOOTER_Y = PAGE_H - 12;

const HEADER_FONT = "GrueneType Neue";
const HEADER_FONT_STYLE = "normal" as const;
const HEADER_FONT_FALLBACK = "PT Sans";
const HEADER_FONT_FALLBACK_STYLE = "bold" as const;
const BODY_FONT = "helvetica";

const HEADER_FONT_SOURCES = [
  // jsPDF only supports TTF — GrueneTypeNeue.ttf first, PT Sans as fallback
  { path: "/fonts/GrueneTypeNeue.ttf", family: HEADER_FONT, style: HEADER_FONT_STYLE },
  { path: "/fonts/PTSans-Bold.ttf", family: HEADER_FONT_FALLBACK, style: HEADER_FONT_FALLBACK_STYLE },
] as const;

type RegisteredFont = {
  family: string;
  style: "normal" | "bold";
};

type HeaderIconType = "date" | "time" | "location" | "pr";

const fontDataCache = new Map<string, { base64: string; vfsName: string; family: string; style: RegisteredFont["style"] }>();
const inlineSvgCache = new Map<string, SVGElement>();

const HEADER_ICON_SVGS: Record<HeaderIconType, string> = {
  date: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1A5E20" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/></svg>`,
  time: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1A5E20" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  location: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1A5E20" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
  pr: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1A5E20" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 12-5v12L3 13z"/><path d="M15 8a4.5 4.5 0 0 1 0 8"/><path d="M6 13v5a2 2 0 0 0 2 2h1"/></svg>`,
};

interface BriefingPdfOptions {
  preparation: AppointmentPreparation;
  appointmentTitle?: string;
  appointmentLocation?: string;
  appointmentStartTime?: string;
  appointmentEndTime?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function registerBriefingFonts(doc: jsPDF): Promise<RegisteredFont> {
  for (const source of HEADER_FONT_SOURCES) {
    const cachedFont = fontDataCache.get(source.path);
    if (cachedFont) {
      doc.addFileToVFS(cachedFont.vfsName, cachedFont.base64);
      doc.addFont(cachedFont.vfsName, cachedFont.family, cachedFont.style);
      return { family: cachedFont.family, style: cachedFont.style };
    }

    const fontResponse = await fetch(source.path);
    if (!fontResponse.ok) {
      continue;
    }

    const fontBytes = await fontResponse.arrayBuffer();
    const binary = Array.from(new Uint8Array(fontBytes), (byte) => String.fromCharCode(byte)).join("");
    const base64 = btoa(binary);
    const vfsName = source.path.split("/").pop() ?? "briefing-font.ttf";

    fontDataCache.set(source.path, { base64, vfsName, family: source.family, style: source.style });
    doc.addFileToVFS(vfsName, base64);
    doc.addFont(vfsName, source.family, source.style);
    return { family: source.family, style: source.style };
  }

  return { family: BODY_FONT, style: HEADER_FONT_STYLE };
}

function splitLines(text: string | undefined | null): string[] {
  if (!text) return [];
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

function rgb(doc: jsPDF, c: readonly [number, number, number], type: "fill" | "text" | "draw") {
  if (type === "fill") doc.setFillColor(c[0], c[1], c[2]);
  else if (type === "text") doc.setTextColor(c[0], c[1], c[2]);
  else doc.setDrawColor(c[0], c[1], c[2]);
}

/** Load SVG from URL, parse it, and return an SVGElement ready for svg2pdf.js */
async function loadSvgElement(src: string): Promise<SVGElement | null> {
  try {
    const resp = await fetch(src);
    if (!resp.ok) return null;
    const svgText = await resp.text();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
    return svgDoc.documentElement as unknown as SVGElement;
  } catch {
    return null;
  }
}

function cloneInlineSvgElement(type: HeaderIconType): SVGElement | null {
  const cached = inlineSvgCache.get(type);
  if (cached) {
    return cached.cloneNode(true) as SVGElement;
  }

  const svgMarkup = HEADER_ICON_SVGS[type];
  if (!svgMarkup) return null;

  try {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgMarkup, "image/svg+xml");
    const svgElement = svgDoc.documentElement as unknown as SVGElement;
    inlineSvgCache.set(type, svgElement);
    return svgElement.cloneNode(true) as SVGElement;
  } catch {
    return null;
  }
}

function ensureFit(doc: jsPDF, yRef: { y: number }, needed: number, topY: number) {
  if (yRef.y + needed > FOOTER_Y) {
    doc.addPage();
    yRef.y = topY;
  }
}

const SECTION_HEADER_H = 8.2;
const SECTION_GAP_AFTER_HEADER = 0;
const SECTION_BOTTOM_PAD = 4;
const SECTION_OUTER_GAP = 4;

// ─── Card drawing ─────────────────────────────────────────────────────────────
function drawCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  bg: readonly [number, number, number] = WHITE
) {
  rgb(doc, bg, "fill");
  doc.roundedRect(x, y, w, h, 2, 2, "F");
}

function drawSectionHeaderBar(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  label: string,
  accentColor: readonly [number, number, number] = SECTION_HEADER_BG
) {
  rgb(doc, accentColor, "fill");
  doc.rect(x, y, w, SECTION_HEADER_H + 0.6, "F");

  doc.setFontSize(7);
  doc.setFont(BODY_FONT, "bold");
  rgb(doc, accentColor === SECTION_HEADER_BG ? GREEN_DARK : WHITE, "text");
  doc.text(label.toUpperCase(), x + 4, y + 5.2);

  return y + SECTION_HEADER_H + SECTION_GAP_AFTER_HEADER;
}

function drawSectionBody(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: readonly [number, number, number] = WHITE
) {
  rgb(doc, fill, "fill");
  doc.rect(x, y, w, h, "F");

  rgb(doc, BORDER_SOFT, "draw");
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, h, "S");
}

// ─── Header (white, with logo + green line) ───────────────────────────────────
function getHeaderTitle(preparation: AppointmentPreparation, appointmentTitle?: string): string {
  return appointmentTitle?.trim() || preparation.title?.trim() || "Terminvorbereitung";
}

function formatHeaderSchedule(startTime: string | undefined, endTime: string | undefined): string | null {
  if (!startTime) return null;

  try {
    const startDate = new Date(startTime);
    if (Number.isNaN(startDate.getTime())) return null;

    const endDate = endTime ? new Date(endTime) : null;
    const hasValidEnd = endDate && !Number.isNaN(endDate.getTime()) && endDate.getTime() >= startDate.getTime();
    const endLabel = hasValidEnd ? format(endDate, "HH:mm", { locale: de }) : null;
    const durationMinutes = hasValidEnd ? Math.round((endDate.getTime() - startDate.getTime()) / 60000) : null;

    let durationLabel: string | null = null;
    if (durationMinutes !== null) {
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      durationLabel = [hours > 0 ? `${hours} Std.` : null, minutes > 0 ? `${minutes} Min.` : null].filter(Boolean).join(" ");
      if (!durationLabel) durationLabel = "0 Min.";
    }

    let schedule = `${format(startDate, "HH:mm", { locale: de })} Uhr`;
    if (endLabel) {
      schedule += ` – ${endLabel} Uhr`;
    }
    if (durationLabel) {
      schedule += ` (${durationLabel})`;
    }

    return schedule;
  } catch {
    return null;
  }
}

function getHeaderInfoLines(
  startTime: string | undefined,
  endTime: string | undefined,
  location: string | undefined
): Array<{ icon: "date" | "time" | "location"; text: string }> {
  const lines: Array<{ icon: "date" | "time" | "location"; text: string }> = [];

  if (startTime) {
    try {
      const d = new Date(startTime);
      if (!Number.isNaN(d.getTime())) {
        lines.push({ icon: "date", text: format(d, "EEEE, dd. MMMM yyyy", { locale: de }) });
      }
    } catch {
      // ignore invalid dates
    }
  }

  const scheduleLine = formatHeaderSchedule(startTime, endTime);
  if (scheduleLine) {
    lines.push({ icon: "time", text: scheduleLine });
  }

  if (location?.trim()) {
    lines.push({ icon: "location", text: location.trim() });
  }

  return lines;
}

async function drawHeaderIcon(
  doc: jsPDF,
  type: HeaderIconType,
  x: number,
  y: number,
  width = 5,
  height = 5
): Promise<boolean> {
  const svgElement = cloneInlineSvgElement(type);
  if (!svgElement) {
    return false;
  }

  svgElement.style.position = "absolute";
  svgElement.style.left = "-9999px";
  svgElement.style.top = "-9999px";
  document.body.appendChild(svgElement);

  try {
    await doc.svg(svgElement, { x, y: y - height + 0.8, width, height });
    return true;
  } catch (error) {
    console.warn(`svg2pdf.js: Icon ${type} konnte nicht eingebettet werden`, error);
    return false;
  } finally {
    document.body.removeChild(svgElement);
  }
}

function getPublicRelationsStatus(preparationData: AppointmentPreparation["preparation_data"]): string[] {
  return [
    preparationData.social_media_planned ? "Social Media geplant" : null,
    preparationData.press_planned ? "Presse geplant" : null,
  ].filter(Boolean) as string[];
}

async function drawHeader(
  doc: jsPDF,
  preparation: AppointmentPreparation,
  appointmentTitle: string | undefined,
  startTime: string | undefined,
  endTime: string | undefined,
  location: string | undefined,
  headerFont: RegisteredFont
): Promise<number> {
  const headerTop = 12;
  const headerBottomPadding = 6;
  const titleText = getHeaderTitle(preparation, appointmentTitle);
  const infoLines = getHeaderInfoLines(startTime, endTime, location);
  const logoH = 22;
  // SVG viewBox: 793.7 x 724.5 → aspect ≈ 1.096
  const logoW = logoH * 1.096;
  const logoX = MARGIN;
  const logoY = headerTop;

  // Native SVG vector embedding via svg2pdf.js
  let hasLogo = false;
  const svgElement = await loadSvgElement("/assets/logo_fraktion.svg");
  if (svgElement) {
    svgElement.style.position = "absolute";
    svgElement.style.left = "-9999px";
    svgElement.style.top = "-9999px";
    document.body.appendChild(svgElement);
    try {
      await doc.svg(svgElement, { x: logoX, y: logoY, width: logoW, height: logoH });
      hasLogo = true;
    } catch (e) {
      console.warn("svg2pdf.js: Logo-Embedding fehlgeschlagen, wird übersprungen", e);
    } finally {
      document.body.removeChild(svgElement);
    }
  }
  const effectiveLogoW = hasLogo ? logoW : 0;
  const leftBlockX = logoX + effectiveLogoW + (hasLogo ? 6 : 0);
  const rightBlockW = 48;
  const rightBlockX = PAGE_W - MARGIN - rightBlockW;
  const leftBlockW = Math.max(50, rightBlockX - leftBlockX - 8);

  doc.setFont(headerFont.family, headerFont.style);
  doc.setFontSize(20);
  rgb(doc, TEXT_DARK, "text");
  const titleLines = doc.splitTextToSize(titleText, leftBlockW);
  doc.text(titleLines, leftBlockX, headerTop + 8);

  let leftBlockBottom = headerTop + 8 + titleLines.length * 7.8;
  let infoStartY = leftBlockBottom + 2.5;
  if (infoLines.length > 0) {
    doc.setFont(BODY_FONT, "normal");
    doc.setFontSize(12);
    rgb(doc, TEXT_DARK, "text");

    let infoY = infoStartY;
    for (const infoLine of infoLines) {
      const wrapped = doc.splitTextToSize(infoLine.text, leftBlockW - 11);
      await drawHeaderIcon(doc, infoLine.icon, leftBlockX, infoY - 0.5);
      doc.text(wrapped, leftBlockX + 7.8, infoY);
      infoY += wrapped.length * 5.2 + 1.5;
    }
    leftBlockBottom = infoY - 1.5;
  }

  doc.setFont(BODY_FONT, "bold");
  doc.setFontSize(10);
  rgb(doc, TEXT_DARK, "text");
  await drawHeaderIcon(doc, "pr", rightBlockX, infoStartY - 0.5, 5.4, 5.4);
  doc.text("Öffentlichkeitsarbeit", rightBlockX + 6, infoStartY - 0.2);

  doc.setFont(BODY_FONT, "normal");
  doc.setFontSize(9);
  rgb(doc, TEXT_MUTED, "text");
  const prItems = getPublicRelationsStatus(preparation.preparation_data);
  const prItemsY = infoStartY + 5.8;
  if (prItems.length > 0) {
    doc.text(prItems, rightBlockX, prItemsY);
  }

  const headerContentBottom = Math.max(
    logoY + logoH,
    leftBlockBottom,
    prItems.length > 0 ? prItemsY + prItems.length * 4 : infoStartY + 1
  );
  const lineY = headerContentBottom + headerBottomPadding;

  rgb(doc, GREEN_LINE, "draw");
  doc.setLineWidth(0.8);
  doc.line(MARGIN, lineY, PAGE_W - MARGIN, lineY);

  return lineY + 6;
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function drawFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const y = FOOTER_Y;
  rgb(doc, GREEN_LINE, "draw");
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);

  doc.setFontSize(6.5);
  doc.setFont(BODY_FONT, "normal");
  rgb(doc, TEXT_MUTED, "text");
  doc.text("Vertraulich – Nur zur internen Verwendung", MARGIN, y + 4);
  doc.text(`${pageNum} / ${totalPages}`, PAGE_W - MARGIN, y + 4, { align: "right" });
}

// ─── Card-based bullet list ───────────────────────────────────────────────────
function addCardBulletSection(
  doc: jsPDF,
  x: number,
  maxW: number,
  label: string,
  items: string[],
  yRef: { y: number },
  topY: number,
  bodyFill: readonly [number, number, number] = WHITE,
  headerAccent: readonly [number, number, number] = SECTION_HEADER_BG
) {
  if (items.length === 0) return;

  // Estimate height
  doc.setFontSize(9);
  doc.setFont(BODY_FONT, "normal");
  let estH = SECTION_HEADER_H + SECTION_GAP_AFTER_HEADER + SECTION_BOTTOM_PAD;
  for (const item of items) {
    const lines = doc.splitTextToSize(item, maxW - 14);
    estH += lines.length * 4.5 + 1.5;
  }
  ensureFit(doc, yRef, Math.min(estH, 40), topY);

  const cardY = yRef.y;
  const bodyY = cardY + SECTION_HEADER_H + SECTION_GAP_AFTER_HEADER;
  const bodyH = Math.max(12, estH - SECTION_HEADER_H - SECTION_GAP_AFTER_HEADER);
  drawSectionHeaderBar(doc, x, cardY, maxW, label, headerAccent);
  drawSectionBody(doc, x, bodyY, maxW, bodyH, bodyFill);

  let cy = bodyY + 4.5;

  // Items
  doc.setFontSize(9);
  doc.setFont(BODY_FONT, "normal");
  rgb(doc, TEXT_DARK, "text");

  for (const item of items) {
    if (cy + 5 > cardY + estH) break; // safety
    const lines = doc.splitTextToSize(item, maxW - 14);
    rgb(doc, GREEN, "fill");
    doc.circle(x + 6, cy + 0.5, 0.7, "F");
    rgb(doc, TEXT_DARK, "text");
    doc.text(lines, x + 9.5, cy + 1.5);
    cy += lines.length * 4.5 + 1.5;
  }

  yRef.y = cardY + estH + SECTION_OUTER_GAP;
}

// ─── Card-based text section ──────────────────────────────────────────────────
function addCardTextSection(
  doc: jsPDF,
  x: number,
  maxW: number,
  label: string,
  text: string | undefined | null,
  yRef: { y: number },
  topY: number,
  bodyFill: readonly [number, number, number] = WHITE,
  headerAccent: readonly [number, number, number] = SECTION_HEADER_BG
) {
  const lines = splitLines(text);
  if (lines.length === 0) return;
  addCardBulletSection(doc, x, maxW, label, lines, yRef, topY, bodyFill, headerAccent);
}

// ─── Conversation partners card ───────────────────────────────────────────────
async function addConversationPartnersCard(
  doc: jsPDF,
  x: number,
  maxW: number,
  partners: ReturnType<typeof getConversationPartnersFromPreparationData>,
  yRef: { y: number },
  topY: number
) {
  if (partners.length === 0) return;

  const AVATAR_SIZE = 8;
  const AVATAR_PAD = 3;
  const TEXT_X_OFFSET = AVATAR_SIZE + AVATAR_PAD + 5;

  doc.setFontSize(9);
  let estH = SECTION_HEADER_H + SECTION_GAP_AFTER_HEADER + SECTION_BOTTOM_PAD;
  for (const p of partners) {
    const lineH = AVATAR_SIZE + 2;
    const secondary = [p.role, p.organization, p.note].filter(Boolean);
    estH += Math.max(lineH, 5 + (secondary.length > 0 ? 4 : 0));
  }
  estH += 3;

  ensureFit(doc, yRef, Math.min(estH, 50), topY);
  const cardY = yRef.y;
  const bodyY = cardY + SECTION_HEADER_H + SECTION_GAP_AFTER_HEADER;
  const bodyH = Math.max(14, estH - SECTION_HEADER_H - SECTION_GAP_AFTER_HEADER);
  drawSectionHeaderBar(doc, x, cardY, maxW, "Gesprächspartner");
  drawSectionBody(doc, x, bodyY, maxW, bodyH);
  let cy = bodyY + 4.5;

  // Pre-load avatar images
  const avatarImages = new Map<string, HTMLImageElement>();
  await Promise.all(
    partners.map(async (p) => {
      if (!p.avatar_url) return;
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = p.avatar_url!;
        });
        avatarImages.set(p.id, img);
      } catch {
        // skip failed avatar
      }
    })
  );

  for (const p of partners) {
    if (cy + 5 > cardY + estH) break;

    const avatarY = cy - 1;
    const avatarX = x + 5;
    const avatarImg = avatarImages.get(p.id);

    if (avatarImg) {
      // Draw circular clipped avatar
      doc.saveGraphicsState();
      // Draw circular clip path
      const clipR = AVATAR_SIZE / 2;
      const clipCx = avatarX + clipR;
      const clipCy = avatarY + clipR;
      // Use circle as clip (approximate with small rect for jsPDF compatibility)
      try {
        doc.addImage(avatarImg, "JPEG", avatarX, avatarY, AVATAR_SIZE, AVATAR_SIZE);
      } catch {
        // fallback: draw placeholder circle
        rgb(doc, GREEN_BG, "fill");
        doc.circle(clipCx, clipCy, clipR, "F");
      }
      doc.restoreGraphicsState();
      // Draw circle border
      rgb(doc, BORDER_SOFT, "draw");
      doc.setLineWidth(0.25);
      doc.circle(avatarX + clipR, avatarY + clipR, clipR, "S");
    } else {
      // Draw initials circle
      const clipR = AVATAR_SIZE / 2;
      const clipCx = avatarX + clipR;
      const clipCy = avatarY + clipR;
      rgb(doc, GREEN_BG, "fill");
      doc.circle(clipCx, clipCy, clipR, "F");
      rgb(doc, BORDER_SOFT, "draw");
      doc.setLineWidth(0.25);
      doc.circle(clipCx, clipCy, clipR, "S");
      // Draw initials
      const initials = p.name.split(" ").filter(Boolean).slice(0, 2).map((s) => s.charAt(0).toUpperCase()).join("") || "?";
      doc.setFontSize(7);
      doc.setFont(BODY_FONT, "bold");
      rgb(doc, GREEN_DARK, "text");
      doc.text(initials, clipCx, clipCy + 1, { align: "center" });
    }

    doc.setFontSize(9);
    doc.setFont(BODY_FONT, "bold");
    rgb(doc, TEXT_DARK, "text");
    doc.text(p.name, x + TEXT_X_OFFSET, cy + 2);

    const secondary = [p.role, p.organization, p.note].filter(Boolean);
    if (secondary.length > 0) {
      doc.setFontSize(7.5);
      doc.setFont(BODY_FONT, "normal");
      rgb(doc, TEXT_MUTED, "text");
      doc.text(secondary.join(" · "), x + TEXT_X_OFFSET, cy + 6);
    }

    cy += AVATAR_SIZE + 2;
  }

  yRef.y = cardY + estH + SECTION_OUTER_GAP;
}

// ─── Companions card (badges) ─────────────────────────────────────────────────
function addCompanionsCard(
  doc: jsPDF,
  x: number,
  maxW: number,
  companions: Array<{ id: string; name: string; note?: string }>,
  yRef: { y: number },
  topY: number
) {
  if (companions.length === 0) return;

  ensureFit(doc, yRef, 22, topY);
  const cardY = yRef.y;

  // Estimate badge rows
  doc.setFontSize(8);
  let bx = 5;
  let rows = 1;
  for (const c of companions) {
    const label = c.note ? `${c.name} (${c.note})` : c.name;
    const tw = doc.getTextWidth(label) + 4;
    if (bx + tw > maxW - 4) { bx = 5; rows++; }
    bx += tw + 3;
  }
  const estH = SECTION_HEADER_H + SECTION_GAP_AFTER_HEADER + rows * 8 + 7;
  const bodyY = cardY + SECTION_HEADER_H + SECTION_GAP_AFTER_HEADER;
  const bodyH = Math.max(12, estH - SECTION_HEADER_H - SECTION_GAP_AFTER_HEADER);

  drawSectionHeaderBar(doc, x, cardY, maxW, "Begleitpersonen");
  drawSectionBody(doc, x, bodyY, maxW, bodyH);
  let cy = bodyY + 5;

  doc.setFontSize(8);
  bx = x + 5;

  for (const c of companions) {
    const label = c.note ? `${c.name} (${c.note})` : c.name;
    const tw = doc.getTextWidth(label) + 4;

    if (bx + tw > x + maxW - 4) {
      bx = x + 5;
      cy += 8;
    }

    doc.setFont(BODY_FONT, "normal");
    rgb(doc, TEXT_DARK, "text");
    doc.text(label, bx, cy + 0.5);
    bx += tw;
  }

  yRef.y = cardY + estH + SECTION_OUTER_GAP;
}

// ─── Kernbotschaft (full-width, magenta accent) ───────────────────────────────
function addKernbotschaft(
  doc: jsPDF,
  x: number,
  maxW: number,
  text: string,
  yRef: { y: number },
  topY: number
) {
  if (!text.trim()) return;

  doc.setFontSize(10);
  const lines = doc.splitTextToSize(`„${text}"`, maxW - 14);
  const estH = lines.length * 5 + SECTION_HEADER_H + SECTION_GAP_AFTER_HEADER + 9;

  ensureFit(doc, yRef, estH, topY);
  const cardY = yRef.y;

  const bodyY = cardY + SECTION_HEADER_H + SECTION_GAP_AFTER_HEADER;
  const bodyH = Math.max(14, estH - SECTION_HEADER_H - SECTION_GAP_AFTER_HEADER);

  drawSectionHeaderBar(doc, x, cardY, maxW, "Kernbotschaft", MAGENTA);
  drawSectionBody(doc, x, bodyY, maxW, bodyH);

  doc.setFontSize(10);
  doc.setFont(BODY_FONT, "italic");
  rgb(doc, TEXT_DARK, "text");
  doc.text(lines, x + 5, bodyY + 6);

  yRef.y = cardY + estH + SECTION_OUTER_GAP;
}

// ─── Ablauf card ──────────────────────────────────────────────────────────────
function addAblaufCard(
  doc: jsPDF,
  x: number,
  maxW: number,
  program: Array<{ id: string; time: string; item: string; notes?: string }>,
  yRef: { y: number },
  topY: number
) {
  if (program.length === 0) return;

  doc.setFontSize(9);
  let estH = SECTION_HEADER_H + SECTION_GAP_AFTER_HEADER + SECTION_BOTTOM_PAD;
  for (const p of program) {
    const lines = doc.splitTextToSize(p.item, maxW - 19);
    estH += lines.length * 4.5 + 2;
    if (p.notes?.trim()) {
      const noteLines = doc.splitTextToSize(p.notes.trim(), maxW - 19);
      estH += noteLines.length * 3.8 + 1;
    }
  }
  estH += 3;

  ensureFit(doc, yRef, Math.min(estH, 50), topY);
  const cardY = yRef.y;
  const bodyY = cardY + SECTION_HEADER_H + SECTION_GAP_AFTER_HEADER;
  const bodyH = Math.max(14, estH - SECTION_HEADER_H - SECTION_GAP_AFTER_HEADER);
  drawSectionHeaderBar(doc, x, cardY, maxW, "Ablauf");
  drawSectionBody(doc, x, bodyY, maxW, bodyH);
  let cy = bodyY + 4.5;

  for (const p of program) {
    if (cy + 5 > cardY + estH) break;
    doc.setFontSize(8);
    doc.setFont(BODY_FONT, "bold");
    rgb(doc, GREEN_DARK, "text");
    doc.text(p.time || "", x + 5, cy + 1.5);

    doc.setFontSize(9);
    doc.setFont(BODY_FONT, "normal");
    rgb(doc, TEXT_DARK, "text");
    const descLines = doc.splitTextToSize(p.item, maxW - 19);
    doc.text(descLines, x + 15, cy + 1.5);
    cy += descLines.length * 4.5 + 2;

    // Render notes below the item
    if (p.notes?.trim()) {
      doc.setFontSize(7.5);
      doc.setFont(BODY_FONT, "italic");
      rgb(doc, TEXT_MUTED, "text");
      const noteLines = doc.splitTextToSize(p.notes.trim(), maxW - 19);
      doc.text(noteLines, x + 15, cy);
      cy += noteLines.length * 3.8 + 1;
    }
  }

  yRef.y = cardY + estH + SECTION_OUTER_GAP;
}

// ─── Checklist card ───────────────────────────────────────────────────────────
function addChecklistCard(
  doc: jsPDF,
  x: number,
  maxW: number,
  items: Array<{ id: string; label: string; completed: boolean }>,
  yRef: { y: number },
  topY: number
) {
  const openItems = items.filter((i) => !i.completed);
  if (openItems.length === 0) return;

  let estH = SECTION_HEADER_H + SECTION_GAP_AFTER_HEADER + SECTION_BOTTOM_PAD;
  for (const item of openItems) {
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(item.label, maxW - 14);
    estH += lines.length * 4.5 + 2;
  }
  estH += 3;

  ensureFit(doc, yRef, Math.min(estH, 40), topY);
  const cardY = yRef.y;
  const bodyY = cardY + SECTION_HEADER_H + SECTION_GAP_AFTER_HEADER;
  const bodyH = Math.max(12, estH - SECTION_HEADER_H - SECTION_GAP_AFTER_HEADER);
  drawSectionHeaderBar(doc, x, cardY, maxW, "Offene To-dos");
  drawSectionBody(doc, x, bodyY, maxW, bodyH);
  let cy = bodyY + 4.5;

  doc.setFontSize(9);
  for (const item of openItems) {
    if (cy + 5 > cardY + estH) break;
    // Checkbox
    rgb(doc, TEXT_MUTED, "draw");
    doc.setLineWidth(0.3);
    doc.rect(x + 5, cy - 1.5, 3.5, 3.5);

    doc.setFont(BODY_FONT, "normal");
    rgb(doc, TEXT_DARK, "text");
    const lines = doc.splitTextToSize(item.label, maxW - 16);
    doc.text(lines, x + 11, cy + 1);
    cy += lines.length * 4.5 + 2;
  }

  yRef.y = cardY + estH + SECTION_OUTER_GAP;
}

// ─── Lined notes area ─────────────────────────────────────────────────────────
function addNotesArea(
  doc: jsPDF,
  x: number,
  maxW: number,
  yRef: { y: number },
  topY: number
) {
  const availableH = FOOTER_Y - yRef.y - SECTION_OUTER_GAP;
  const estH = Math.max(40, availableH);
  ensureFit(doc, yRef, estH, topY);
  const cardY = yRef.y;
  const bodyY = cardY + SECTION_HEADER_H + SECTION_GAP_AFTER_HEADER;
  const bodyH = Math.max(28, estH - SECTION_HEADER_H - SECTION_GAP_AFTER_HEADER);
  drawSectionHeaderBar(doc, x, cardY, maxW, "Notizen");
  drawSectionBody(doc, x, bodyY, maxW, bodyH);

  // Draw lines
  rgb(doc, [200, 215, 195], "draw");
  doc.setLineWidth(0.2);
  for (let ly = bodyY + 6; ly < bodyY + bodyH - 3; ly += 6) {
    doc.line(x + 5, ly, x + maxW - 5, ly);
  }

  yRef.y = cardY + estH + SECTION_OUTER_GAP;
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export async function generateBriefingPdf({
  preparation,
  appointmentTitle,
  appointmentLocation,
  appointmentStartTime,
  appointmentEndTime,
}: BriefingPdfOptions): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const headerFont = await registerBriefingFonts(doc);
  const d = preparation.preparation_data;
  const topY = 14; // Y for new pages

  // ── Header ──────────────────────────────────────────────────────────────────
  const startY = await drawHeader(doc, preparation, appointmentTitle, appointmentStartTime, appointmentEndTime, appointmentLocation, headerFont);

  const leftY  = { y: startY };
  const rightY = { y: startY };

  // ── LEFT COLUMN ─────────────────────────────────────────────────────────────

  // 1. Gesprächspartner
  const partners = getConversationPartnersFromPreparationData(d);
  await addConversationPartnersCard(doc, MARGIN, LEFT_W, partners, leftY, topY);

  // 2. Gesprächspunkte (talking_points + important topics)
  const talkingLines = [
    ...splitLines(d.talking_points),
    ...getImportantTopicLines(d),
  ];
  addCardBulletSection(doc, MARGIN, LEFT_W, "Gesprächspunkte", talkingLines, leftY, topY);

  // 3. Was will ich erreichen? (objectives)
  addCardTextSection(doc, MARGIN, LEFT_W, "Was will ich erreichen?", d.objectives, leftY, topY);

  // 4. Kernbotschaft
  const keyMessage = d.key_topics?.trim();
  if (keyMessage) {
    addKernbotschaft(doc, MARGIN, LEFT_W, keyMessage, leftY, topY);
  }

  // 5. Meine Position / Linie
  addCardTextSection(doc, MARGIN, LEFT_W, "Meine Position / Linie", d.position_statements, leftY, topY);

  // 6. Hintergrund (audience + facts)
  const bgLines: string[] = [];
  if (d.audience) bgLines.push(d.audience);
  if (d.facts_figures) bgLines.push(...splitLines(d.facts_figures));
  addCardBulletSection(doc, MARGIN, LEFT_W, "Hintergrund", bgLines, leftY, topY);

  // 7. Kritische Fragen
  addCardTextSection(doc, MARGIN, LEFT_W, "Kritische Fragen & Antworten", d.questions_answers, leftY, topY);

  // 8. Weitere Notizen
  const briefingNotes = getBriefingNotes(preparation);
  if (briefingNotes) {
    addCardBulletSection(doc, MARGIN, LEFT_W, "Weitere Notizen", splitLines(briefingNotes), leftY, topY);
  }

  // ── RIGHT COLUMN ────────────────────────────────────────────────────────────

  // 1. Anlass des Besuchs (from visit_reason data)
  const visitReasonLabel = d.visit_reason ? (({
    einladung: "Einladung der Person/Einrichtung",
    eigeninitiative: "Eigeninitiative",
    fraktionsarbeit: "Fraktionsarbeit",
    pressetermin: "Pressetermin",
  } as Record<string, string>)[d.visit_reason] ?? d.visit_reason) : "";
  const visitReasonDetails = d.visit_reason_details?.trim();
  const visitReasonLines = [visitReasonLabel, visitReasonDetails].filter(Boolean) as string[];

  if (visitReasonLines.length > 0) {
    doc.setFontSize(9);
    let estH = SECTION_HEADER_H + SECTION_GAP_AFTER_HEADER + SECTION_BOTTOM_PAD + 2;
    if (visitReasonLabel) {
      const labelLines = doc.splitTextToSize(visitReasonLabel, RIGHT_W - 10);
      estH += labelLines.length * 4.5 + 1;
    }
    if (visitReasonDetails) {
      const detailLines = doc.splitTextToSize(visitReasonDetails, RIGHT_W - 10);
      estH += detailLines.length * 4 + 1;
    }
    ensureFit(doc, rightY, estH, topY);
    const cy = rightY.y;
    const bodyY = cy + SECTION_HEADER_H + SECTION_GAP_AFTER_HEADER;
    const bodyH = Math.max(12, estH - SECTION_HEADER_H - SECTION_GAP_AFTER_HEADER);
    drawSectionHeaderBar(doc, RIGHT_X, cy, RIGHT_W, "Anlass des Besuchs");
    drawSectionBody(doc, RIGHT_X, bodyY, RIGHT_W, bodyH);

    let textY = bodyY + 5.5;
    if (visitReasonLabel) {
      doc.setFontSize(9);
      doc.setFont(BODY_FONT, "bold");
      rgb(doc, TEXT_DARK, "text");
      const labelLines = doc.splitTextToSize(visitReasonLabel, RIGHT_W - 10);
      doc.text(labelLines, RIGHT_X + 5, textY);
      textY += labelLines.length * 4.5 + 2;
    }
    if (visitReasonDetails) {
      doc.setFontSize(8.5);
      doc.setFont(BODY_FONT, "normal");
      rgb(doc, TEXT_MUTED, "text");
      const detailLines = doc.splitTextToSize(visitReasonDetails, RIGHT_W - 10);
      doc.text(detailLines, RIGHT_X + 5, textY);
    }
    rightY.y = cy + estH + SECTION_OUTER_GAP;
  }

  // 2. Begleitpersonen
  addCompanionsCard(doc, RIGHT_X, RIGHT_W, d.companions ?? [], rightY, topY);

  // 3. Ablauf
  addAblaufCard(doc, RIGHT_X, RIGHT_W, d.program ?? [], rightY, topY);

  // 4. Offene To-dos
  addChecklistCard(doc, RIGHT_X, RIGHT_W, preparation.checklist_items ?? [], rightY, topY);

  // 5. Notizen-Bereich (liniert)
  addNotesArea(doc, RIGHT_X, RIGHT_W, rightY, topY);

  // ── Footers on all pages ────────────────────────────────────────────────────
  const totalPages = (doc.internal as unknown as { pages: unknown[] }).pages.length - 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p, totalPages);
  }

  const datePrefix = appointmentStartTime ? (() => {
    const date = new Date(appointmentStartTime);
    return Number.isNaN(date.getTime()) ? "" : `${format(date, "yyyyMMdd", { locale: de })}_`;
  })() : "";
  const filename = `${datePrefix}Briefing_${getHeaderTitle(preparation, appointmentTitle).replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_")}.pdf`;
  doc.save(filename);
}
