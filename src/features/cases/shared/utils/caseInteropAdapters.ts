import type { PostgrestError } from "@supabase/supabase-js";
import type { CaseItemFormData } from "@/features/cases/items/hooks/useCaseItems";
import type { CaseFile, CaseFileTask } from "@/features/cases/files/hooks/useCaseFileDetails";

export type CaseItemUpdatePayload = Partial<CaseItemFormData> & { intake_payload: CaseItemFormData["intake_payload"] | null };

// INTEROP-ANY(TS-4824, Cases-Items, 2026-04-22): Supabase update payload for polymorphic intake JSON is not fully inferred yet.
export const buildCaseItemUpdatePayload = (data: Partial<CaseItemFormData>): CaseItemUpdatePayload => {
  return { ...data, intake_payload: data.intake_payload ?? null } as any;
};

// INTEROP-ANY(TS-4829, Cases-DetailsHook, 2026-04-22): interaction insert spans polymorphic source variants pending generated insert helper.
export const buildCaseItemInteractionInsertPayload = (
  interaction: Record<string, unknown>,
  createdBy: string,
): ReadonlyArray<Record<string, unknown>> => {
  return [{ ...interaction, created_by: createdBy }] as any;
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

// INTEROP-ANY(TS-4825, Cases-Files, 2026-04-22): mixed mutation errors (Supabase/query) still have heterogeneous third-party shapes.
export const extractLinkErrorCode = (error: unknown): string | null => {
  const maybeError = error as any;
  if (!maybeError || typeof maybeError !== "object") return null;
  return typeof maybeError.code === "string" ? maybeError.code : null;
};

export const extractErrorMessage = (error: unknown): string | null => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : null;
  }
  return null;
};

// INTEROP-ANY(TS-4828, Cases-CurrentStatus, 2026-04-22): legacy rows still mix `processing_status` and `processing_statuses` JSONB variants.
export const getCaseFileProcessingStatuses = (caseFile: CaseFile): string[] => {
  const row = caseFile as any;
  const statuses = row.processing_statuses;
  if (Array.isArray(statuses)) {
    return statuses.filter((status): status is string => typeof status === "string");
  }
  if (typeof row.processing_status === "string") {
    return [row.processing_status];
  }
  return [];
};

// INTEROP-ANY(TS-4826, Cases-Timeline, 2026-04-22): joined task payload may still be represented as untyped record in legacy queries.
export const getCaseTaskDescription = (task: CaseFileTask["task"]): string | null => {
  const rawTask = task as any;
  const description = rawTask?.description;
  return typeof description === "string" ? description : null;
};

// INTEROP-ANY(TS-4827, Cases-NextSteps, 2026-04-22): joined link rows from case_file_tasks are only partially typed in current select.
export const isMatchingCaseParentTaskLink = (link: unknown, expectedTitle: string): boolean => {
  const row = link as any;
  const task = row?.task;
  if (!task || typeof task !== "object") return false;
  const title = typeof task.title === "string" ? task.title.trim() : null;
  return Boolean(title && title === expectedTitle && !task.parent_task_id);
};
