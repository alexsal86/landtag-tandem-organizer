import jsPDF from "jspdf";
import {
  AppointmentPreparation,
  getBriefingNotes,
  getConversationPartnersFromPreparationData,
  getImportantTopicLines,
  splitPreparationTextToList,
} from "@/hooks/useAppointmentPreparation";
import { format } from "date-fns";
import { de } from "date-fns/locale";

// ─── Corporate Design ─────────────────────────────────────────────────────────
const GREEN         = [87, 171, 39]   as const;
const GREEN_DARK    = [26, 94, 32]    as const;
const GREEN_BG      = [237, 247, 232] as const; // card background
const GREEN_BG2     = [225, 240, 218] as const; // slightly darker card variant
const GREEN_LINE    = [55, 130, 30]   as const;
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

interface BriefingPdfOptions {
  preparation: AppointmentPreparation;
  appointmentTitle?: string;
  appointmentLocation?: string;
  appointmentStartTime?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function splitLines(text: string | undefined | null): string[] {
  if (!text) return [];
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

function rgb(doc: jsPDF, c: readonly [number, number, number], type: "fill" | "text" | "draw") {
  if (type === "fill") doc.setFillColor(c[0], c[1], c[2]);
  else if (type === "text") doc.setTextColor(c[0], c[1], c[2]);
  else doc.setDrawColor(c[0], c[1], c[2]);
}

async function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function ensureFit(doc: jsPDF, yRef: { y: number }, needed: number, topY: number) {
  if (yRef.y + needed > FOOTER_Y) {
    doc.addPage();
    yRef.y = topY;
  }
}

// ─── Card drawing ─────────────────────────────────────────────────────────────
function drawCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  bg: readonly [number, number, number] = GREEN_BG
) {
  rgb(doc, bg, "fill");
  doc.roundedRect(x, y, w, h, 2, 2, "F");
}

// ─── Section card with label ──────────────────────────────────────────────────
function drawCardLabel(
  doc: jsPDF,
  x: number,
  y: number,
  label: string,
  accent: readonly [number, number, number] = GREEN_DARK
) {
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  rgb(doc, accent, "text");
  doc.text(label.toUpperCase(), x + 4, y + 4.5);
  return y + 7;
}

// ─── Header (white, with logo + green line) ───────────────────────────────────
async function drawHeader(
  doc: jsPDF,
  title: string | undefined,
  startTime: string | undefined,
  location: string | undefined
): Promise<number> {
  let y = 12;

  // Logo
  const logoImg = await loadImageElement("/assets/logo_fraktion.png");
  if (logoImg) {
    try {
      const logoH = 14;
      const logoW = (logoImg.width / logoImg.height) * logoH;
      doc.addImage(logoImg, "PNG", MARGIN, y - 4, logoW, logoH);
    } catch { /* ignore */ }
  }

  // Green separator line
  y += 14;
  rgb(doc, GREEN_LINE, "draw");
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);

  // "BRIEFING" label below line
  y += 5;
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  rgb(doc, TEXT_MUTED, "text");
  doc.text("BRIEFING", PAGE_W / 2, y, { align: "center" });

  // Title (large)
  y += 6;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  rgb(doc, TEXT_DARK, "text");
  const titleText = title || "Terminvorbereitung";
  const titleLines = doc.splitTextToSize(titleText, CONTENT);
  doc.text(titleLines, PAGE_W / 2, y, { align: "center" });
  y += titleLines.length * 7;

  // Date · Time · Location
  let infoLine = "";
  if (startTime) {
    try {
      const d = new Date(startTime);
      infoLine += format(d, "EEEE, dd. MMMM yyyy", { locale: de });
      infoLine += "  ·  " + format(d, "HH:mm", { locale: de }) + " Uhr";
    } catch { /* ignore */ }
  }
  if (location) infoLine += (infoLine ? "  ·  " : "") + location;

  if (infoLine) {
    y += 1;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    rgb(doc, TEXT_MUTED, "text");
    doc.text(infoLine, PAGE_W / 2, y, { align: "center" });
    y += 5;
  }

  y += 4;
  return y;
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function drawFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const y = FOOTER_Y;
  rgb(doc, GREEN_LINE, "draw");
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
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
  bg: readonly [number, number, number] = GREEN_BG
) {
  if (items.length === 0) return;

  // Estimate height
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  let estH = 10; // label + padding
  for (const item of items) {
    const lines = doc.splitTextToSize(item, maxW - 14);
    estH += lines.length * 4.5 + 1.5;
  }
  estH += 3;

  ensureFit(doc, yRef, Math.min(estH, 40), topY);

  const cardY = yRef.y;
  // Draw card bg
  drawCard(doc, x, cardY, maxW, estH, bg);

  // Label
  let cy = drawCardLabel(doc, x, cardY, label);

  // Items
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
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

  yRef.y = cardY + estH + 4;
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
  bg: readonly [number, number, number] = GREEN_BG
) {
  const lines = splitLines(text);
  if (lines.length === 0) return;
  addCardBulletSection(doc, x, maxW, label, lines, yRef, topY, bg);
}

// ─── Conversation partners card ───────────────────────────────────────────────
function addConversationPartnersCard(
  doc: jsPDF,
  x: number,
  maxW: number,
  partners: ReturnType<typeof getConversationPartnersFromPreparationData>,
  yRef: { y: number },
  topY: number
) {
  if (partners.length === 0) return;

  doc.setFontSize(9);
  let estH = 10;
  for (const p of partners) {
    estH += 5;
    const secondary = [p.role, p.organization, p.note].filter(Boolean);
    if (secondary.length > 0) estH += 4;
  }
  estH += 3;

  ensureFit(doc, yRef, Math.min(estH, 50), topY);
  const cardY = yRef.y;
  drawCard(doc, x, cardY, maxW, estH, GREEN_BG);
  let cy = drawCardLabel(doc, x, cardY, "Gesprächspartner");

  for (const p of partners) {
    if (cy + 5 > cardY + estH) break;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    rgb(doc, TEXT_DARK, "text");
    doc.text(p.name, x + 5, cy + 1.5);
    cy += 4.5;

    const secondary = [p.role, p.organization, p.note].filter(Boolean);
    if (secondary.length > 0) {
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      rgb(doc, TEXT_MUTED, "text");
      doc.text(secondary.join(" · "), x + 5, cy + 0.5);
      cy += 4;
    }
  }

  yRef.y = cardY + estH + 4;
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
    const tw = doc.getTextWidth(label) + 8;
    if (bx + tw > maxW - 4) { bx = 5; rows++; }
    bx += tw + 3;
  }
  const estH = 10 + rows * 8 + 3;

  drawCard(doc, x, cardY, maxW, estH, GREEN_BG2);
  let cy = drawCardLabel(doc, x, cardY, "Begleitpersonen");

  doc.setFontSize(8);
  bx = x + 5;

  for (const c of companions) {
    const label = c.note ? `${c.name} (${c.note})` : c.name;
    const tw = doc.getTextWidth(label) + 8;

    if (bx + tw > x + maxW - 4) {
      bx = x + 5;
      cy += 8;
    }

    rgb(doc, WHITE, "fill");
    doc.roundedRect(bx, cy - 3.5, tw, 6.5, 1.5, 1.5, "F");
    doc.setFont("helvetica", "normal");
    rgb(doc, GREEN_DARK, "text");
    doc.text(label, bx + 4, cy + 0.5);
    bx += tw + 3;
  }

  yRef.y = cardY + estH + 4;
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
  const estH = lines.length * 5 + 14;

  ensureFit(doc, yRef, estH, topY);
  const cardY = yRef.y;

  drawCard(doc, x, cardY, maxW, estH, GREEN_BG);
  // Magenta accent bar
  rgb(doc, MAGENTA, "fill");
  doc.roundedRect(x, cardY, 3, estH, 1, 1, "F");

  drawCardLabel(doc, x + 2, cardY, "Kernbotschaft", MAGENTA);

  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  rgb(doc, TEXT_DARK, "text");
  doc.text(lines, x + 9, cardY + 10);

  yRef.y = cardY + estH + 4;
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
  let estH = 10;
  for (const p of program) {
    const lines = doc.splitTextToSize(p.item, maxW - 24);
    estH += lines.length * 4.5 + 2;
  }
  estH += 3;

  ensureFit(doc, yRef, Math.min(estH, 50), topY);
  const cardY = yRef.y;
  drawCard(doc, x, cardY, maxW, estH, GREEN_BG2);
  let cy = drawCardLabel(doc, x, cardY, "Ablauf");

  for (const p of program) {
    if (cy + 5 > cardY + estH) break;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    rgb(doc, GREEN_DARK, "text");
    doc.text(p.time || "", x + 5, cy + 1.5);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    rgb(doc, TEXT_DARK, "text");
    const descLines = doc.splitTextToSize(p.item, maxW - 24);
    doc.text(descLines, x + 20, cy + 1.5);
    cy += descLines.length * 4.5 + 2;
  }

  yRef.y = cardY + estH + 4;
}

// ─── PR badges card ───────────────────────────────────────────────────────────
function addPRCard(
  doc: jsPDF,
  x: number,
  maxW: number,
  d: AppointmentPreparation["preparation_data"],
  yRef: { y: number },
  topY: number
) {
  const badges: string[] = [];
  if (d.social_media_planned) badges.push("✓ Social Media");
  if (d.press_planned) badges.push("✓ Presse");
  if (badges.length === 0 && !d.social_media_planned && !d.press_planned) return;

  // Show even if none planned
  if (badges.length === 0) {
    badges.push("Keine Öffentlichkeitsarbeit geplant");
  }

  const estH = 18;
  ensureFit(doc, yRef, estH, topY);
  const cardY = yRef.y;
  drawCard(doc, x, cardY, maxW, estH, GREEN_BG);
  drawCardLabel(doc, x, cardY, "Öffentlichkeitsarbeit");

  doc.setFontSize(8);
  let bx = x + 5;
  const by = cardY + 12;
  for (const badge of badges) {
    const tw = doc.getTextWidth(badge) + 8;
    rgb(doc, GREEN_DARK, "fill");
    doc.roundedRect(bx, by - 3, tw, 6, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    rgb(doc, WHITE, "text");
    doc.text(badge, bx + 4, by + 1);
    bx += tw + 3;
  }

  yRef.y = cardY + estH + 4;
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

  let estH = 10;
  for (const item of openItems) {
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(item.label, maxW - 14);
    estH += lines.length * 4.5 + 2;
  }
  estH += 3;

  ensureFit(doc, yRef, Math.min(estH, 40), topY);
  const cardY = yRef.y;
  drawCard(doc, x, cardY, maxW, estH, GREEN_BG);
  let cy = drawCardLabel(doc, x, cardY, "Offene To-dos");

  doc.setFontSize(9);
  for (const item of openItems) {
    if (cy + 5 > cardY + estH) break;
    // Checkbox
    rgb(doc, TEXT_MUTED, "draw");
    doc.setLineWidth(0.3);
    doc.rect(x + 5, cy - 1.5, 3.5, 3.5);

    doc.setFont("helvetica", "normal");
    rgb(doc, TEXT_DARK, "text");
    const lines = doc.splitTextToSize(item.label, maxW - 16);
    doc.text(lines, x + 11, cy + 1);
    cy += lines.length * 4.5 + 2;
  }

  yRef.y = cardY + estH + 4;
}

// ─── Lined notes area ─────────────────────────────────────────────────────────
function addNotesArea(
  doc: jsPDF,
  x: number,
  maxW: number,
  yRef: { y: number },
  topY: number
) {
  const estH = 40;
  ensureFit(doc, yRef, estH, topY);
  const cardY = yRef.y;
  drawCard(doc, x, cardY, maxW, estH, GREEN_BG);
  drawCardLabel(doc, x, cardY, "Notizen");

  // Draw lines
  rgb(doc, [200, 215, 195], "draw");
  doc.setLineWidth(0.2);
  for (let ly = cardY + 12; ly < cardY + estH - 3; ly += 6) {
    doc.line(x + 5, ly, x + maxW - 5, ly);
  }

  yRef.y = cardY + estH + 4;
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export async function generateBriefingPdf({
  preparation,
  appointmentTitle,
  appointmentLocation,
  appointmentStartTime,
}: BriefingPdfOptions): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const d = preparation.preparation_data;
  const topY = 14; // Y for new pages

  // ── Header ──────────────────────────────────────────────────────────────────
  const startY = await drawHeader(doc, appointmentTitle, appointmentStartTime, appointmentLocation);

  const leftY  = { y: startY };
  const rightY = { y: startY };

  // ── LEFT COLUMN ─────────────────────────────────────────────────────────────

  // 1. Gesprächspartner
  const partners = getConversationPartnersFromPreparationData(d);
  addConversationPartnersCard(doc, MARGIN, LEFT_W, partners, leftY, topY);

  // 2. Gesprächspunkte (talking_points + important topics)
  const talkingLines = [
    ...splitLines(d.talking_points),
    ...getImportantTopicLines(d),
  ];
  addCardBulletSection(doc, MARGIN, LEFT_W, "Gesprächspunkte", talkingLines, leftY, topY);

  // 3. Was will ich erreichen? (objectives)
  addCardTextSection(doc, MARGIN, LEFT_W, "Was will ich erreichen?", d.objectives, leftY, topY, GREEN_BG2);

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
  addCardBulletSection(doc, MARGIN, LEFT_W, "Hintergrund", bgLines, leftY, topY, GREEN_BG2);

  // 7. Kritische Fragen
  addCardTextSection(doc, MARGIN, LEFT_W, "Kritische Fragen & Antworten", d.questions_answers, leftY, topY);

  // 8. Weitere Notizen
  const briefingNotes = getBriefingNotes(preparation);
  if (briefingNotes) {
    addCardBulletSection(doc, MARGIN, LEFT_W, "Weitere Notizen", splitLines(briefingNotes), leftY, topY, GREEN_BG);
  }

  // ── RIGHT COLUMN ────────────────────────────────────────────────────────────

  // 1. Anlass des Besuchs
  if (preparation.title?.trim()) {
    const estH = 16;
    ensureFit(doc, rightY, estH, topY);
    const cy = rightY.y;
    drawCard(doc, RIGHT_X, cy, RIGHT_W, estH, GREEN_BG2);
    drawCardLabel(doc, RIGHT_X, cy, "Anlass des Besuchs");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    rgb(doc, TEXT_DARK, "text");
    const titleLines = doc.splitTextToSize(preparation.title, RIGHT_W - 10);
    doc.text(titleLines, RIGHT_X + 5, cy + 11);
    rightY.y = cy + estH + 4;
  }

  // 2. Begleitpersonen
  addCompanionsCard(doc, RIGHT_X, RIGHT_W, d.companions ?? [], rightY, topY);

  // 3. Ablauf
  addAblaufCard(doc, RIGHT_X, RIGHT_W, d.program ?? [], rightY, topY);

  // 4. Offene To-dos
  addChecklistCard(doc, RIGHT_X, RIGHT_W, preparation.checklist_items ?? [], rightY, topY);

  // 5. Öffentlichkeitsarbeit
  addPRCard(doc, RIGHT_X, RIGHT_W, d, rightY, topY);

  // 6. Notizen-Bereich (liniert)
  addNotesArea(doc, RIGHT_X, RIGHT_W, rightY, topY);

  // ── Footers on all pages ────────────────────────────────────────────────────
  const totalPages = (doc.internal as unknown as { pages: unknown[] }).pages.length - 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p, totalPages);
  }

  const filename = `Briefing_${(appointmentTitle || preparation.title || "Termin").replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_")}.pdf`;
  doc.save(filename);
}
