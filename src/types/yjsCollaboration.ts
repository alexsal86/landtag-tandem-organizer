export interface CursorPosition {
  line: number;
  ch: number;
}

export interface SelectionState {
  anchor: CursorPosition;
  head: CursorPosition;
}

export interface CollaborationProfile {
  display_name: string;
  avatar_url?: string;
}

export interface YjsCollaborator {
  user_id: string;
  user_color: string;
  cursor_position?: CursorPosition | null;
  selection_state?: SelectionState | null;
  profiles?: CollaborationProfile;
}

export interface AwarenessState {
  user_id: string;
  user_color: string;
  cursor_position: CursorPosition | null;
  selection_state: SelectionState | null;
}

export interface YjsUpdatePayload {
  userId: string;
  update: number[];
}

export interface AwarenessUpdatePayload extends AwarenessState {}

export type CollaborationBroadcastPayload = YjsUpdatePayload | AwarenessUpdatePayload;

export type CollaborationBroadcastEvent =
  | {
      event: 'yjs-update';
      payload: YjsUpdatePayload;
    }
  | {
      event: 'awareness-update';
      payload: AwarenessUpdatePayload;
    };

export type YjsDocumentUpdate =
  | {
      source: 'local';
      update: Uint8Array;
      userId: string;
    }
  | {
      source: 'remote';
      update: Uint8Array;
      userId: string;
    };

export interface SupabaseBroadcastEnvelope<TPayload> {
  payload: TPayload;
}
