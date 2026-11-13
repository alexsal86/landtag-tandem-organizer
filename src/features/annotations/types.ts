export type AnnotationFileKind = "pdf" | "image";
export type AnnotationType = "highlight" | "rect" | "polygon" | "arrow" | "note";
export type AnnotationColor = "yellow" | "green" | "red" | "blue";
export type AnnotationTool = "select" | AnnotationType;

/** All coordinates are fractions (0..1) of the page/image size, so they survive zoom and resizing. */
export interface FracRect { x: number; y: number; w: number; h: number }
export interface FracPoint { x: number; y: number }

export interface AnnotationTextPage { page_number: number; rects: FracRect[]; quote_text: string }

export interface AnnotationSelector {
  pages?: AnnotationTextPage[];
  rects?: FracRect[];
  points?: FracPoint[];
}

export interface DocumentAnnotation {
  id: string;
  tenant_id: string;
  document_id: string;
  parent_id: string | null;
  assigned_to: string | null;
  /** Linked task is read from document_annotation_tasks, not written directly. */
  task_id: string | null;
  task_status: string | null;
  file_kind: AnnotationFileKind;
  file_version: string | null;
  annotation_type: AnnotationType;
  page_number: number | null;
  target_selector: AnnotationSelector;
  quote_text: string | null;
  color: AnnotationColor;
  content: string;
  resolved: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DraftAnnotation {
  annotation_type: AnnotationType;
  page_number: number | null;
  target_selector: AnnotationSelector;
  quote_text: string | null;
}

export interface AnnotatableDocument {
  id: string;
  tenant_id: string;
  title: string;
  file_name: string;
  file_path: string;
  file_type?: string | null;
  file_size?: number | null;
  updated_at: string;
}

export type AnnotationPatch = Partial<Pick<DocumentAnnotation, "content" | "color" | "resolved" | "target_selector" | "assigned_to" | "quote_text" | "page_number" | "file_version">>;
