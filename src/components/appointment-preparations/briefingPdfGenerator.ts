import jsPDF from "jspdf";
import { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface BriefingPdfOptions {
  preparation: AppointmentPreparation;
  appointmentTitle?: string;
  appointmentLocation?: string;
  appointmentStartTime?: string;
}

function splitLines(text: string | undefined): string[] {
  if (!text) return [];
  return text.split('\n').map(l => l.trim()).filter(Boolean);
}

export function generateBriefingPdf({
  preparation,
  appointmentTitle,
  appointmentLocation,
  appointmentStartTime,
}: BriefingPdfOptions) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const d = preparation.preparation_data;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const addPageIfNeeded = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("BRIEFING", margin, y);
  y += 8;

  if (appointmentTitle) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    let subtitle = appointmentTitle;
    if (appointmentStartTime) {
      try {
        subtitle += ` · ${format(new Date(appointmentStartTime), "dd. MMMM yyyy, HH:mm", { locale: de })} Uhr`;
      } catch {}
    }
    if (appointmentLocation) subtitle += ` · ${appointmentLocation}`;
    const lines = doc.splitTextToSize(subtitle, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 2;
  }

  // Separator
  doc.setDrawColor(180);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  const addSection = (title: string, items: string[]) => {
    if (items.length === 0) return;
    addPageIfNeeded(20);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100);
    doc.text(title.toUpperCase(), margin, y);
    y += 5;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30);
    for (const item of items) {
      addPageIfNeeded(8);
      const lines = doc.splitTextToSize(`→ ${item}`, contentWidth - 4);
      doc.text(lines, margin + 2, y);
      y += lines.length * 4.5 + 1.5;
    }
    y += 4;
  };

  // Sections
  const backgroundLines = [d.audience, d.facts_figures].filter(Boolean) as string[];
  addSection("Organisation / Hintergrund", backgroundLines);
  addSection("Meine Position / Linie", splitLines(d.position_statements));
  addSection("Was will ich erreichen?", splitLines(d.objectives));
  addSection("Mögliche kritische Fragen", splitLines(d.questions_answers));

  // Kernbotschaft
  const keyMessage = d.key_topics?.trim();
  if (keyMessage) {
    addPageIfNeeded(16);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100);
    doc.text("KERNBOTSCHAFT", margin, y);
    y += 5;
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(30);
    const lines = doc.splitTextToSize(`„${keyMessage}"`, contentWidth - 6);
    doc.text(lines, margin + 4, y);
    y += lines.length * 4.5 + 6;
  }

  // Begleitpersonen
  const companions = d.companions ?? [];
  if (companions.length > 0) {
    addSection("Begleitpersonen", companions.map(c => `${c.name}${c.note ? ` (${c.note})` : ''}`));
  }

  // Ablauf
  const program = d.program ?? [];
  if (program.length > 0) {
    addPageIfNeeded(12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100);
    doc.text("ABLAUF", margin, y);
    y += 5;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30);
    for (const p of program) {
      addPageIfNeeded(6);
      doc.text(`${p.time}  ${p.item}`, margin + 2, y);
      y += 5;
    }
    y += 4;
  }

  // ToDos
  const incompleteTodos = preparation.checklist_items?.filter(i => !i.completed) ?? [];
  if (incompleteTodos.length > 0) {
    addPageIfNeeded(12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100);
    doc.text("TODOS VOR TERMIN", margin, y);
    y += 5;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30);
    for (const item of incompleteTodos) {
      addPageIfNeeded(6);
      doc.text(`☐ ${item.label}`, margin + 2, y);
      y += 5;
    }
  }

  const filename = `Briefing_${(appointmentTitle || preparation.title || "Termin").replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_")}.pdf`;
  doc.save(filename);
}
