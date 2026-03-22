import jsPDF from "jspdf";
import { AppointmentPreparation, getConversationPartnersFromPreparationData } from "@/hooks/useAppointmentPreparation";
import { format } from "date-fns";
import { de } from "date-fns/locale";

// ─── Corporate Design GRÜNE Fraktion BW ──────────────────────────────────────
const GREEN        = [87, 171, 39]   as const; // #57ab27 – hell (Akzente/Hintergrund)
const GREEN_DARK   = [26, 94, 32]    as const; // #1a5e20 – dunkel (Header-BG, Labels)
const GREEN_BG     = [240, 250, 235] as const; // heller Grün-Tint
const GREEN_MID    = [55, 130, 30]   as const; // mittleres Grün für Linien
const MAGENTA      = [230, 0, 126]   as const; // #E6007E
const WHITE        = [255, 255, 255] as const;
const TEXT_DARK    = [20, 30, 20]    as const;
const TEXT_MUTED   = [110, 120, 110] as const;
const SEPARATOR    = [210, 225, 205] as const;
const COLUMN_LINE  = [200, 220, 195] as const;

const PAGE_W  = 210;
const PAGE_H  = 297;
const MARGIN  = 16;

// Column layout
const CONTENT    = PAGE_W - MARGIN * 2;
const LEFT_RATIO = 0.56;
const GAP        = 5;
const LEFT_W     = Math.round(CONTENT * LEFT_RATIO) - GAP / 2;
const RIGHT_W    = CONTENT - LEFT_W - GAP;
const RIGHT_X    = MARGIN + LEFT_W + GAP;
const FOOTER_BOTTOM = PAGE_H - 14;

interface BriefingPdfOptions {
  preparation: AppointmentPreparation;
  appointmentTitle?: string;
  appointmentLocation?: string;
  appointmentStartTime?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function splitLines(text: string | undefined): string[] {
  if (!text) return [];
 
  return text.split("\n").map((line) => line.trim()).filter(Boolean);
}

function formatConversationPartnerLine(partner: ReturnType<typeof getConversationPartnersFromPreparationData>[number]) {
  const secondaryParts = [partner.role, partner.organization, partner.note].filter(Boolean);
  return secondaryParts.length > 0 ? `${partner.name} — ${secondaryParts.join(" • ")}` : partner.name;
}
function setFill(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}
function setDraw(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}
function setTextCol(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

// ─── Load image (async) ───────────────────────────────────────────────────────
async function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// ─── Header ───────────────────────────────────────────────────────────────────
async function drawHeader(
  doc: jsPDF,
  title: string | undefined,
  startTime: string | undefined,
  location: string | undefined
): Promise<number> {
  const HEADER_H = 46;

  // Dark-green background
  setFill(doc, GREEN_DARK);
  doc.rect(0, 0, PAGE_W, HEADER_H, "F");

  // Thin lighter-green accent strip at bottom of header
  setFill(doc, GREEN_MID);
  doc.rect(0, HEADER_H, PAGE_W, 1.8, "F");

  // ── Logo (left) ─────────────────────────────────────────────────────────────
  const LOGO_H = 28;
  const LOGO_W = 28;  // SVG is roughly square-ish
  const LOGO_X = MARGIN;
  const LOGO_Y = (HEADER_H - LOGO_H) / 2;

  const logoImg = await loadImageElement("/assets/gruene-bw-logo.svg");
  if (logoImg) {
    try {
      doc.addImage(logoImg, "PNG", LOGO_X, LOGO_Y, LOGO_W, LOGO_H);
    } catch {
      // Fallback: draw a simple sunflower placeholder circle
      setFill(doc, GREEN);
      doc.circle(LOGO_X + LOGO_W / 2, LOGO_Y + LOGO_H / 2, LOGO_H / 2, "F");
    }
  }

  // ── "BRIEFING" (next to logo) ────────────────────────────────────────────────
  const TEXT_X = LOGO_X + LOGO_W + 5;

  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  setTextCol(doc, WHITE);
  doc.text("BRIEFING", TEXT_X, 22);

  // ── Termin-Info-Block (below BRIEFING) ──────────────────────────────────────
  let infoLine = "";
  if (title)     infoLine += title;
  if (startTime) {
    try {
      const dateStr = format(new Date(startTime), "EEEE, dd. MMMM yyyy", { locale: de });
      const timeStr = format(new Date(startTime), "HH:mm", { locale: de });
      infoLine += (infoLine ? "  ·  " : "") + dateStr + "  ·  " + timeStr + " Uhr";
    } catch { /* ignore */ }
  }
  if (location)  infoLine += (infoLine ? "  ·  " : "") + location;

  if (infoLine) {
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    setTextCol(doc, [180, 225, 160]);
    const infoLines = doc.splitTextToSize(infoLine, PAGE_W - TEXT_X - MARGIN - 2);
    doc.text(infoLines, TEXT_X, 32);
  }

  return HEADER_H + 1.8;
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function drawFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const y = PAGE_H - 9;
  setDraw(doc, GREEN_MID);
  doc.setLineWidth(0.35);
  doc.line(MARGIN, y - 2, PAGE_W - MARGIN, y - 2);

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  setTextCol(doc, TEXT_MUTED);
  doc.text("Vertraulich – Nur zur internen Verwendung", MARGIN, y + 1);
  doc.text(`${pageNum} / ${totalPages}`, PAGE_W - MARGIN, y + 1, { align: "right" });
}

// ─── Column divider line (drawn once per page) ────────────────────────────────
function drawColumnDivider(doc: jsPDF, fromY: number) {
  const divX = MARGIN + LEFT_W + GAP / 2;
  setDraw(doc, COLUMN_LINE);
  doc.setLineWidth(0.25);
  doc.line(divX, fromY, divX, FOOTER_BOTTOM - 2);
}

// ─── Section label ────────────────────────────────────────────────────────────
function drawSectionLabel(
  doc: jsPDF,
  x: number,
  y: number,
  label: string,
  accent: readonly [number, number, number] = GREEN
): number {
  const BAR_H = 5;
  setFill(doc, accent);
  doc.rect(x, y, 2.5, BAR_H, "F");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  setTextCol(doc, GREEN_DARK);
  doc.text(label.toUpperCase(), x + 4.5, y + 3.5);

  return y + BAR_H + 2.5;
}

// ─── Separator line ───────────────────────────────────────────────────────────
function drawSeparator(doc: jsPDF, x: number, y: number, width: number): number {
  setDraw(doc, SEPARATOR);
  doc.setLineWidth(0.25);
  doc.line(x, y, x + width, y);
  return y + 4;
}

// ─── addPage helper – returns new startY ─────────────────────────────────────
function newPage(doc: jsPDF, headerH: number): number {
  doc.addPage();
  return headerH + 6;
}

// ─── COLUMN HELPERS ───────────────────────────────────────────────────────────
// All section functions work within a given column (x, maxW)

// Bullet list section
function addBulletSection(
  doc: jsPDF,
  x: number,
  maxW: number,
  label: string,
  items: string[],
  yRef: { y: number },
  headerH: number,
  accent?: readonly [number, number, number]
): boolean {
  if (items.length === 0) return false;

  if (yRef.y + 18 > FOOTER_BOTTOM) yRef.y = newPage(doc, headerH);
  yRef.y = drawSectionLabel(doc, x, yRef.y, label, accent);

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  setTextCol(doc, TEXT_DARK);

  for (const item of items) {
    if (yRef.y + 6 > FOOTER_BOTTOM) yRef.y = newPage(doc, headerH);
    const lines = doc.splitTextToSize(item, maxW - 8);
    setFill(doc, GREEN);
    doc.circle(x + 5.5, yRef.y - 1, 0.9, "F");
    setTextCol(doc, TEXT_DARK);
    doc.text(lines, x + 9, yRef.y);
    yRef.y += lines.length * 5 + 1;
  }

  yRef.y += 3;
  return true;
}

// Kernbotschaft box
function addKernbotschaft(
  doc: jsPDF,
  x: number,
  maxW: number,
  text: string,
  yRef: { y: number },
  headerH: number
) {
  if (!text.trim()) return;

  if (yRef.y + 22 > FOOTER_BOTTOM) yRef.y = newPage(doc, headerH);
  yRef.y = drawSectionLabel(doc, x, yRef.y, "Kernbotschaft");

  const lines = doc.splitTextToSize(`„${text}"`, maxW - 10);
  const boxH = lines.length * 5.5 + 10;

  if (yRef.y + boxH > FOOTER_BOTTOM) yRef.y = newPage(doc, headerH);

  setFill(doc, GREEN_BG);
  doc.roundedRect(x, yRef.y, maxW, boxH, 2, 2, "F");

  setFill(doc, MAGENTA);
  doc.roundedRect(x, yRef.y, 3, boxH, 1, 1, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  setTextCol(doc, [35, 35, 35]);
  doc.text(lines, x + 7, yRef.y + 6.5);

  yRef.y += boxH + 5;
}

// Persons as badges (generic: for Begleitpersonen or Gesprächspartner)
function addPersonBadges(
  doc: jsPDF,
  x: number,
  maxW: number,
  label: string,
  persons: Array<{ display: string }>,
  yRef: { y: number },
  headerH: number,
  accentColor: readonly [number, number, number] = GREEN
) {
  if (persons.length === 0) return;

  if (yRef.y + 18 > FOOTER_BOTTOM) yRef.y = newPage(doc, headerH);
  yRef.y = drawSectionLabel(doc, x, yRef.y, label, accentColor);

  doc.setFontSize(9);
  let bx = x + 1;

  for (const p of persons) {
    const tw = doc.getTextWidth(p.display) + 6;

    if (bx + tw > x + maxW) {
      bx = x + 1;
      yRef.y += 8;
    }
    if (yRef.y + 8 > FOOTER_BOTTOM) yRef.y = newPage(doc, headerH);

    setFill(doc, GREEN_BG);
    setDraw(doc, SEPARATOR);
    doc.setLineWidth(0.25);
    doc.roundedRect(bx, yRef.y - 4, tw, 6, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "normal");
    setTextCol(doc, GREEN_DARK);
    doc.text(p.display, bx + 3, yRef.y);

    bx += tw + 3;
  }

  yRef.y += 10;
}

// Ablauf section (right column)
function addAblauf(
  doc: jsPDF,
  x: number,
  maxW: number,
  program: Array<{ time: string; item: string; notes?: string }>,
  yRef: { y: number },
  headerH: number
) {
  if (program.length === 0) return;

  if (yRef.y + 18 > FOOTER_BOTTOM) yRef.y = newPage(doc, headerH);
  yRef.y = drawSectionLabel(doc, x, yRef.y, "Ablauf");

  for (const p of program) {
    if (yRef.y + 6 > FOOTER_BOTTOM) yRef.y = newPage(doc, headerH);

    // Time
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    setTextCol(doc, GREEN_DARK);
    doc.text(p.time, x + 1, yRef.y);

    // Dot
    setTextCol(doc, TEXT_MUTED);
    doc.setFont("helvetica", "normal");
    doc.text("·", x + 15, yRef.y);

    // Description
    setTextCol(doc, TEXT_DARK);
    const descW = maxW - 20;
    const descLines = doc.splitTextToSize(p.item, descW);
    doc.text(descLines, x + 19, yRef.y);
    yRef.y += descLines.length * 4.8 + 1;

    // Optional notes in muted style
    if (p.notes && p.notes.trim()) {
      if (yRef.y + 5 > FOOTER_BOTTOM) yRef.y = newPage(doc, headerH);
      doc.setFontSize(8);
      setTextCol(doc, TEXT_MUTED);
      const noteLines = doc.splitTextToSize(p.notes, descW);
      doc.text(noteLines, x + 19, yRef.y);
      yRef.y += noteLines.length * 4.2 + 1;
    }
  }

  yRef.y += 3;
}

// Simple text section (for Hintergrund, Fakten, etc.)
function addTextSection(
  doc: jsPDF,
  x: number,
  maxW: number,
  label: string,
  text: string,
  yRef: { y: number },
  headerH: number,
  accent?: readonly [number, number, number]
): boolean {
  const lines = splitLines(text);
  if (lines.length === 0) return false;
  return addBulletSection(doc, x, maxW, label, lines, yRef, headerH, accent);
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

  // ── Header ─────────────────────────────────────────────────────────────────
  const headerEndY = await drawHeader(doc, appointmentTitle, appointmentStartTime, appointmentLocation);
  const startY = headerEndY + 6;

  // Column Y trackers
  const leftY  = { y: startY };
  const rightY = { y: startY };

  // Draw the column divider on page 1 (we'll add it on new pages too)
  drawColumnDivider(doc, startY - 2);

  // Track which page each column is on to redraw divider when needed
  let lastDividerPage = 1;
  const ensureDivider = () => {
    const currentPage = (doc.internal as { getCurrentPageInfo: () => { pageNumber: number } }).getCurrentPageInfo().pageNumber;
    if (currentPage !== lastDividerPage) {
      lastDividerPage = currentPage;
      drawColumnDivider(doc, 12);
    }
  };

  // ── RIGHT COLUMN: Hintergrund + Ablauf ────────────────────────────────────

  // Hintergrund
  const bgLines: string[] = [];
  if (d.audience)       bgLines.push(d.audience);
  if (d.facts_figures)  bgLines.push(...splitLines(d.facts_figures));

  if (bgLines.length > 0) {
    addBulletSection(doc, RIGHT_X, RIGHT_W, "Hintergrund", bgLines, rightY, startY);
    rightY.y = drawSeparator(doc, RIGHT_X, rightY.y, RIGHT_W);
  }

  // Ablauf
  addAblauf(doc, RIGHT_X, RIGHT_W, d.program ?? [], rightY, startY);

  // ── LEFT COLUMN: Ziele, Position, Kernbotschaft, Personen ─────────────────

  // Ziele / Was will ich erreichen?
  const objectiveLines = splitLines(d.objectives);
  if (objectiveLines.length > 0) {
    ensureDivider();
    addBulletSection(doc, MARGIN, LEFT_W, "Was will ich erreichen?", objectiveLines, leftY, startY);
    leftY.y = drawSeparator(doc, MARGIN, leftY.y, LEFT_W);
  }

  // Meine Position
  const positionLines = splitLines(d.position_statements);
  if (positionLines.length > 0) {
    ensureDivider();
    addBulletSection(doc, MARGIN, LEFT_W, "Meine Position / Linie", positionLines, leftY, startY);
    leftY.y = drawSeparator(doc, MARGIN, leftY.y, LEFT_W);
  }

  // Mögliche kritische Fragen
  const questionLines = splitLines(d.questions_answers);
  if (questionLines.length > 0) {
    ensureDivider();
    addBulletSection(doc, MARGIN, LEFT_W, "Kritische Fragen & Antworten", questionLines, leftY, startY);
    leftY.y = drawSeparator(doc, MARGIN, leftY.y, LEFT_W);
  }

  // Kernbotschaft
  const keyMessage = d.key_topics?.trim();
  if (keyMessage) {
    ensureDivider();
    addKernbotschaft(doc, MARGIN, LEFT_W, keyMessage, leftY, startY);
    leftY.y = drawSeparator(doc, MARGIN, leftY.y, LEFT_W);
  }

  // Gesprächspartner (conversation_partners array, with fallback to legacy fields)
  const conversationPartners = getConversationPartnersFromPreparationData(d);
  const gesprächspartnerList = conversationPartners.map((p) => ({
    display: formatConversationPartnerLine(p),
  }));

  if (gesprächspartnerList.length > 0) {
    ensureDivider();
    addPersonBadges(
      doc, MARGIN, LEFT_W,
      "Gesprächspartner",
      gesprächspartnerList,
      leftY, startY,
      [0, 120, 80]  // teal accent to visually distinguish from Begleitpersonen
    );
    leftY.y = drawSeparator(doc, MARGIN, leftY.y, LEFT_W);
  }

  // Begleitpersonen
  const begleitList = (d.companions ?? []).map((c) => ({
    display: c.note ? `${c.name} (${c.note})` : c.name,
  }));
  if (begleitList.length > 0) {
    ensureDivider();
    addPersonBadges(doc, MARGIN, LEFT_W, "Begleitpersonen", begleitList, leftY, startY);
  }

  // Talking points & Materials (if present, add below in left col)
  const talkingLines = splitLines(d.talking_points);
  if (talkingLines.length > 0) {
    leftY.y = drawSeparator(doc, MARGIN, leftY.y, LEFT_W);
    addBulletSection(doc, MARGIN, LEFT_W, "Gesprächspunkte", talkingLines, leftY, startY);
  }

  const materialsLines = splitLines(d.materials_needed);
  if (materialsLines.length > 0) {
    leftY.y = drawSeparator(doc, MARGIN, leftY.y, LEFT_W);
    addBulletSection(doc, MARGIN, LEFT_W, "Materialien", materialsLines, leftY, startY);
  }

  // Logistik (travel_time, follow_up)
  const logistikLines: string[] = [];
  if (d.travel_time) logistikLines.push(`Fahrzeit: ${d.travel_time}`);
  if (d.has_parking !== undefined) logistikLines.push(d.has_parking ? "Parkplatz vorhanden" : "Kein Parkplatz");
  if (d.follow_up) logistikLines.push(...splitLines(d.follow_up));

  if (logistikLines.length > 0) {
    leftY.y = drawSeparator(doc, MARGIN, leftY.y, LEFT_W);
    addBulletSection(doc, MARGIN, LEFT_W, "Logistik", logistikLines, leftY, startY);
  }

  // ── Footers on all pages ──────────────────────────────────────────────────
  const totalPages = (doc.internal as unknown as { pages: unknown[] }).pages.length - 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p, totalPages);
  }

  const filename = `Briefing_${(appointmentTitle || preparation.title || "Termin").replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_")}.pdf`;
  doc.save(filename);
}
