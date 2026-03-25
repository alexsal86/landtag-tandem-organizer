export interface ProtocolSpeakerRef {
  name: string;
  role?: string;
  party?: string;
  pages?: number[];
}

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

export type ProtocolSpeechType = 'main' | 'interjection' | 'applause' | 'interruption';
export type ProtocolSessionType = 'start' | 'end' | 'break_start' | 'break_end';

export interface ProtocolAnalysisSpeech {
  speaker_name: string;
  speaker_party?: string;
  speech_content: string;
  start_time?: string;
  speech_type: ProtocolSpeechType;
}

export interface ProtocolSessionEvent {
  session_type: ProtocolSessionType;
  timestamp: string;
  notes: string;
}

export interface ProtocolSessionMeta {
  number?: string | number;
  legislative_period?: string | number;
  date?: string;
  extracted_at?: string;
  source_pdf_url?: string;
  next_meeting?: { raw?: string } | null;
}

export interface ProtocolSittingBreak {
  type?: string;
  time?: string;
}

export interface ProtocolSittingMeta {
  location?: string;
  start_time?: string;
  end_time?: string;
  breaks?: ProtocolSittingBreak[];
}

export interface ProtocolLayoutMeta {
  applied?: boolean;
  reason?: string;
}

export interface ProtocolStats {
  pages?: number;
}

export interface ProtocolSpeechOverviewItem {
  speaker?: string;
}
