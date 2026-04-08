export interface Dossier {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  priority: string;
  owner_id: string | null;
  topic_id: string | null;
  tenant_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  open_questions: string | null;
  positions: string | null;
  risks_opportunities: string | null;
  notes_html: string | null;
  review_interval_days: number | null;
  next_review_at: string | null;
  last_briefing_at: string | null;
}

export interface DossierEntry {
  id: string;
  dossier_id: string | null;
  entry_type: string;
  title: string | null;
  content: string | null;
  source_url: string | null;
  file_path: string | null;
  file_name: string | null;
  metadata: Record<string, unknown>;
  is_curated: boolean;
  is_pinned: boolean;
  created_by: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export interface DossierLink {
  id: string;
  dossier_id: string;
  linked_type: string;
  linked_id: string;
  created_at: string;
}

export type DossierStatus = 'beobachten' | 'aktiv' | 'ruhend' | 'archiviert';
export type DossierPriority = 'hoch' | 'mittel' | 'niedrig';
export type EntryType = 'notiz' | 'datei' | 'link' | 'email' | 'zitat';

export const DOSSIER_STATUS_OPTIONS: { value: DossierStatus; label: string }[] = [
  { value: 'beobachten', label: 'Beobachten' },
  { value: 'aktiv', label: 'Aktiv' },
  { value: 'ruhend', label: 'Ruhend' },
  { value: 'archiviert', label: 'Archiviert' },
];

export const DOSSIER_PRIORITY_OPTIONS: { value: DossierPriority; label: string }[] = [
  { value: 'hoch', label: 'Hoch' },
  { value: 'mittel', label: 'Mittel' },
  { value: 'niedrig', label: 'Niedrig' },
];

export const ENTRY_TYPE_CONFIG: Record<EntryType, { label: string; icon: string }> = {
  notiz: { label: 'Notiz', icon: '📝' },
  datei: { label: 'Datei', icon: '📎' },
  link: { label: 'Link', icon: '🔗' },
  email: { label: 'E-Mail', icon: '✉️' },
  zitat: { label: 'Zitat', icon: '💬' },
};


export interface DossierSourceWatcher {
  id: string;
  dossier_id: string;
  tenant_id: string;
  source_type: "rss" | "presse" | "verband";
  source_name: string;
  source_url: string;
  keywords: string[];
  is_active: boolean;
  last_checked_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}
