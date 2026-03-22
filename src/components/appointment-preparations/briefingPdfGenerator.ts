import jsPDF from "jspdf";
import { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import { format } from "date-fns";
import { de } from "date-fns/locale";

// Farben – Corporate Design GRÜNE Fraktion BW
const GREEN       = [87, 171, 39]   as const; // #57ab27
const GREEN_DARK  = [55, 120, 20]   as const;
const GREEN_BG    = [240, 250, 235] as const; // heller Grün-Tint
const MAGENTA     = [230, 0, 126]   as const; // #E6007E
const WHITE       = [255, 255, 255] as const;
const TEXT_DARK   = [20, 30, 20]    as const;
const TEXT_MUTED  = [100, 110, 100] as const;
const SEPARATOR   = [220, 225, 218] as const;

const PAGE_W  = 210;
const PAGE_H  = 297;
const MARGIN  = 18;
const CONTENT = PAGE_W - MARGIN * 2;

interface BriefingPdfOptions {
  preparation: AppointmentPreparation;
  appointmentTitle?: string;
  appointmentLocation?: string;
  appointmentStartTime?: string;
}

function splitLines(text: string | undefined): string[] {
  if (!text) return [];
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
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

// ─── Header (grüner Block oben) ──────────────────────────────────────────────
function drawHeader(
  doc: jsPDF,
  title: string | undefined,
  startTime: string | undefined,
  location: string | undefined
): number {
  const headerH = 36;

  // Grüne Fläche
  setFill(doc, GREEN);
  doc.rect(0, 0, PAGE_W, headerH, "F");

  // "GRÜNE Fraktion · Landtag BW" – rechts oben, klein
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  setTextCol(doc, [200, 235, 185]);
  doc.text("GRÜNE Fraktion · Landtag Baden-Württemberg", PAGE_W - MARGIN, 8, { align: "right" });

  // "BRIEFING"
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  setTextCol(doc, WHITE);
  doc.text("BRIEFING", MARGIN, 20);

  // Untertitel: Termintitel + Datum
  if (title) {
    let subtitle = title;
    if (startTime) {
      try {
        subtitle += `  ·  ${format(new Date(startTime), "dd. MMMM yyyy, HH:mm", { locale: de })} Uhr`;
      } catch { /* ignore */ }
    }
    if (location) subtitle += `  ·  ${location}`;

    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    setTextCol(doc, [210, 240, 195]);
    const lines = doc.splitTextToSize(subtitle, CONTENT - 10);
    doc.text(lines, MARGIN, 29);
  }

  // Dünner weißer Streifen als Abschluss
  setFill(doc, [55, 120, 20]);
  doc.rect(0, headerH, PAGE_W, 1.5, "F");

  return headerH + 1.5;
}

// ─── Footer (auf jeder Seite) ─────────────────────────────────────────────────
function drawFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const footerY = PAGE_H - 10;
  setDraw(doc, GREEN);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, footerY - 2, PAGE_W - MARGIN, footerY - 2);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  setTextCol(doc, TEXT_MUTED);
  doc.text("Vertraulich – Nur zur internen Verwendung", MARGIN, footerY + 1);
  doc.text(`${pageNum} / ${totalPages}`, PAGE_W - MARGIN, footerY + 1, { align: "right" });
}

// ─── Section-Label mit grünem Akzentbalken ────────────────────────────────────
function drawSectionLabel(doc: jsPDF, y: number, label: string): number {
  const barH = 5.5;
  setFill(doc, GREEN);
  doc.rect(MARGIN, y, 3, barH, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  setTextCol(doc, GREEN_DARK);
  doc.text(label.toUpperCase(), MARGIN + 5, y + 3.8);

  return y + barH + 3;
}

// ─── Trennlinie ───────────────────────────────────────────────────────────────
function drawSeparator(doc: jsPDF, y: number): number {
  setDraw(doc, SEPARATOR);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  return y + 5;
}

// ─── Standard-Bullet-Sektion ──────────────────────────────────────────────────
function addSection(
  doc: jsPDF,
  label: string,
  items: string[],
  yRef: { y: number },
  footerBottom: number
) {
  if (items.length === 0) return;

  const addPage = (needed: number) => {
    if (yRef.y + needed > footerBottom) {
      doc.addPage();
      yRef.y = 18;
    }
  };

  addPage(20);
  yRef.y = drawSectionLabel(doc, yRef.y, label);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  setTextCol(doc, TEXT_DARK);

  for (const item of items) {
    addPage(8);
    const lines = doc.splitTextToSize(item, CONTENT - 10);

    // Grüner Bullet-Punkt
    setFill(doc, GREEN);
    doc.circle(MARGIN + 6.5, yRef.y - 1.2, 1, "F");

    setTextCol(doc, TEXT_DARK);
    doc.text(lines, MARGIN + 10, yRef.y);
    yRef.y += lines.length * 5 + 1.5;
  }

  yRef.y += 4;
}

// ─── Kernbotschaft-Box ────────────────────────────────────────────────────────
function addKernbotschaft(
  doc: jsPDF,
  text: string,
  yRef: { y: number },
  footerBottom: number
) {
  const addPage = (needed: number) => {
    if (yRef.y + needed > footerBottom) {
      doc.addPage();
      yRef.y = 18;
    }
  };

  addPage(24);
  yRef.y = drawSectionLabel(doc, yRef.y, "Kernbotschaft");

  const lines = doc.splitTextToSize(`„${text}"`, CONTENT - 16);
  const boxH = lines.length * 5.5 + 10;

  addPage(boxH + 4);

  // Hintergrund
  setFill(doc, GREEN_BG);
  doc.roundedRect(MARGIN, yRef.y, CONTENT, boxH, 2, 2, "F");

  // Magenta-Rand links
  setFill(doc, MAGENTA);
  doc.roundedRect(MARGIN, yRef.y, 3.5, boxH, 1, 1, "F");

  // Text
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "italic");
  setTextCol(doc, [40, 40, 40]);
  doc.text(lines, MARGIN + 9, yRef.y + 6.5);

  yRef.y += boxH + 6;
}

// ─── Ablauf ───────────────────────────────────────────────────────────────────
function addAblauf(
  doc: jsPDF,
  program: Array<{ time: string; item: string }>,
  yRef: { y: number },
  footerBottom: number
) {
  if (program.length === 0) return;

  const addPage = (needed: number) => {
    if (yRef.y + needed > footerBottom) {
      doc.addPage();
      yRef.y = 18;
    }
  };

  addPage(20);
  yRef.y = drawSectionLabel(doc, yRef.y, "Ablauf");

  for (const p of program) {
    addPage(7);

    // Uhrzeit in Grün
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    setTextCol(doc, GREEN_DARK);
    doc.text(p.time, MARGIN + 2, yRef.y);

    // Punkt-Trenner
    setTextCol(doc, TEXT_MUTED);
    doc.setFont("helvetica", "normal");
    doc.text("·", MARGIN + 16, yRef.y);

    // Beschreibung
    setTextCol(doc, TEXT_DARK);
    const descLines = doc.splitTextToSize(p.item, CONTENT - 24);
    doc.text(descLines, MARGIN + 20, yRef.y);
    yRef.y += descLines.length * 5 + 1;
  }

  yRef.y += 4;
}

// ─── ToDos ────────────────────────────────────────────────────────────────────
function addTodos(
  doc: jsPDF,
  todos: Array<{ label: string }>,
  yRef: { y: number },
  footerBottom: number
) {
  if (todos.length === 0) return;

  const addPage = (needed: number) => {
    if (yRef.y + needed > footerBottom) {
      doc.addPage();
      yRef.y = 18;
    }
  };

  addPage(20);
  yRef.y = drawSectionLabel(doc, yRef.y, "ToDos vor Termin");

  for (const item of todos) {
    addPage(7);

    // Grüne Checkbox (gezeichnet)
    setDraw(doc, GREEN);
    setFill(doc, WHITE);
    doc.setLineWidth(0.5);
    doc.rect(MARGIN + 2, yRef.y - 3.2, 3.5, 3.5);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    setTextCol(doc, TEXT_DARK);
    const lines = doc.splitTextToSize(item.label, CONTENT - 12);
    doc.text(lines, MARGIN + 8, yRef.y);
    yRef.y += lines.length * 5 + 1.5;
  }

  yRef.y += 4;
}

// ─── Begleitpersonen als Badge-ähnliche Darstellung ──────────────────────────
function addBegleitpersonen(
  doc: jsPDF,
  companions: Array<{ name: string; note?: string }>,
  yRef: { y: number },
  footerBottom: number
) {
  if (companions.length === 0) return;

  const addPage = (needed: number) => {
    if (yRef.y + needed > footerBottom) {
      doc.addPage();
      yRef.y = 18;
    }
  };

  addPage(20);
  yRef.y = drawSectionLabel(doc, yRef.y, "Begleitpersonen");

  doc.setFontSize(10);
  let x = MARGIN + 2;

  for (const c of companions) {
    const label = c.note ? `${c.name} (${c.note})` : c.name;
    const textW = doc.getTextWidth(label) + 6;

    if (x + textW > PAGE_W - MARGIN) {
      x = MARGIN + 2;
      yRef.y += 8;
    }
    addPage(10);

    // Badge-Hintergrund
    setFill(doc, GREEN_BG);
    setDraw(doc, SEPARATOR);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, yRef.y - 4, textW, 6, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "normal");
    setTextCol(doc, GREEN_DARK);
    doc.text(label, x + 3, yRef.y);

    x += textW + 3;
  }

  yRef.y += 10;
}

// ─── Hauptfunktion ────────────────────────────────────────────────────────────
export function generateBriefingPdf({
  preparation,
  appointmentTitle,
  appointmentLocation,
  appointmentStartTime,
}: BriefingPdfOptions) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const d = preparation.preparation_data;

  // Erster Durchlauf: Seiten zählen (grobe Schätzung via Dummy-Render nicht nötig –
  // wir zeichnen zuerst und setzen totalPages nachträglich mit internem Wert)
  const FOOTER_BOTTOM = PAGE_H - 15;

  // ── Seite 1: Header ────────────────────────────────────────────────────────
  let startY = drawHeader(doc, appointmentTitle, appointmentStartTime, appointmentLocation);
  startY += 6;

  const yRef = { y: startY };

  // Sections
  const backgroundLines = [d.audience, d.facts_figures].filter(Boolean) as string[];

  if (backgroundLines.length > 0) {
    addSection(doc, "Organisation / Hintergrund", backgroundLines, yRef, FOOTER_BOTTOM);
    yRef.y = drawSeparator(doc, yRef.y);
  }

  const positionLines = splitLines(d.position_statements);
  if (positionLines.length > 0) {
    addSection(doc, "Meine Position / Linie", positionLines, yRef, FOOTER_BOTTOM);
    yRef.y = drawSeparator(doc, yRef.y);
  }

  const objectiveLines = splitLines(d.objectives);
  if (objectiveLines.length > 0) {
    addSection(doc, "Was will ich erreichen?", objectiveLines, yRef, FOOTER_BOTTOM);
    yRef.y = drawSeparator(doc, yRef.y);
  }

  const questionLines = splitLines(d.questions_answers);
  if (questionLines.length > 0) {
    addSection(doc, "Mögliche kritische Fragen", questionLines, yRef, FOOTER_BOTTOM);
    yRef.y = drawSeparator(doc, yRef.y);
  }

  const keyMessage = d.key_topics?.trim();
  if (keyMessage) {
    addKernbotschaft(doc, keyMessage, yRef, FOOTER_BOTTOM);
    yRef.y = drawSeparator(doc, yRef.y);
  }

  addBegleitpersonen(doc, d.companions ?? [], yRef, FOOTER_BOTTOM);

  if ((d.companions ?? []).length > 0) {
    yRef.y = drawSeparator(doc, yRef.y);
  }

  addAblauf(doc, d.program ?? [], yRef, FOOTER_BOTTOM);

  const incompleteTodos = preparation.checklist_items?.filter((i) => !i.completed) ?? [];
  if (incompleteTodos.length > 0 && (d.program ?? []).length > 0) {
    yRef.y = drawSeparator(doc, yRef.y);
  }
  addTodos(doc, incompleteTodos, yRef, FOOTER_BOTTOM);

  // ── Footer auf allen Seiten nachträglich einfügen ─────────────────────────
  const totalPages = (doc.internal as unknown as { pages: unknown[] }).pages.length - 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p, totalPages);
  }

  const filename = `Briefing_${(appointmentTitle || preparation.title || "Termin").replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_")}.pdf`;
  doc.save(filename);
}
