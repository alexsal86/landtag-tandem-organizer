import type { CaseItemFormData } from "@/features/cases/items/hooks/useCaseItems";

type PostgrestError = { message: string; details?: string; hint?: string; code?: string };
type CaseFile = Record<string, unknown>;
type CaseFileTask = Record<string, unknown>;

export type CaseItemUpdatePayload = Partial<CaseItemFormData> & {
  intake_payload: CaseItemFormData["intake_payload"] | null;
};

export type CaseItemInteractionInsertPayload = Readonly<Record<string, unknown>> & {
  created_by: string;
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
};

export const buildCaseItemUpdatePayload = (data: Partial<CaseItemFormData>): CaseItemUpdatePayload => {
  return { ...data, intake_payload: data.intake_payload ?? null };
};

export const buildCaseItemInteractionInsertPayload = (
  interaction: Readonly<Record<string, unknown>>,
  createdBy: string,
): ReadonlyArray<CaseItemInteractionInsertPayload> => {
  return [{ ...interaction, created_by: createdBy }];
};

export const isPostgrestError = (error: unknown): error is PostgrestError => {
  return Boolean(
    error &&
      typeof error === "object" &&
      "message" in error &&
      "details" in error &&
      "hint" in error &&
      "code" in error,
  );
};

export const extractLinkErrorCode = (error: unknown): string | null => {
  const maybeError = toRecord(error);
  const code = maybeError?.code;
  return typeof code === "string" ? code : null;
};

export const extractErrorMessage = (error: unknown): string | null => {
  if (error instanceof Error) return error.message;

  const maybeError = toRecord(error);
  const message = maybeError?.message;
  return typeof message === "string" ? message : null;
};

export const getCaseFileProcessingStatuses = (caseFile: CaseFile): string[] => {
  const row = toRecord(caseFile);
  if (!row) return [];

  const statuses = row.processing_statuses;
  if (Array.isArray(statuses)) {
    return statuses.filter((status): status is string => typeof status === "string");
  }

  const fallbackStatus = row.processing_status;
  return typeof fallbackStatus === "string" ? [fallbackStatus] : [];
};

export const getCaseTaskDescription = (task: CaseFileTask["task"]): string | null => {
  const taskRecord = toRecord(task);
  const description = taskRecord?.description;
  return typeof description === "string" ? description : null;
};

export const isMatchingCaseParentTaskLink = (link: unknown, expectedTitle: string): boolean => {
  const linkRecord = toRecord(link);
  const taskRecord = toRecord(linkRecord?.task);
  if (!taskRecord) return false;

  const title = typeof taskRecord.title === "string" ? taskRecord.title.trim() : null;
  const parentTaskId = taskRecord.parent_task_id;
  return Boolean(title && title === expectedTitle && (parentTaskId === null || parentTaskId === undefined));
};
