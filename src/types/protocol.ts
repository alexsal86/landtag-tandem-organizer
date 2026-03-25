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
