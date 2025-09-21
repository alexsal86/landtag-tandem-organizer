import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker - fix version mismatch
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.js`;

export interface ParsedProtocol {
  text: string;
  pages: PageInfo[];
  metadata: ProtocolMetadata;
}

export interface PageInfo {
  pageNumber: number;
  text: string;
  hasAgendaItems: boolean;
  hasSpeeches: boolean;
  timeMarkers: string[];
}

export interface ProtocolMetadata {
  sessionNumber: string;
  date: string;
  legislature: string;
  totalPages: number;
  extractedAt: string;
}

export async function parsePDFFile(file: File): Promise<ParsedProtocol> {
  try {
    console.log('Starting PDF parsing for:', file.name);
    
    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Load PDF document
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log(`PDF loaded: ${pdf.numPages} pages`);
    
    let fullText = '';
    const pages: PageInfo[] = [];
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Combine text items with proper spacing
        const pageText = textContent.items
          .map((item: any) => {
            if ('str' in item) {
              return item.str;
            }
            return '';
          })
          .join(' ')
          .replace(/\s+/g, ' ')  // Normalize whitespace
          .trim();
        
        console.log(`Page ${pageNum}: ${pageText.length} characters`);
        
        // Analyze page content
        const pageInfo: PageInfo = {
          pageNumber: pageNum,
          text: pageText,
          hasAgendaItems: detectAgendaItems(pageText),
          hasSpeeches: detectSpeeches(pageText),
          timeMarkers: extractTimeMarkers(pageText)
        };
        
        pages.push(pageInfo);
        fullText += pageText + '\n\n';
        
      } catch (pageError) {
        console.error(`Error processing page ${pageNum}:`, pageError);
        // Continue with other pages
      }
    }
    
    // Extract metadata from filename and content
    const metadata = extractMetadata(file.name, fullText, pdf.numPages);
    
    console.log('PDF parsing completed:', {
      totalPages: pdf.numPages,
      textLength: fullText.length,
      pagesWithAgenda: pages.filter(p => p.hasAgendaItems).length,
      pagesWithSpeeches: pages.filter(p => p.hasSpeeches).length
    });
    
    return {
      text: fullText,
      pages,
      metadata
    };
    
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error(`Fehler beim Parsen der PDF: ${error.message}`);
  }
}

// Detect agenda items on a page
function detectAgendaItems(text: string): boolean {
  const agendaPatterns = [
    /\d+\.\s+[A-ZÄÖÜ]/,  // "1. Topic"
    /Tagesordnung/i,
    /TOP\s+\d+/i,
    /Punkt\s+\d+/i
  ];
  
  return agendaPatterns.some(pattern => pattern.test(text));
}

// Detect speeches on a page
function detectSpeeches(text: string): boolean {
  const speechPatterns = [
    /Abg\.\s+[A-ZÄÖÜ]/,  // "Abg. Name"
    /Ministerpräsident/i,
    /Minister\s+[A-ZÄÖÜ]/,
    /Staatssekretär/i,
    /Präsident.*:/,
    /\([A-Z]+\):/  // Party abbreviation followed by colon
  ];
  
  return speechPatterns.some(pattern => pattern.test(text));
}

// Extract time markers from text
function extractTimeMarkers(text: string): string[] {
  const timePattern = /(\d{1,2}):(\d{2})\s*Uhr/g;
  const matches: string[] = [];
  let match;
  
  while ((match = timePattern.exec(text)) !== null) {
    const time = `${match[1].padStart(2, '0')}:${match[2]}`;
    if (!matches.includes(time)) {
      matches.push(time);
    }
  }
  
  return matches.sort();
}

// Extract metadata from filename and content
function extractMetadata(filename: string, text: string, pageCount: number): ProtocolMetadata {
  // Try to extract from filename pattern: "17_0129_24072025.pdf"
  const filenameMatch = filename.match(/(\d+)_(\d+)_(\d{8})\.pdf$/);
  
  let sessionNumber = '0';
  let date = new Date().toISOString().split('T')[0];
  let legislature = '17';
  
  if (filenameMatch) {
    legislature = filenameMatch[1];
    sessionNumber = filenameMatch[2];
    
    // Parse date from DDMMYYYY format
    const dateStr = filenameMatch[3];
    const day = dateStr.slice(0, 2);
    const month = dateStr.slice(2, 4);
    const year = dateStr.slice(4, 8);
    date = `${year}-${month}-${day}`;
  } else {
    // Try to extract from content
    const sessionMatch = text.match(/(\d+)\.\s*Sitzung/);
    if (sessionMatch) {
      sessionNumber = sessionMatch[1];
    }
    
    const dateMatch = text.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, '0');
      const month = dateMatch[2].padStart(2, '0');
      const year = dateMatch[3];
      date = `${year}-${month}-${day}`;
    }
    
    const legislatureMatch = text.match(/(\d+)\.\s*Wahlperiode/);
    if (legislatureMatch) {
      legislature = legislatureMatch[1];
    }
  }
  
  return {
    sessionNumber,
    date,
    legislature,
    totalPages: pageCount,
    extractedAt: new Date().toISOString()
  };
}

// Advanced rule-based text analysis
export function analyzeProtocolStructure(text: string): {
  agendaItems: any[];
  speeches: any[];
  sessions: any[];
} {
  console.log('Starting advanced protocol analysis...');
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  const agendaItems: any[] = [];
  const speeches: any[] = [];
  const sessions: any[] = [];
  
  // Improved patterns for Baden-Württemberg protocols
  const patterns = {
    agendaItem: /^(\d+(?:\.\d+)?)\.\s+(.+)$/,
    speaker: /^(?:Abg\.|Ministerpräsident|Minister|Staatssekretär|Präsident)\s+(.+?)(?:\s*\(([^)]+)\))?\s*:/,
    time: /(\d{1,2}):(\d{2})\s*Uhr/,
    sessionEvent: /(Sitzungsbeginn|Sitzungsende|Unterbrechung|Fortsetzung|Pause)/i,
    interjection: /^\(([^)]+)\)$/,
    applause: /Beifall/i,
    objection: /Zuruf|Widerspruch/i
  };
  
  let currentAgendaNumber = '';
  let currentSpeaker = '';
  let currentSpeechContent = '';
  let lastTime = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for agenda items
    const agendaMatch = line.match(patterns.agendaItem);
    if (agendaMatch) {
      currentAgendaNumber = agendaMatch[1];
      const title = agendaMatch[2];
      
      // Look ahead for description
      let description = '';
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nextLine = lines[j];
        if (!nextLine.match(patterns.agendaItem) && !nextLine.match(patterns.speaker) && nextLine.length > 20) {
          description += (description ? ' ' : '') + nextLine;
        } else {
          break;
        }
      }
      
      agendaItems.push({
        agenda_number: currentAgendaNumber,
        title: title.replace(/^-\s*/, ''), // Remove leading dash
        description: description || undefined,
        item_type: determineItemType(title)
      });
      
      continue;
    }
    
    // Check for time markers and session events
    const timeMatch = line.match(patterns.time);
    if (timeMatch) {
      lastTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      
      const sessionMatch = line.match(patterns.sessionEvent);
      if (sessionMatch) {
        const eventType = sessionMatch[1].toLowerCase();
        let sessionType = 'start';
        
        if (eventType.includes('ende')) sessionType = 'end';
        else if (eventType.includes('unterbrechung') || eventType.includes('pause')) sessionType = 'break_start';
        else if (eventType.includes('fortsetzung')) sessionType = 'break_end';
        
        sessions.push({
          session_type: sessionType,
          timestamp: lastTime,
          notes: line
        });
      }
      continue;
    }
    
    // Check for speakers
    const speakerMatch = line.match(patterns.speaker);
    if (speakerMatch) {
      // Save previous speech
      if (currentSpeaker && currentSpeechContent.trim()) {
        speeches.push({
          speaker_name: currentSpeaker,
          speaker_party: extractPartyFromName(currentSpeaker),
          speech_content: currentSpeechContent.trim(),
          start_time: lastTime || undefined,
          speech_type: 'main'
        });
      }
      
      currentSpeaker = speakerMatch[1];
      if (speakerMatch[2]) {
        currentSpeaker += ` (${speakerMatch[2]})`;
      }
      currentSpeechContent = '';
      continue;
    }
    
    // Check for interjections
    const interjectionMatch = line.match(patterns.interjection);
    if (interjectionMatch) {
      const content = interjectionMatch[1];
      let speechType = 'interjection';
      
      if (patterns.applause.test(content)) speechType = 'applause';
      else if (patterns.objection.test(content)) speechType = 'interruption';
      
      speeches.push({
        speaker_name: 'Parlament',
        speech_content: content,
        speech_type: speechType
      });
      continue;
    }
    
    // Accumulate speech content
    if (currentSpeaker && line.length > 10) {
      currentSpeechContent += (currentSpeechContent ? ' ' : '') + line;
    }
  }
  
  // Save final speech
  if (currentSpeaker && currentSpeechContent.trim()) {
    speeches.push({
      speaker_name: currentSpeaker,
      speaker_party: extractPartyFromName(currentSpeaker),
      speech_content: currentSpeechContent.trim(),
      start_time: lastTime || undefined,
      speech_type: 'main'
    });
  }
  
  console.log(`Analysis complete: ${agendaItems.length} agenda items, ${speeches.length} speeches, ${sessions.length} sessions`);
  
  return { agendaItems, speeches, sessions };
}

function determineItemType(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('fragestunde') || lower.includes('aktuelle stunde')) return 'question';
  if (lower.includes('antrag')) return 'motion';
  if (lower.includes('regierungserklärung')) return 'government_statement';
  return 'regular';
}

function extractPartyFromName(name: string): string | undefined {
  const partyMatch = name.match(/\(([^)]+)\)/);
  if (partyMatch) {
    return partyMatch[1];
  }
  return undefined;
}