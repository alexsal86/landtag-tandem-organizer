import type { Database, Json } from "@/integrations/supabase/types";
import type { Document, DocumentFolder, Letter } from "./types";
import type { LetterRecord } from "@/components/letter-pdf/types";

export type DocumentActionResult =
  | { success: true }
  | { success: false; message: string };

export interface DocumentDialogState {
  showEditDialog: boolean;
  showMoveFolderDialog: boolean;
  showArchiveSettings: boolean;
  showArchivedLetterDetails: boolean;
  taskDialogMode: "task" | "subtask" | null;
}

export interface UploadDocumentMutationInput {
  type: "upload";
  title: string;
  description: string;
  category: string;
  tags: string[];
  status: string;
  folderId: string;
  contacts: string[];
  contactType: string;
}

export interface UpdateDocumentMutationInput {
  type: "update";
  documentId: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  status: string;
  folderId: string;
}

export interface CreateFolderMutationInput {
  type: "create-folder";
  name: string;
  description: string;
  color: string;
  parentFolderId: string | null;
}

export interface MoveDocumentMutationInput {
  type: "move-document";
  documentId: string;
  folderId: string;
}

export interface DeleteFolderMutationInput {
  type: "delete-folder";
  folderId: string;
}

export type DocumentMutationInput =
  | UploadDocumentMutationInput
  | UpdateDocumentMutationInput
  | CreateFolderMutationInput
  | MoveDocumentMutationInput
  | DeleteFolderMutationInput;

export interface DocumentCategoryOption {
  id: string;
  name: string;
  label: string;
}

export interface DocumentTagOption {
  id: string;
  label: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isDocumentCategoryOption = (value: unknown): value is DocumentCategoryOption => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.label === "string"
  );
};

export const isDocumentTagOption = (value: unknown): value is DocumentTagOption => {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.label === "string";
};

export const isDocumentFolderWithCount = (value: unknown): value is DocumentFolder => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.user_id === "string" &&
    typeof value.tenant_id === "string" &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const asJson = (value: unknown): Json => value as Json;

export const toArchivedLetterDocumentRow = (
  document: Document,
): Database["public"]["Tables"]["documents"]["Row"] => ({
  archived_attachments: Array.isArray(document.archived_attachments)
    ? asJson(document.archived_attachments)
    : null,
  category: document.category ?? null,
  created_at: document.created_at,
  description: document.description ?? null,
  document_type: document.document_type ?? null,
  file_name: document.file_name,
  file_path: document.file_path,
  file_size: document.file_size ?? null,
  file_type: document.file_type ?? null,
  folder_id: document.folder_id ?? null,
  id: document.id,
  source_letter_id: document.source_letter_id ?? null,
  status: document.status ?? null,
  tags: isStringArray(document.tags) ? document.tags : null,
  tenant_id: document.tenant_id,
  title: document.title,
  updated_at: document.updated_at,
  user_id: document.user_id,
  workflow_history: null,
});

export const toArchivableLetterRecord = (letter: Letter): LetterRecord | null => {
  if (!letter.id) {
    return null;
  }

  return {
    id: letter.id!,
    title: letter.title,
    content: letter.content,
    content_html: letter.content_html ?? '',
    recipient_name: letter.recipient_name ?? null,
    recipient_address: letter.recipient_address ?? null,
    template_id: letter.template_id ?? null,
    subject: null,
    reference_number: null,
    sender_info_id: letter.sender_info_id ?? null,
    information_block_ids: letter.information_block_ids ?? null,
    letter_date: null,
    status: letter.status,
    sent_date: letter.sent_date ?? null,
    created_at: letter.created_at,
    show_pagination: letter.show_pagination ?? null,
    contact_id: letter.contact_id ?? null,
    expected_response_date: letter.expected_response_date ?? null,
    created_by: letter.created_by,
    updated_at: letter.updated_at,
    tenant_id: letter.tenant_id,
    sent_method: letter.sent_method ?? null,
    user_id: letter.user_id,
    archived_at: letter.archived_at ?? null,
  };
};
