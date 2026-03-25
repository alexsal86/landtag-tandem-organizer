import { hasOwnProperty, isRecord } from '@/utils/typeSafety';

export interface ProtocolAgendaItem {
  number: string | number;
  title: string;
  description?: string;
  page_number?: number;
  item_type?: string;
  speakers?: ReadonlyArray<unknown>;
  drucksachen?: ReadonlyArray<unknown>;
  subentries?: ReadonlyArray<unknown>;
  agenda_number?: string;
  kind?: string;
}

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
    speaker: string | { name: string; role?: string; party?: string };
    role?: string;
    party?: string;
    text: string;
    start_page?: number;
    page_number?: number;
    speech_type?: string;
    timestamp?: string;
    agenda_item_number?: number;
    events?: ReadonlyArray<unknown>;
    events_flat?: ReadonlyArray<unknown>;
  }>;
  agenda?: ReadonlyArray<ProtocolAgendaItem>;
  toc?: {
    items: ReadonlyArray<{
      number: number;
      title: string;
      kind?: string;
      speakers?: Array<{
        name: string;
        role?: string;
        party?: string;
        pages?: number[];
      }>;
    }>;
  };
  stats?: {
    pages: number;
    speeches: number;
  };
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
    source_pdf_url?: string | null;
    statistics?: unknown;
  };
  structured_data: {
    agendaItems: Array<{
      agenda_number: string;
      title: string;
      description?: string;
      page_number?: number;
      item_type: string;
      speakers?: ReadonlyArray<unknown>;
      drucksachen?: ReadonlyArray<unknown>;
      subentries?: ReadonlyArray<unknown>;
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
      agenda_item_number?: number;
      events?: ReadonlyArray<unknown>;
      events_flat?: ReadonlyArray<unknown>;
    }>;
    sessions: Array<{
      session_type: string;
      timestamp: string;
      page_number?: number;
      notes?: string;
    }>;
  };
}

export function isProtocolAgendaItem(value: unknown): value is ProtocolAgendaItem {
  if (!isRecord(value)) {
    return false;
  }

  if (!hasOwnProperty(value, 'title') || typeof value.title !== 'string') {
    return false;
  }

  if (!hasOwnProperty(value, 'number') && !hasOwnProperty(value, 'agenda_number')) {
    return false;
  }

  const numberValue = hasOwnProperty(value, 'number') ? value.number : value.agenda_number;
  return typeof numberValue === 'string' || typeof numberValue === 'number';
}

function isJSONProtocolStructure(value: unknown): value is JSONProtocolStructure {
  if (!isRecord(value)) return false;
  if (!hasOwnProperty(value, 'session') || !isRecord(value.session)) return false;
  if (!hasOwnProperty(value, 'speeches') || !Array.isArray(value.speeches)) return false;

  if (!hasOwnProperty(value.session, 'date') || !hasOwnProperty(value.session, 'extracted_at')) return false;
  if (value.session.date !== null && typeof value.session.date !== 'string') return false;
  if (typeof value.session.extracted_at !== 'string') return false;

  for (const speech of value.speeches) {
    if (!isRecord(speech)) return false;
    if (!hasOwnProperty(speech, 'text') || typeof speech.text !== 'string') return false;
    if (!hasOwnProperty(speech, 'index') || typeof speech.index !== 'number') return false;
    if (!hasOwnProperty(speech, 'speaker')) return false;
    if (isRecord(speech.speaker) && (!hasOwnProperty(speech.speaker, 'name') || typeof speech.speaker.name !== 'string')) {
      return false;
    }
    if (typeof speech.speaker !== 'string' && !isRecord(speech.speaker)) return false;
  }

  if (hasOwnProperty(value, 'agenda') && value.agenda !== undefined && value.agenda !== null) {
    if (!Array.isArray(value.agenda) || !value.agenda.every(isProtocolAgendaItem)) {
      return false;
    }
  }

  return true;
}

export function validateJSONProtocol(data: unknown): boolean {
  try {
    return isJSONProtocolStructure(data);
  } catch (error) {
    // JSON validation error - silently return false
    return false;
  }
}

export function parseJSONProtocol(jsonData: unknown): ParsedJSONProtocol {
  if (!isJSONProtocolStructure(jsonData)) {
    throw new Error('Ungültiges JSON-Protokollformat.');
  }
  // Extract metadata
  const metadata = {
    session_number: jsonData.session.number?.toString() || '0',
    legislature_period: jsonData.session.legislative_period?.toString() || '17',
    protocol_date: jsonData.session.date || new Date().toISOString().split('T')[0],
    source_pdf_url: jsonData.session.source_pdf_url,
    statistics: jsonData.statistics || jsonData.stats ? {
      total_speeches: jsonData.stats?.speeches || jsonData.statistics?.total_speeches || jsonData.speeches.length,
      total_pages: jsonData.stats?.pages || jsonData.statistics?.total_pages || 0,
      parties_represented: jsonData.statistics?.parties_represented || Array.from(new Set(
        jsonData.speeches
          .map(s => s.party)
          .filter(Boolean)
      )),
      session_duration: jsonData.statistics?.session_duration
    } : undefined
  };

  // Parse agenda items from either agenda or toc.items
  const agendaItems = (jsonData.agenda ?? jsonData.toc?.items ?? []).map(item => {
    const agendaItem = item as ProtocolAgendaItem;
    const speakerPages = Array.isArray(agendaItem.speakers)
      ? (agendaItem.speakers[0] as { pages?: number[] } | undefined)?.pages
      : undefined;

    return {
      agenda_number: String(agendaItem.number ?? agendaItem.agenda_number ?? ''),
      title: agendaItem.title,
      description: agendaItem.description || agendaItem.kind,
      page_number: agendaItem.page_number || speakerPages?.[0],
      item_type: agendaItem.item_type || agendaItem.kind || 'regular',
      speakers: agendaItem.speakers || [],
      drucksachen: agendaItem.drucksachen || [],
      subentries: agendaItem.subentries || [],
    };
  });

  // Parse speeches - speaker, role, party are on same level in JSON
  const speeches = jsonData.speeches.map(speech => {
    const speakerObj = typeof speech.speaker === 'object' ? speech.speaker : null;
    return {
      speaker_name: speakerObj ? speakerObj.name : speech.speaker as string,
      speaker_party: speech.party || speakerObj?.party,
      speaker_role: speech.role || speakerObj?.role,
      speech_content: speech.text,
      page_number: speech.page_number || speech.start_page,
      speech_type: speech.speech_type || 'main',
      timestamp: speech.timestamp,
      index: speech.index,
      agenda_item_number: speech.agenda_item_number,
      events: speech.events || [],
      events_flat: speech.events_flat || []
    };
  });

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

export function getJSONProtocolPreview(jsonData: unknown): {
  sessionInfo: string;
  speechCount: number;
  agendaCount: number;
  parties: string[];
  dateInfo: string;
} {
  if (!isJSONProtocolStructure(jsonData)) {
    throw new Error('Ungültiges JSON-Protokollformat.');
  }

  const parties = Array.from(new Set(
    jsonData.speeches
      .map(s => s.party)
      .filter((p): p is string => Boolean(p))
  ));

  const sessionInfo = `Sitzung ${jsonData.session.number || 'unbekannt'} (${jsonData.session.legislative_period || '17'}. Wahlperiode)`;
  const dateInfo = jsonData.session.date ? 
    new Date(jsonData.session.date).toLocaleDateString('de-DE') : 
    'Datum unbekannt';

  return {
    sessionInfo,
    speechCount: jsonData.speeches.length,
    agendaCount: jsonData.agenda?.length || jsonData.toc?.items?.length || 0,
    parties,
    dateInfo
  };
}
