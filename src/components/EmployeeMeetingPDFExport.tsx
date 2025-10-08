import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';

interface EmployeeMeetingPDFExportProps {
  meeting: any;
  protocolData: any;
  actionItems: any[];
  employeePrep?: any;
  supervisorPrep?: any;
}

export function EmployeeMeetingPDFExport({
  meeting,
  protocolData,
  actionItems,
  employeePrep,
  supervisorPrep,
}: EmployeeMeetingPDFExportProps) {
  
  const generatePDF = () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const pageWidth = 210;
    const pageHeight = 297;
    const leftMargin = 25;
    const rightMargin = 20;
    const contentWidth = pageWidth - leftMargin - rightMargin;
    let currentY = 20;
    
    // Helper: Add text with wrapping
    const addText = (text: string, x: number, y: number, maxWidth: number, fontSize = 11) => {
      pdf.setFontSize(fontSize);
      const lines = pdf.splitTextToSize(text, maxWidth);
      pdf.text(lines, x, y);
      return y + (lines.length * (fontSize * 0.4));
    };
    
    // Helper: Add section
    const addSection = (title: string, content: string) => {
      // Check page break
      if (currentY > pageHeight - 40) {
        pdf.addPage();
        currentY = 20;
      }
      
      // Title
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text(title, leftMargin, currentY);
      currentY += 7;
      
      // Content
      pdf.setFont('helvetica', 'normal');
      if (content && content.trim()) {
        currentY = addText(content, leftMargin, currentY, contentWidth, 11);
      } else {
        pdf.setTextColor(150, 150, 150);
        currentY = addText('- Keine Angaben -', leftMargin, currentY, contentWidth, 10);
        pdf.setTextColor(0, 0, 0);
      }
      
      currentY += 8;
    };
    
    // ============ HEADER ============
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('Mitarbeitergespräch - Protokoll', leftMargin, currentY);
    currentY += 12;
    
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Mitarbeiter: ${meeting.employee?.display_name || 'N/A'}`, leftMargin, currentY);
    currentY += 6;
    pdf.text(`Gesprächsleitung: ${meeting.supervisor?.display_name || 'N/A'}`, leftMargin, currentY);
    currentY += 6;
    pdf.text(`Datum: ${format(new Date(meeting.meeting_date), 'PPP', { locale: de })}`, leftMargin, currentY);
    currentY += 6;
    pdf.text(`Gesprächstyp: ${meeting.meeting_type === 'annual_review' ? 'Jahresgespräch' : 
              meeting.meeting_type === 'probation_review' ? 'Probezeit-Gespräch' : 
              meeting.meeting_type === 'development_review' ? 'Entwicklungsgespräch' : 
              'Sonstiges'}`, leftMargin, currentY);
    currentY += 10;
    
    pdf.setDrawColor(200, 200, 200);
    pdf.line(leftMargin, currentY, pageWidth - rightMargin, currentY);
    currentY += 10;
    
    // ============ VORBEREITUNG ============
    if (employeePrep?.notes || supervisorPrep?.notes) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('Vorbereitung', leftMargin, currentY);
      currentY += 10;
      
      if (employeePrep?.notes) {
        addSection('Vorbereitung Mitarbeiter', employeePrep.notes);
      }
      
      if (supervisorPrep?.notes) {
        addSection('Vorbereitung Vorgesetzter', supervisorPrep.notes);
      }
      
      pdf.setDrawColor(200, 200, 200);
      pdf.line(leftMargin, currentY, pageWidth - rightMargin, currentY);
      currentY += 10;
    }
    
    // ============ PROTOKOLL ============
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('Gesprächsprotokoll', leftMargin, currentY);
    currentY += 10;
    
    // Befinden & Work-Life-Balance
    if (protocolData.wellbeing_mood || protocolData.wellbeing_workload || protocolData.wellbeing_balance) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.text('Befinden & Work-Life-Balance', leftMargin, currentY);
      currentY += 8;
      
      if (protocolData.wellbeing_mood) addSection('Stimmung', protocolData.wellbeing_mood);
      if (protocolData.wellbeing_workload) addSection('Arbeitsbelastung', protocolData.wellbeing_workload);
      if (protocolData.wellbeing_balance) addSection('Work-Life-Balance', protocolData.wellbeing_balance);
    }
    
    // Rückblick
    if (protocolData.review_successes || protocolData.review_challenges || protocolData.review_learnings) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.text('Rückblick', leftMargin, currentY);
      currentY += 8;
      
      if (protocolData.review_successes) addSection('Erfolge', protocolData.review_successes);
      if (protocolData.review_challenges) addSection('Herausforderungen', protocolData.review_challenges);
      if (protocolData.review_learnings) addSection('Learnings', protocolData.review_learnings);
    }
    
    // Aktuelle Projekte
    if (protocolData.projects_status || protocolData.projects_blockers || protocolData.projects_support) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.text('Aktuelle Projekte', leftMargin, currentY);
      currentY += 8;
      
      if (protocolData.projects_status) addSection('Status', protocolData.projects_status);
      if (protocolData.projects_blockers) addSection('Blockaden', protocolData.projects_blockers);
      if (protocolData.projects_support) addSection('Unterstützung', protocolData.projects_support);
    }
    
    // Entwicklung
    if (protocolData.development_skills || protocolData.development_training || protocolData.development_career) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.text('Entwicklung', leftMargin, currentY);
      currentY += 8;
      
      if (protocolData.development_skills) addSection('Skills', protocolData.development_skills);
      if (protocolData.development_training) addSection('Weiterbildung', protocolData.development_training);
      if (protocolData.development_career) addSection('Karriere', protocolData.development_career);
    }
    
    // Team & Zusammenarbeit
    if (protocolData.team_dynamics || protocolData.team_communication) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.text('Team & Zusammenarbeit', leftMargin, currentY);
      currentY += 8;
      
      if (protocolData.team_dynamics) addSection('Team-Dynamik', protocolData.team_dynamics);
      if (protocolData.team_communication) addSection('Kommunikation', protocolData.team_communication);
    }
    
    // Zielvereinbarungen
    if (protocolData.goals) {
      addSection('Zielvereinbarungen', protocolData.goals);
    }
    
    // Feedback
    if (protocolData.feedback_mutual) {
      addSection('Gegenseitiges Feedback', protocolData.feedback_mutual);
    }
    
    // Nächste Schritte
    if (protocolData.next_steps) {
      addSection('Nächste Schritte', protocolData.next_steps);
    }
    
    // ============ ACTION ITEMS ============
    if (actionItems.length > 0) {
      // Page break if needed
      if (currentY > pageHeight - 60) {
        pdf.addPage();
        currentY = 20;
      }
      
      pdf.setDrawColor(200, 200, 200);
      pdf.line(leftMargin, currentY, pageWidth - rightMargin, currentY);
      currentY += 10;
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('Vereinbarte Maßnahmen', leftMargin, currentY);
      currentY += 10;
      
      // Table header
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Maßnahme', leftMargin, currentY);
      pdf.text('Verantwortlich', leftMargin + 90, currentY);
      pdf.text('Fällig', leftMargin + 130, currentY);
      pdf.text('Status', leftMargin + 155, currentY);
      currentY += 6;
      
      pdf.setDrawColor(150, 150, 150);
      pdf.line(leftMargin, currentY, pageWidth - rightMargin, currentY);
      currentY += 5;
      
      // Action items
      pdf.setFont('helvetica', 'normal');
      actionItems.forEach((item, index) => {
        // Page break if needed
        if (currentY > pageHeight - 20) {
          pdf.addPage();
          currentY = 20;
        }
        
        const descLines = pdf.splitTextToSize(item.description, 85);
        const maxLines = Math.min(descLines.length, 3);
        
        pdf.text(descLines.slice(0, maxLines), leftMargin, currentY);
        pdf.text(item.owner === 'employee' ? 'Mitarbeiter' : 'Vorgesetzter', leftMargin + 90, currentY);
        pdf.text(item.due_date ? format(new Date(item.due_date), 'dd.MM.yy') : '-', leftMargin + 130, currentY);
        
        const statusText = item.status === 'completed' ? 'Erledigt' : 
                          item.status === 'in_progress' ? 'In Arbeit' : 'Offen';
        pdf.text(statusText, leftMargin + 155, currentY);
        
        currentY += (maxLines * 5) + 3;
      });
    }
    
    // ============ FOOTER / SIGNATURES ============
    if (currentY > pageHeight - 60) {
      pdf.addPage();
      currentY = 20;
    }
    
    currentY = pageHeight - 50;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(leftMargin, currentY, pageWidth - rightMargin, currentY);
    currentY += 10;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text('Unterschriften:', leftMargin, currentY);
    currentY += 15;
    
    const sigWidth = (contentWidth - 20) / 2;
    pdf.line(leftMargin, currentY, leftMargin + sigWidth, currentY);
    pdf.line(leftMargin + sigWidth + 20, currentY, pageWidth - rightMargin, currentY);
    currentY += 5;
    
    pdf.setFontSize(9);
    pdf.text('Mitarbeiter/in', leftMargin, currentY);
    pdf.text('Vorgesetzte/r', leftMargin + sigWidth + 20, currentY);
    
    // ============ EXPORT ============
    const filename = `Mitarbeitergespraech_${meeting.employee?.display_name?.replace(/\s/g, '_')}_${format(new Date(meeting.meeting_date), 'yyyy-MM-dd')}.pdf`;
    pdf.save(filename);
  };

  return (
    <Button onClick={generatePDF} variant="default" size="sm">
      <FileDown className="h-4 w-4 mr-2" />
      PDF exportieren
    </Button>
  );
}
