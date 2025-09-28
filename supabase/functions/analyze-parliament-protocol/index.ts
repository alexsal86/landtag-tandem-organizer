import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProtocolStructure {
  agenda_items: AgendaItem[];
  speeches: Speech[];
  sessions: SessionEvent[];
}

interface AgendaItem {
  agenda_number: string;
  title: string;
  description?: string;
  page_number?: number;
  start_time?: string;
  end_time?: string;
  item_type: string;
}

interface Speech {
  speaker_name: string;
  speaker_party?: string;
  speaker_role?: string;
  speech_content: string;
  start_time?: string;
  page_number?: number;
  speech_type: string;
  agenda_item_id?: string;
}

interface SessionEvent {
  session_type: string;
  timestamp: string;
  page_number?: number;
  notes?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { protocolId, structuredData } = await req.json();

    if (!protocolId) {
      throw new Error('Protocol ID is required');
    }

    console.log(`Starting database insertion for protocol: ${protocolId}`);

    // Update status to processing
    await supabaseClient
      .from('parliament_protocols')
      .update({ 
        processing_status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', protocolId);

    let finalStructuredData;

    if (structuredData) {
      // Use data provided by frontend (frontend-first approach)
      console.log('Using structured data from frontend:', {
        agendaItems: structuredData.agendaItems?.length || 0,
        speeches: structuredData.speeches?.length || 0,
        sessions: structuredData.sessions?.length || 0
      });

      finalStructuredData = {
        agenda_items: structuredData.agendaItems || [],
        speeches: structuredData.speeches || [],
        sessions: structuredData.sessions || []
      };
    } else {
      // Fallback: Server-side analysis (legacy approach)
      console.log('No structured data provided, performing server-side analysis...');
      
      const { data: protocol, error: protocolError } = await supabaseClient
        .from('parliament_protocols')
        .select('*')
        .eq('id', protocolId)
        .single();

      if (protocolError || !protocol) {
        throw new Error(`Protocol not found: ${protocolError?.message}`);
      }

      const { data: fileData, error: downloadError } = await supabaseClient.storage
        .from('parliament-protocols')
        .download(protocol.file_path);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download PDF: ${downloadError?.message}`);
      }

      const pdfText = await extractTextFromPDF(fileData);
      finalStructuredData = parseParliamentProtocol(pdfText);

      // Update protocol with raw text
      await supabaseClient
        .from('parliament_protocols')
        .update({
          raw_text: pdfText.slice(0, 50000),
          updated_at: new Date().toISOString()
        })
        .eq('id', protocolId);
    }

    // Save structured data to database
    await saveStructuredData(supabaseClient, protocolId, finalStructuredData);

    // Update protocol with completion status
    await supabaseClient
      .from('parliament_protocols')
      .update({
        structured_data: finalStructuredData,
        processing_status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', protocolId);

    console.log(`Analysis completed for protocol: ${protocolId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        protocolId,
        stats: {
          agendaItems: finalStructuredData.agenda_items.length,
          speeches: finalStructuredData.speeches.length,
          sessions: finalStructuredData.sessions.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Analysis error:', error);

    // Update protocol with error status if we have the ID
    let protocolIdFromError = null;
    try {
      // Try to get protocolId from the original request
      const requestBody = await req.clone().json();
      protocolIdFromError = requestBody.protocolId;
    } catch (parseError) {
      console.error('Could not parse request body for error handling:', parseError);
    }

    if (protocolIdFromError) {
      try {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        await supabaseClient
          .from('parliament_protocols')
          .update({
            processing_status: 'error',
            processing_error_message: error instanceof Error ? error.message : String(error),
            updated_at: new Date().toISOString()
          })
          .eq('id', protocolIdFromError);
          
        console.log(`Updated protocol ${protocolIdFromError} with error status`);
      } catch (updateError) {
        console.error('Failed to update error status:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        protocolId: protocolIdFromError,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Fallback PDF text extraction for server-side analysis
async function extractTextFromPDF(pdfData: Blob): Promise<string> {
  // This is a simplified fallback implementation
  // In a production environment, you would use a proper PDF parsing library
  try {
    // Try to read as text if it's a simple PDF
    const arrayBuffer = await pdfData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Basic text extraction attempt
    let text = '';
    for (let i = 0; i < uint8Array.length; i++) {
      const char = String.fromCharCode(uint8Array[i]);
      if (char.match(/[a-zA-ZäöüÄÖÜß0-9\s.,;:!?()\-]/)) {
        text += char;
      }
    }
    
    // Clean up the text
    text = text
      .replace(/\s+/g, ' ')
      .replace(/(.)\1{3,}/g, '$1')  // Remove repeated characters
      .trim();
    
    if (text.length > 100) {
      console.log(`Extracted ${text.length} characters using fallback method`);
      return text;
    }
  } catch (error) {
    console.warn('Fallback text extraction failed:', error);
  }
  
  // Ultimate fallback - return empty text
  console.warn('PDF text extraction failed completely - frontend analysis should have provided the data');
  return '';
}

// Rule-based parsing of parliament protocol text
function parseParliamentProtocol(text: string): ProtocolStructure {
  const agenda_items: AgendaItem[] = [];
  const speeches: Speech[] = [];
  const sessions: SessionEvent[] = [];

  const lines = text.split('\n');
  let currentPageNumber = 1;

  // Regex patterns for Baden-Württemberg protocols
  const patterns = {
    // Agenda items: "1. Topic" or "1.1 Subtopic"
    agendaItem: /^(\d+(?:\.\d+)?)\.\s+(.+)$/,
    
    // Speeches: "Abg. Name (PARTY):" or "Ministerpräsident Name:"
    speaker: /^(?:Abg\.|Ministerpräsident|Minister|Staatssekretär)\s+(.+?)\s*(?:\(([^)]+)\))?\s*:/,
    
    // Times: "09:30 Uhr" or "9:30 Uhr"
    time: /(\d{1,2}):(\d{2})\s*Uhr/,
    
    // Session events
    sessionStart: /Sitzungsbeginn|Eröffnung.*Sitzung/i,
    sessionEnd: /Ende.*Sitzung|Sitzungsende/i,
    sessionBreak: /Unterbrechung|Pause/i,
    sessionResume: /Fortsetzung|Wiederaufnahme/i,
    
    // Interjections and reactions
    interjection: /\(([^)]+)\)/,
    applause: /\(Beifall/i,
    objection: /\(Zuruf/i,
    
    // Page markers
    pageMarker: /^Seite\s+(\d+)$/
  };

  let currentSpeaker = '';
  let currentSpeechContent = '';
  let currentAgendaItem = '';
  let lastTime = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check for page markers
    const pageMatch = line.match(patterns.pageMarker);
    if (pageMatch) {
      currentPageNumber = parseInt(pageMatch[1]);
      continue;
    }

    // Check for agenda items
    const agendaMatch = line.match(patterns.agendaItem);
    if (agendaMatch) {
      currentAgendaItem = agendaMatch[1];
      const title = agendaMatch[2];
      
      // Get description from next lines
      let description = '';
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const nextLine = lines[j].trim();
        if (nextLine && !nextLine.match(patterns.agendaItem) && !nextLine.match(patterns.speaker)) {
          description += (description ? ' ' : '') + nextLine;
        } else {
          break;
        }
      }

      agenda_items.push({
        agenda_number: currentAgendaItem,
        title: title,
        description: description || undefined,
        page_number: currentPageNumber,
        item_type: determineItemType(title)
      });
      continue;
    }

    // Check for time markers
    const timeMatch = line.match(patterns.time);
    if (timeMatch) {
      lastTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      
      // Check for session events
      if (patterns.sessionStart.test(line)) {
        sessions.push({
          session_type: 'start',
          timestamp: lastTime,
          page_number: currentPageNumber,
          notes: line
        });
      } else if (patterns.sessionEnd.test(line)) {
        sessions.push({
          session_type: 'end',
          timestamp: lastTime,
          page_number: currentPageNumber,
          notes: line
        });
      } else if (patterns.sessionBreak.test(line)) {
        sessions.push({
          session_type: 'break_start',
          timestamp: lastTime,
          page_number: currentPageNumber,
          notes: line
        });
      } else if (patterns.sessionResume.test(line)) {
        sessions.push({
          session_type: 'break_end',
          timestamp: lastTime,
          page_number: currentPageNumber,
          notes: line
        });
      }
      continue;
    }

    // Check for speakers
    const speakerMatch = line.match(patterns.speaker);
    if (speakerMatch) {
      // Save previous speech if exists
      if (currentSpeaker && currentSpeechContent) {
        speeches.push({
          speaker_name: currentSpeaker,
          speaker_party: extractPartyFromSpeaker(currentSpeaker),
          speech_content: currentSpeechContent.trim(),
          start_time: lastTime || undefined,
          page_number: currentPageNumber,
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

    // Check for interjections and reactions
    if (patterns.interjection.test(line)) {
      const interjectionMatch = line.match(patterns.interjection);
      if (interjectionMatch) {
        const content = interjectionMatch[1];
        let speechType = 'interjection';
        
        if (patterns.applause.test(content)) {
          speechType = 'applause';
        } else if (patterns.objection.test(content)) {
          speechType = 'interruption';
        }

        speeches.push({
          speaker_name: 'Parlament',
          speech_content: content,
          page_number: currentPageNumber,
          speech_type: speechType
        });
      }
      continue;
    }

    // Regular speech content
    if (currentSpeaker && line.length > 10) {
      currentSpeechContent += (currentSpeechContent ? ' ' : '') + line;
    }
  }

  // Save last speech
  if (currentSpeaker && currentSpeechContent) {
    speeches.push({
      speaker_name: currentSpeaker,
      speaker_party: extractPartyFromSpeaker(currentSpeaker),
      speech_content: currentSpeechContent.trim(),
      start_time: lastTime || undefined,
      page_number: currentPageNumber,
      speech_type: 'main'
    });
  }

  console.log(`Parsed: ${agenda_items.length} agenda items, ${speeches.length} speeches, ${sessions.length} session events`);

  return { agenda_items, speeches, sessions };
}

// Helper functions
function determineItemType(title: string): string {
  if (/fragestunde|aktuelle stunde/i.test(title)) return 'question';
  if (/antrag/i.test(title)) return 'motion';
  if (/regierungserklärung/i.test(title)) return 'government_statement';
  return 'regular';
}

function extractPartyFromSpeaker(speakerName: string): string | undefined {
  const partyMatch = speakerName.match(/\(([^)]+)\)/);
  if (partyMatch) {
    const party = partyMatch[1];
    // Known parties in Baden-Württemberg
    const knownParties = ['CDU', 'GRÜNE', 'SPD', 'AfD', 'FDP'];
    return knownParties.includes(party) ? party : party;
  }
  return undefined;
}

// Save structured data to database
async function saveStructuredData(supabase: any, protocolId: string, data: ProtocolStructure) {
  // Insert agenda items
  if (data.agenda_items.length > 0) {
    const agendaItemsWithProtocolId = data.agenda_items.map(item => ({
      ...item,
      protocol_id: protocolId
    }));
    
    const { error: agendaError } = await supabase
      .from('protocol_agenda_items')
      .insert(agendaItemsWithProtocolId);
    
    if (agendaError) {
      console.error('Error inserting agenda items:', agendaError);
    }
  }

  // Insert speeches
  if (data.speeches.length > 0) {
    const speechesWithProtocolId = data.speeches.map(speech => ({
      ...speech,
      protocol_id: protocolId
    }));
    
    const { error: speechesError } = await supabase
      .from('protocol_speeches')
      .insert(speechesWithProtocolId);
    
    if (speechesError) {
      console.error('Error inserting speeches:', speechesError);
    }
  }

  // Insert session events
  if (data.sessions.length > 0) {
    const sessionsWithProtocolId = data.sessions.map(session => ({
      ...session,
      protocol_id: protocolId
    }));
    
    const { error: sessionsError } = await supabase
      .from('protocol_sessions')
      .insert(sessionsWithProtocolId);
    
    if (sessionsError) {
      console.error('Error inserting sessions:', sessionsError);
    }
  }
}