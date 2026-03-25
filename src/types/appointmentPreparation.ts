export type PreparationStatus = 'draft' | 'in_progress' | 'completed';

export interface PreparationField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  options?: ReadonlyArray<string>;
}

export interface TemplateSection {
  id?: string;
  title: string;
  type: 'section' | 'checklist';
  fields?: ReadonlyArray<PreparationField>;
  items?: ReadonlyArray<ChecklistItemTemplate>;
}

export interface ChecklistItemTemplate {
  id: string;
  label: string;
}

export interface ChecklistItem extends ChecklistItemTemplate {
  completed: boolean;
}

export type PreparationData = Record<string, string>;

export interface AppointmentPreparation {
  id: string;
  title: string;
  status: PreparationStatus;
  preparation_data: PreparationData;
  checklist_items: ReadonlyArray<ChecklistItem>;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
  template_id: string | null;
}

export interface AppointmentPreparationTemplate {
  id: string;
  name: string;
  description: string | null;
  template_data: ReadonlyArray<TemplateSection>;
  is_default?: boolean;
  is_active: boolean;
  created_at: string;
}
