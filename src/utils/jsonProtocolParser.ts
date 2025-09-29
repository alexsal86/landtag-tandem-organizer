interface JSONProtocolStructure {
  session: {
    number: number | null;
    legislative_period: number | null;
    date: string | null;
    source_pdf_url?: string | null;
    extracted_at: string;
  };
  speeches: Array<{
    index: number;
    speaker: {
      name: string;
      party?: string;
      role?: string;
    };
    text: string;
    page_number?: number;
    speech_type?: string;
    timestamp?: string;
  }>;
  agenda?: Array<{
    number: string;
    title: string;
    description?: string;
    page_number?: number;
    item_type?: string;
  }>;
  statistics?: {
    total_speeches: number;
    total_pages: number;
    parties_represented: string[];
    session_duration?: string;
  };
}

export interface ParsedJSONProtocol {
  metadata: {
    session_number: string;
    legislature_period: string;
    protocol_date: string;
    source_pdf_url?: string;
    statistics?: any;
  };
  structured_data: {
    agendaItems: Array<{
      agenda_number: string;
      title: string;
      description?: string;
      page_number?: number;
      item_type: string;
    }>;
    speeches: Array<{
      speaker_name: string;
      speaker_party?: string;
      speaker_role?: string;
      speech_content: string;
      page_number?: number;
      speech_type: string;
      timestamp?: string;
      index: number;
    }>;
    sessions: Array<{
      session_type: string;
      timestamp: string;
      page_number?: number;
      notes?: string;
    }>;
  };
}

export function validateJSONProtocol(data: any): boolean {
  try {
    // Check required top-level structure
    if (!data || typeof data !== 'object') return false;
    if (!data.session || !data.speeches || !Array.isArray(data.speeches)) return false;
    
    // Check session structure
    const session = data.session;
    if (typeof session !== 'object') return false;
    if (!session.date || !session.extracted_at) return false;
    
    // Check speeches structure
    for (const speech of data.speeches) {
      if (!speech.speaker || !speech.text || typeof speech.index !== 'number') return false;
      if (!speech.speaker.name) return false;
    }
    
    return true;
  } catch (error) {
    console.error('JSON validation error:', error);
    return false;
  }
}

export function parseJSONProtocol(jsonData: JSONProtocolStructure): ParsedJSONProtocol {
  // Extract metadata
  const metadata = {
    session_number: jsonData.session.number?.toString() || '0',
    legislature_period: jsonData.session.legislative_period?.toString() || '17',
    protocol_date: jsonData.session.date || new Date().toISOString().split('T')[0],
    source_pdf_url: jsonData.session.source_pdf_url,
    statistics: jsonData.statistics
  };

  // Parse agenda items
  const agendaItems = (jsonData.agenda || []).map(item => ({
    agenda_number: item.number,
    title: item.title,
    description: item.description,
    page_number: item.page_number,
    item_type: item.item_type || 'regular'
  }));

  // Parse speeches
  const speeches = jsonData.speeches.map(speech => ({
    speaker_name: speech.speaker.name,
    speaker_party: speech.speaker.party,
    speaker_role: speech.speaker.role,
    speech_content: speech.text,
    page_number: speech.page_number,
    speech_type: speech.speech_type || 'main',
    timestamp: speech.timestamp,
    index: speech.index
  }));

  // Generate basic session events from speeches timestamps and agenda
  const sessions: Array<{
    session_type: string;
    timestamp: string;
    page_number?: number;
    notes?: string;
  }> = [];

  // Add session start
  sessions.push({
    session_type: 'session_start',
    timestamp: jsonData.session.extracted_at,
    notes: `Sitzung ${metadata.session_number} der ${metadata.legislature_period}. Wahlperiode`
  });

  // Add agenda-based sessions if available
  if (jsonData.agenda && jsonData.agenda.length > 0) {
    jsonData.agenda.forEach(item => {
      sessions.push({
        session_type: 'agenda_item',
        timestamp: jsonData.session.extracted_at,
        page_number: item.page_number,
        notes: `Tagesordnungspunkt ${item.number}: ${item.title}`
      });
    });
  }

  // Add session end
  sessions.push({
    session_type: 'session_end',
    timestamp: jsonData.session.extracted_at,
    notes: 'Ende der Sitzung'
  });

  return {
    metadata,
    structured_data: {
      agendaItems,
      speeches,
      sessions
    }
  };
}

export function getJSONProtocolPreview(jsonData: JSONProtocolStructure): {
  sessionInfo: string;
  speechCount: number;
  agendaCount: number;
  parties: string[];
  dateInfo: string;
} {
  const parties = Array.from(new Set(
    jsonData.speeches
      .map(s => s.speaker.party)
      .filter(Boolean)
  ));

  const sessionInfo = `Sitzung ${jsonData.session.number || 'unbekannt'} (${jsonData.session.legislative_period || '17'}. Wahlperiode)`;
  const dateInfo = jsonData.session.date ? 
    new Date(jsonData.session.date).toLocaleDateString('de-DE') : 
    'Datum unbekannt';

  return {
    sessionInfo,
    speechCount: jsonData.speeches.length,
    agendaCount: jsonData.agenda?.length || 0,
    parties,
    dateInfo
  };
}