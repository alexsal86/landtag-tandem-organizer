export interface ProtocolEvent {
  type: string;
  text?: string;
  message?: string;
  speaker?: string;
  party?: string;
  line_index?: number;
}

export interface PlenaryItem {
  agenda_item_number?: string | number;
  speaker?: string;
  speaker_name?: string;
  speaker_party?: string;
  speaker_role?: string;
  text?: string;
  speech_content?: string;
  timestamp?: string;
  start_page?: number;
  page_number?: number;
  events_flat?: ProtocolEvent[];
}

export interface ProtocolAttachment {
  number: string | number;
  title: string;
  kind?: string;
  speakers?: Array<{
    name?: string;
    role?: string;
    party?: string;
  }>;
}

export interface ProtocolStructuredData {
  session?: {
    number?: string | number;
    legislative_period?: string | number;
    date?: string;
  };
  sitting?: {
    time?: string;
    location?: string;
  };
  speeches?: PlenaryItem[];
  toc?: {
    items?: ProtocolAttachment[];
  };
}

export interface ProtocolRecord {
  id: string;
  protocol_date: string;
  session_number: string;
  legislature_period: string;
  original_filename?: string;
  processing_status?: string;
  structured_data?: ProtocolStructuredData | null;
}

export interface UploadResult extends ProtocolRecord {
  file_path?: string | null;
  file_size?: number | null;
}

export interface JSONProtocolPreview {
  sessionInfo: string;
  speechCount: number;
  agendaCount: number;
  parties: string[];
  dateInfo: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const isProtocolAttachment = (value: unknown): value is ProtocolAttachment => {
  if (!isRecord(value)) return false;
  return (
    (typeof value.number === 'string' || typeof value.number === 'number') &&
    typeof value.title === 'string'
  );
};

export const isPlenaryItem = (value: unknown): value is PlenaryItem => {
  if (!isRecord(value)) return false;
  const hasSpeaker =
    typeof value.speaker === 'string' || typeof value.speaker_name === 'string';
  const hasText =
    typeof value.text === 'string' || typeof value.speech_content === 'string';
  return hasSpeaker || hasText;
};

export const isProtocolStructuredData = (value: unknown): value is ProtocolStructuredData =>
  isRecord(value);

export const isUploadResult = (value: unknown): value is UploadResult => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.protocol_date === 'string' &&
    typeof value.session_number === 'string' &&
    typeof value.legislature_period === 'string'
  );
};
