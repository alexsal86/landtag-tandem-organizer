import type { Dispatch, SetStateAction } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { debugConsole } from "@/utils/debugConsole";
import type { AgendaDocument, AgendaItem } from "@/components/meetings/types";

export function showDocumentActionError(
  action: "download" | "upload" | "delete",
  error: unknown,
) {
  debugConsole.error(`${action[0].toUpperCase()}${action.slice(1)} error:`, error);

  const actionText: Record<typeof action, string> = {
    download: "Datei konnte nicht heruntergeladen werden.",
    upload: "Dokument konnte nicht hochgeladen werden.",
    delete: "Dokument konnte nicht gelöscht werden.",
  };

  const titleText: Record<typeof action, string> = {
    download: "Download-Fehler",
    upload: "Upload-Fehler",
    delete: "Lösch-Fehler",
  };

  notify.error(titleText[action], {
    description: actionText[action],
  });
}

export interface AgendaDocumentsOptions {
  meetingId: string | undefined;
  onSetAgendaItems: Dispatch<SetStateAction<AgendaItem[]>>;
  onUploadAgendaDocument: (
    agendaItemId: string,
    file: File,
  ) => Promise<AgendaDocument | null>;
}

/**
 * Agenda-Punkte ohne ID werden vor einem Dokument-Upload persistiert, damit das
 * Dokument einen stabilen Bezug hat.
 */
export function useAgendaDocuments({
  meetingId,
  onSetAgendaItems,
  onUploadAgendaDocument,
}: AgendaDocumentsOptions) {
  const persistAgendaItemIfNeeded = async (item: AgendaItem, index: number) => {
    if (item.id) return item.id;

    const { data: savedItem, error: saveError } = await supabase
      .from("meeting_agenda_items")
      .insert([
        {
          meeting_id: meetingId!,
          title: item.title || "Agenda-Punkt",
          description: item.description || "",
          notes: item.notes || "",
          parent_id: item.parent_id || null,
          order_index: item.order_index,
          icon_config: item.icon_config ?? null,
          duration_minutes:
            item.parent_id || item.parentLocalKey
              ? null
              : (item.duration_minutes ?? null),
          assigned_to: item.assigned_to,
          carry_over_to_next: item.carry_over_to_next,
          is_completed: Boolean(item.is_completed),
          is_recurring: Boolean(item.is_recurring),
        },
      ])
      .select()
      .single();

    if (saveError) throw saveError;

    onSetAgendaItems((prevItems) =>
      prevItems.map((prevItem, prevIndex) =>
        prevIndex === index ? { ...prevItem, id: savedItem.id } : prevItem,
      ),
    );

    return savedItem.id;
  };

  const handleAgendaDocumentUpload = async (
    item: AgendaItem,
    index: number,
  ) => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg";

    fileInput.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];

      if (!file || !meetingId) return;

      try {
        const itemId = await persistAgendaItemIfNeeded(item, index);
        await onUploadAgendaDocument(itemId, file);
        notify.success("Dokument hochgeladen", {
          description: "Das Dokument wurde erfolgreich hinzugefügt.",
        });
      } catch (error) {
        showDocumentActionError("upload", error);
      }
    };

    fileInput.click();
  };

  return {
    persistAgendaItemIfNeeded,
    handleAgendaDocumentUpload,
    showDocumentActionError,
  };
}
