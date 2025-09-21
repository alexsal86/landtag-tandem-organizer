import * as pdfjsLib from 'pdfjs-dist';

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

// Advanced rule-based text analysis with enhanced debugging and preprocessing
export function analyzeProtocolStructure(text: string): {
  agendaItems: any[];
  speeches: any[];
  sessions: any[];
} {
  console.log('🔍 Starting enhanced protocol analysis...');
  console.log(`📄 Input text length: ${text.length} characters`);
  
  // Enhanced text preprocessing
  const preprocessedText = preprocessProtocolText(text);
  console.log(`✅ Preprocessed text length: ${preprocessedText.length} characters`);
  
  // Split into lines with multiple strategies
  const lines = smartLineSplit(preprocessedText);
  console.log(`📝 Total lines after splitting: ${lines.length}`);
  
  // Debug: Show first 10 lines for pattern analysis
  console.log('🔍 First 10 lines for debugging:');
  lines.slice(0, 10).forEach((line, i) => {
    console.log(`  ${i + 1}: "${line.substring(0, 100)}${line.length > 100 ? '...' : ''}"`);
  });
  
  const agendaItems: any[] = [];
  const speeches: any[] = [];
  const sessions: any[] = [];
  
  // Enhanced patterns with multiple alternatives and case insensitive matching
  const patterns = {
    // Agenda item patterns - multiple formats
    agendaItem: [
      /^(\d+(?:\.\d+)?)\.\s+(.+)$/i,                    // "1. Topic"
      /^TOP\s+(\d+(?:\.\d+)?)\s*[:\-]?\s*(.+)$/i,       // "TOP 1: Topic" or "TOP 1 - Topic"
      /^Punkt\s+(\d+(?:\.\d+)?)\s*[:\-]?\s*(.+)$/i,     // "Punkt 1: Topic"
      /^Tagesordnungspunkt\s+(\d+(?:\.\d+)?)\s*[:\-]?\s*(.+)$/i, // "Tagesordnungspunkt 1:"
      /^(\d+(?:\.\d+)?)\s*[:\-]\s*(.+)$/i               // "1: Topic" or "1 - Topic"
    ],
    
    // Speaker patterns - enhanced for German parliament
    speaker: [
      /^((?:Abg\.|Abgeordnete[rn]?)\s+(?:Dr\.\s+)?[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*)\s*(?:\(([^)]+)\))?\s*:/i,
      /^(Ministerpräsident(?:in)?(?:\s+(?:Dr\.\s+)?[A-ZÄÖÜ][a-zäöüß]+)*)\s*(?:\(([^)]+)\))?\s*:/i,
      /^(Minister(?:in)?(?:\s+(?:Dr\.\s+)?[A-ZÄÖÜ][a-zäöüß]+)*)\s*(?:\(([^)]+)\))?\s*:/i,
      /^(Staatssekretär(?:in)?(?:\s+(?:Dr\.\s+)?[A-ZÄÖÜ][a-zäöüß]+)*)\s*(?:\(([^)]+)\))?\s*:/i,
      /^(Präsident(?:in)?(?:\s+(?:Dr\.\s+)?[A-ZÄÖÜ][a-zäöüß]+)*)\s*:/i,
      /^([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*)\s*\(([A-Z]+(?:\s*\/\s*[A-Z]+)*)\)\s*:/i  // "Name (PARTY):"
    ],
    
    // Time patterns
    time: /(\d{1,2}):(\d{2})\s*Uhr/gi,
    
    // Session events
    sessionEvent: /(Sitzungsbeginn|Sitzungsende|Beginn|Schluss|Unterbrechung|Fortsetzung|Pause)/gi,
    
    // Interjections and reactions
    interjection: /^\(([^)]+)\)$/,
    applause: /(Beifall|Applaus|Klatschen)/gi,
    objection: /(Zuruf|Widerspruch|Protest|Unruhe)/gi
  };
  
  let currentAgendaNumber = '';
  let currentSpeaker = '';
  let currentSpeechContent = '';
  let lastTime = '';
  let debugMatches = { agenda: 0, speakers: 0, times: 0, sessions: 0 };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for agenda items with multiple patterns
    let agendaMatch: RegExpMatchArray | null = null;
    let matchedPattern = -1;
    
    for (let p = 0; p < patterns.agendaItem.length; p++) {
      agendaMatch = line.match(patterns.agendaItem[p]);
      if (agendaMatch) {
        matchedPattern = p;
        debugMatches.agenda++;
        break;
      }
    }
    
    if (agendaMatch) {
      currentAgendaNumber = agendaMatch[1];
      const title = agendaMatch[2];
      
      console.log(`📋 Found agenda item (pattern ${matchedPattern}): "${currentAgendaNumber}. ${title}"`);
      
      // Look ahead for description
      let description = '';
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nextLine = lines[j];
        if (!isAgendaLine(nextLine, patterns.agendaItem) && 
            !isSpeakerLine(nextLine, patterns.speaker) && 
            nextLine.length > 20 && 
            !nextLine.match(/^\d+$/)) {  // Skip page numbers
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
    
    // Check for time markers and session events
    const timeMatches = Array.from(line.matchAll(patterns.time));
    if (timeMatches.length > 0) {
      debugMatches.times++;
      const timeMatch = timeMatches[0];
      lastTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      
      console.log(`🕐 Found time marker: ${lastTime} in line "${line}"`);
      
      const sessionMatches = Array.from(line.matchAll(patterns.sessionEvent));
      if (sessionMatches.length > 0) {
        debugMatches.sessions++;
        const sessionMatch = sessionMatches[0];
        const eventType = sessionMatch[1].toLowerCase();
        let sessionType = 'start';
        
        if (eventType.includes('ende') || eventType.includes('schluss')) {
          sessionType = 'end';
        } else if (eventType.includes('unterbrechung') || eventType.includes('pause')) {
          sessionType = 'break_start';
        } else if (eventType.includes('fortsetzung')) {
          sessionType = 'break_end';
        }
        
        console.log(`🎯 Found session event: ${sessionType} at ${lastTime}`);
        
        sessions.push({
          session_type: sessionType,
          timestamp: lastTime,
          notes: line.trim()
        });
      }
      continue;
    }
    
    // Check for speakers with multiple patterns
    let speakerMatch: RegExpMatchArray | null = null;
    let speakerPattern = -1;
    
    for (let p = 0; p < patterns.speaker.length; p++) {
      speakerMatch = line.match(patterns.speaker[p]);
      if (speakerMatch) {
        speakerPattern = p;
        debugMatches.speakers++;
        break;
      }
    }
    
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
        console.log(`💬 Saved speech from: ${currentSpeaker} (${currentSpeechContent.length} chars)`);
      }
      
      currentSpeaker = speakerMatch[1].trim();
      if (speakerMatch[2]) {
        currentSpeaker += ` (${speakerMatch[2].trim()})`;
      }
      currentSpeechContent = '';
      
      console.log(`🎤 Found speaker (pattern ${speakerPattern}): "${currentSpeaker}"`);
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
      
      console.log(`👥 Found interjection: ${speechType} - "${content}"`);
      continue;
    }
    
    // Accumulate speech content
    if (currentSpeaker && line.length > 10 && !line.match(/^\d+$/)) {  // Skip page numbers
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
    console.log(`💬 Saved final speech from: ${currentSpeaker} (${currentSpeechContent.length} chars)`);
  }
  
  console.log('🎯 Debug match counts:', debugMatches);
  console.log(`✅ Analysis complete: ${agendaItems.length} agenda items, ${speeches.length} speeches, ${sessions.length} sessions`);
  
  // Additional debugging for empty results
  if (agendaItems.length === 0 && speeches.length === 0 && sessions.length === 0) {
    console.warn('⚠️ No structured data found! Analyzing potential issues:');
    console.log('📊 Text analysis:');
    console.log(`   - Contains "Landtag": ${text.includes('Landtag')}`);
    console.log(`   - Contains "Baden-Württemberg": ${text.includes('Baden-Württemberg')}`);
    console.log(`   - Contains "Sitzung": ${text.includes('Sitzung')}`);
    console.log(`   - Contains "Abg.": ${text.includes('Abg.')}`);
    console.log(`   - Contains numbers: ${/\d+/.test(text)}`);
    console.log(`   - Contains time patterns: ${patterns.time.test(text)}`);
    
    // Show sample lines that might contain relevant data
    console.log('📝 Sample lines that might be relevant:');
    lines.slice(0, 50).forEach((line, i) => {
      if (line.includes('Abg.') || line.includes('Landtag') || line.includes('Sitzung') || /\d+\./.test(line)) {
        console.log(`   Line ${i + 1}: "${line}"`);
      }
    });
  }
  
  return { agendaItems, speeches, sessions };
}

// Enhanced text preprocessing function
function preprocessProtocolText(text: string): string {
  console.log('🔧 Preprocessing protocol text...');
  
  // Step 1: Normalize whitespace and special characters
  let processed = text
    .replace(/\r\n/g, '\n')           // Normalize line endings
    .replace(/\r/g, '\n')             // Mac line endings
    .replace(/\u00A0/g, ' ')          // Replace non-breaking spaces
    .replace(/\t/g, ' ')              // Replace tabs with spaces
    .replace(/\s{2,}/g, ' ');         // Collapse multiple spaces
  
  // Step 2: Try to detect and fix PDF text extraction issues
  // PDF text often comes as one long line without proper breaks
  if (processed.split('\n').length < 10 && processed.length > 1000) {
    console.log('📄 Detected single-line PDF text, attempting to split...');
    
    // Split on likely sentence/section boundaries
    processed = processed
      // Split before numbered items
      .replace(/(\d+\.\s+[A-ZÄÖÜ])/g, '\n$1')
      // Split before speaker names
      .replace(/(Abg\.\s+[A-ZÄÖÜ])/g, '\n$1')
      .replace(/(Ministerpräsident)/g, '\n$1')
      .replace(/(Präsident[^a-z])/g, '\n$1')
      // Split on time markers
      .replace(/(\d{1,2}:\d{2}\s*Uhr)/g, '\n$1')
      // Split on session events
      .replace(/(Sitzungsbeginn|Sitzungsende|Beginn|Schluss)/gi, '\n$1')
      // Split on periods followed by capital letters (careful approach)
      .replace(/\.\s+([A-ZÄÖÜ][a-zäöü]{2,})/g, '.\n$1')
      // Split on question marks and exclamation marks
      .replace(/([?!])\s+([A-ZÄÖÜ])/g, '$1\n$2');
  }
  
  console.log(`✅ Preprocessing complete. Line count: ${processed.split('\n').length}`);
  return processed;
}

// Smart line splitting with multiple strategies
function smartLineSplit(text: string): string[] {
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  console.log(`📝 Smart line split: ${lines.length} non-empty lines`);
  
  // Additional processing for very long lines
  const processedLines: string[] = [];
  
  for (const line of lines) {
    if (line.length > 500) {
      // Try to split very long lines at sentence boundaries
      const sentences = line.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ])/)
        .filter(s => s.trim().length > 0);
      
      if (sentences.length > 1) {
        console.log(`✂️ Split long line (${line.length} chars) into ${sentences.length} sentences`);
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

// Helper functions for pattern matching
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