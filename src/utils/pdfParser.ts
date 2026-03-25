import * as pdfjsLib from 'pdfjs-dist';
import { debugConsole } from '@/utils/debugConsole';

// Configure PDF.js worker to use the file from public folder
pdfjsLib.GlobalWorkerOptions.workerSrc = window.location.origin + "/pdf.worker.min.mjs";

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

interface PdfTextItem {
  str: string;
}

export interface ProtocolAnalysisAgendaItem {
  agenda_number: string;
  title: string;
  description?: string;
  item_type: string;
}

export interface ProtocolAnalysisSpeech {
  speaker_name: string;
  speaker_party?: string;
  speech_content: string;
  start_time?: string;
  speech_type: string;
}

export interface ProtocolSessionEvent {
  session_type: string;
  timestamp: string;
  notes: string;
}

function isPdfTextItem(item: unknown): item is PdfTextItem {
  return typeof item === 'object' && item !== null && 'str' in item && typeof (item as { str?: unknown }).str === 'string';
}

export async function parsePDFFile(file: File): Promise<ParsedProtocol> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    const pages: PageInfo[] = [];
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
          .map((item: unknown) => (isPdfTextItem(item) ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        
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
        debugConsole.error(`Error processing page ${pageNum}:`, pageError);
      }
    }
    
    const metadata = extractMetadata(file.name, fullText, pdf.numPages);
    
    return {
      text: fullText,
      pages,
      metadata
    };
    
  } catch (error: unknown) {
    debugConsole.error('PDF parsing error:', error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Fehler beim Parsen der PDF: ${message}`);
  }
}

function detectAgendaItems(text: string): boolean {
  const agendaPatterns = [
    /\d+\.\s+[A-ZÄÖÜ]/,
    /Tagesordnung/i,
    /TOP\s+\d+/i,
    /Punkt\s+\d+/i
  ];
  
  return agendaPatterns.some(pattern => pattern.test(text));
}

function detectSpeeches(text: string): boolean {
  const speechPatterns = [
    /Abg\.\s+[A-ZÄÖÜ]/,
    /Ministerpräsident/i,
    /Minister\s+[A-ZÄÖÜ]/,
    /Staatssekretär/i,
    /Präsident.*:/,
    /\([A-Z]+\):/
  ];
  
  return speechPatterns.some(pattern => pattern.test(text));
}

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

function extractMetadata(filename: string, text: string, pageCount: number): ProtocolMetadata {
  const filenameMatch = filename.match(/(\d+)_(\d+)_(\d{8})\.pdf$/);
  
  let sessionNumber = '0';
  let date = new Date().toISOString().split('T')[0];
  let legislature = '17';
  
  if (filenameMatch) {
    legislature = filenameMatch[1];
    sessionNumber = filenameMatch[2];
    
    const dateStr = filenameMatch[3];
    const day = dateStr.slice(0, 2);
    const month = dateStr.slice(2, 4);
    const year = dateStr.slice(4, 8);
    date = `${year}-${month}-${day}`;
  } else {
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

// Advanced rule-based text analysis with enhanced preprocessing
export function analyzeProtocolStructure(text: unknown): {
  agendaItems: ReadonlyArray<ProtocolAnalysisAgendaItem>;
  speeches: ReadonlyArray<ProtocolAnalysisSpeech>;
  sessions: ReadonlyArray<ProtocolSessionEvent>;
} {
  if (typeof text !== 'string') {
    throw new Error('Ungültiger Protokolltext.');
  }

  const preprocessedText = preprocessProtocolText(text);
  const lines = smartLineSplit(preprocessedText);
  
  const agendaItems: ProtocolAnalysisAgendaItem[] = [];
  const speeches: ProtocolAnalysisSpeech[] = [];
  const sessions: ProtocolSessionEvent[] = [];
  
  const patterns = {
    agendaItem: [
      /^(\d+(?:\.\d+)?)\.\s+(.+)$/i,
      /^TOP\s+(\d+(?:\.\d+)?)\s*[:\-]?\s*(.+)$/i,
      /^Punkt\s+(\d+(?:\.\d+)?)\s*[:\-]?\s*(.+)$/i,
      /^Tagesordnungspunkt\s+(\d+(?:\.\d+)?)\s*[:\-]?\s*(.+)$/i,
      /^(\d+(?:\.\d+)?)\s*[:\-]\s*(.+)$/i
    ],
    speaker: [
      /^((?:Abg\.|Abgeordnete[rn]?)\s+(?:Dr\.\s+)?[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*)\s*(?:\(([^)]+)\))?\s*:/i,
      /^(Ministerpräsident(?:in)?(?:\s+(?:Dr\.\s+)?[A-ZÄÖÜ][a-zäöüß]+)*)\s*(?:\(([^)]+)\))?\s*:/i,
      /^(Minister(?:in)?(?:\s+(?:Dr\.\s+)?[A-ZÄÖÜ][a-zäöüß]+)*)\s*(?:\(([^)]+)\))?\s*:/i,
      /^(Staatssekretär(?:in)?(?:\s+(?:Dr\.\s+)?[A-ZÄÖÜ][a-zäöüß]+)*)\s*(?:\(([^)]+)\))?\s*:/i,
      /^(Präsident(?:in)?(?:\s+(?:Dr\.\s+)?[A-ZÄÖÜ][a-zäöüß]+)*)\s*:/i,
      /^([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*)\s*\(([A-Z]+(?:\s*\/\s*[A-Z]+)*)\)\s*:/i
    ],
    time: /(\d{1,2}):(\d{2})\s*Uhr/gi,
    sessionEvent: /(Sitzungsbeginn|Sitzungsende|Beginn|Schluss|Unterbrechung|Fortsetzung|Pause)/gi,
    interjection: /^\(([^)]+)\)$/,
    applause: /(Beifall|Applaus|Klatschen)/gi,
    objection: /(Zuruf|Widerspruch|Protest|Unruhe)/gi
  };
  
  let currentAgendaNumber = '';
  let currentSpeaker = '';
  let currentSpeechContent = '';
  let lastTime = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    let agendaMatch: RegExpMatchArray | null = null;
    
    for (let p = 0; p < patterns.agendaItem.length; p++) {
      agendaMatch = line.match(patterns.agendaItem[p]);
      if (agendaMatch) break;
    }
    
    if (agendaMatch) {
      currentAgendaNumber = agendaMatch[1];
      const title = agendaMatch[2];
      
      let description = '';
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nextLine = lines[j];
        if (!isAgendaLine(nextLine, patterns.agendaItem) && 
            !isSpeakerLine(nextLine, patterns.speaker) && 
            nextLine.length > 20 && 
            !nextLine.match(/^\d+$/)) {
          description += (description ? ' ' : '') + nextLine;
        } else {
          break;
        }
      }
      
      agendaItems.push({
        agenda_number: currentAgendaNumber,
        title: title.replace(/^-\s*/, '').trim(),
        description: description.trim() || undefined,
        item_type: determineItemType(title)
      });
      
      continue;
    }
    
    const timeMatches = Array.from(line.matchAll(patterns.time));
    if (timeMatches.length > 0) {
      const timeMatch = timeMatches[0];
      lastTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      
      const sessionMatches = Array.from(line.matchAll(patterns.sessionEvent));
      if (sessionMatches.length > 0) {
        const sessionMatch = sessionMatches[0];
        const eventType = sessionMatch[1].toLowerCase();
        let sessionType: SessionEvent['session_type'] = 'start';
        
        if (eventType.includes('ende') || eventType.includes('schluss')) {
          sessionType = 'end';
        } else if (eventType.includes('unterbrechung') || eventType.includes('pause')) {
          sessionType = 'break_start';
        } else if (eventType.includes('fortsetzung')) {
          sessionType = 'break_end';
        }
        
        sessions.push({
          session_type: sessionType,
          timestamp: lastTime,
          notes: line.trim()
        });
      }
      continue;
    }
    
    let speakerMatch: RegExpMatchArray | null = null;
    
    for (let p = 0; p < patterns.speaker.length; p++) {
      speakerMatch = line.match(patterns.speaker[p]);
      if (speakerMatch) break;
    }
    
    if (speakerMatch) {
      if (currentSpeaker && currentSpeechContent.trim()) {
        speeches.push({
          speaker_name: currentSpeaker,
          speaker_party: extractPartyFromName(currentSpeaker),
          speech_content: currentSpeechContent.trim(),
          start_time: lastTime || undefined,
          speech_type: 'main'
        });
      }
      
      currentSpeaker = speakerMatch[1].trim();
      if (speakerMatch[2]) {
        currentSpeaker += ` (${speakerMatch[2].trim()})`;
      }
      currentSpeechContent = '';
      continue;
    }
    
    const interjectionMatch = line.match(patterns.interjection);
    if (interjectionMatch) {
      const content = interjectionMatch[1];
      let speechType: ParsedSpeech['speech_type'] = 'interjection';
      
      if (patterns.applause.test(content)) speechType = 'applause';
      else if (patterns.objection.test(content)) speechType = 'interruption';
      
      speeches.push({
        speaker_name: 'Parlament',
        speech_content: content,
        speech_type: speechType
      });
      
      continue;
    }
    
    if (currentSpeaker && line.length > 10 && !line.match(/^\d+$/)) {
      currentSpeechContent += (currentSpeechContent ? ' ' : '') + line;
    }
  }
  
  if (currentSpeaker && currentSpeechContent.trim()) {
    speeches.push({
      speaker_name: currentSpeaker,
      speaker_party: extractPartyFromName(currentSpeaker),
      speech_content: currentSpeechContent.trim(),
      start_time: lastTime || undefined,
      speech_type: 'main'
    });
  }
  
  if (agendaItems.length === 0 && speeches.length === 0 && sessions.length === 0) {
    debugConsole.warn('No structured data found in protocol text');
  }
  
  return { agendaItems, speeches, sessions };
}

function preprocessProtocolText(text: string): string {
  let processed = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s{2,}/g, ' ');
  
  if (processed.split('\n').length < 10 && processed.length > 1000) {
    processed = processed
      .replace(/(\d+\.\s+[A-ZÄÖÜ])/g, '\n$1')
      .replace(/(Abg\.\s+[A-ZÄÖÜ])/g, '\n$1')
      .replace(/(Ministerpräsident)/g, '\n$1')
      .replace(/(Präsident[^a-z])/g, '\n$1')
      .replace(/(\d{1,2}:\d{2}\s*Uhr)/g, '\n$1')
      .replace(/(Sitzungsbeginn|Sitzungsende|Beginn|Schluss)/gi, '\n$1')
      .replace(/\.\s+([A-ZÄÖÜ][a-zäöü]{2,})/g, '.\n$1')
      .replace(/([?!])\s+([A-ZÄÖÜ])/g, '$1\n$2');
  }
  
  return processed;
}

function smartLineSplit(text: string): string[] {
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  const processedLines: string[] = [];
  
  for (const line of lines) {
    if (line.length > 500) {
      const sentences = line.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ])/)
        .filter(s => s.trim().length > 0);
      
      if (sentences.length > 1) {
        processedLines.push(...sentences);
      } else {
        processedLines.push(line);
      }
    } else {
      processedLines.push(line);
    }
  }
  
  return processedLines;
}

function isAgendaLine(line: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(line));
}

function isSpeakerLine(line: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(line));
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
