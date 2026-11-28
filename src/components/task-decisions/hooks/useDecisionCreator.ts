import { useTenant } from "@/hooks/useTenant";
import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import { debugConsole } from "@/utils/debugConsole";
import { supabase } from "@/integrations/supabase/client";
import { useDecisionAttachmentUpload } from "@/hooks/useDecisionAttachmentUpload";
import type { EmailMetadata } from "@/utils/emlParser";
import { saveDecisionTopics } from "@/hooks/useDecisionTopics";
import { toast } from "@/hooks/use-toast";
import {
  DEFAULT_TEMPLATE_ID,
  ResponseOption,
  getTemplateById,
} from "@/lib/decisionTemplates";
import type { DecisionParticipantProfile } from "../types/domain";
import { notify } from "@/lib/notify";

type Profile = Pick<DecisionParticipantProfile, "user_id" | "display_name">;



interface MatrixInvokeResult {
  sent: number;
  total_participants: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isMatrixInvokeResult = (value: unknown): value is MatrixInvokeResult => {
  if (!isRecord(value)) return false;
  const sent = value.sent;
  const totalParticipants = value.total_participants;
  return typeof sent === "number" && typeof totalParticipants === "number";
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

interface UseDecisionCreatorParams {
  taskId?: string;
  caseItemId?: string;
  caseFileId?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialTitle?: string;
  initialDescription?: string;
  onDecisionCreated: () => void;
  onCreatedWithId?: (decisionId: string) => void;
}

export const useDecisionCreator = ({
  taskId,
  caseItemId,
  caseFileId,
  isOpen: externalOpen,
  onOpenChange: externalOnOpenChange,
  initialTitle,
  initialDescription,
  onDecisionCreated,
  onCreatedWithId,
}: UseDecisionCreatorParams) => {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const creationId = useRef(crypto.randomUUID());
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const isOpen = isControlled ? externalOpen : internalOpen;

  const [title, setTitle] = useState(initialTitle || "");
  const [description, setDescription] = useState(initialDescription || "");
  const [responseDeadline, setResponseDeadline] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [sendByEmail, setSendByEmail] = useState(true);
  const [sendViaMatrix, setSendViaMatrix] = useState(true);
  const [visibleToAll, setVisibleToAll] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedFileMetadata, setSelectedFileMetadata] = useState<Record<string, EmailMetadata | null>>({});
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [priority, setPriority] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const defaultTemplate = getTemplateById(DEFAULT_TEMPLATE_ID);
  const [customOptions, setCustomOptions] = useState<ResponseOption[]>(
    defaultTemplate
      ? defaultTemplate.options.map((option) => ({ ...option }))
      : [
          { key: "option_1", label: "Option 1", color: "blue" },
          { key: "option_2", label: "Option 2", color: "green" },
        ],
  );

  const { uploadDecisionAttachments } = useDecisionAttachmentUpload();

  const currentOptions = useMemo(() => customOptions, [customOptions]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && isLoading) return;

      if (isControlled && externalOnOpenChange) {
        externalOnOpenChange(open);
      } else {
        setInternalOpen(open);
      }
    },
    [isControlled, externalOnOpenChange, isLoading],
  );

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle || "");
      setDescription(initialDescription || "");
    } else {
      setProfilesLoaded(false);
    }
  }, [isOpen, initialTitle, initialDescription]);

  const handleTemplateChange = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId !== "custom") {
      const template = getTemplateById(templateId);
      if (template) {
        setCustomOptions(template.options.map((option) => ({ ...option })));
      }
    }
  }, []);

  const loadProfiles = useCallback(async () => {
    try {
      if (!tenantId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: memberships, error: membershipError } = await supabase
        .from("user_tenant_memberships")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);
      if (membershipError) throw membershipError;

      const memberIds = [...new Set((memberships ?? []).map(({ user_id }) => user_id))];
      if (memberIds.length === 0) {
        setProfiles([]);
        setSelectedUsers([]);
        setProfilesLoaded(true);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", memberIds)
        .order("display_name");

      if (error) throw error;
      setProfiles(data ?? []);
      const tenantUserIds = new Set((data ?? []).map(({ user_id }) => user_id));

      let defaultIds: string[] = [];
      let defaultSettings: { participants?: string[]; visibleToAll?: boolean; sendByEmail?: boolean; sendViaMatrix?: boolean } | null = null;
      try {
        const stored = localStorage.getItem("default_decision_settings");
        if (stored) {
          defaultSettings = JSON.parse(stored);
          defaultIds = defaultSettings?.participants || [];
        } else {
          const oldStored = localStorage.getItem("default_decision_participants");
          if (oldStored) {
            const parsed = JSON.parse(oldStored);
            if (Array.isArray(parsed)) defaultIds = parsed;
          }
        }
      } catch (error) {
        debugConsole.error("Error loading default participants:", error);
      }

      if (defaultSettings) {
        if (typeof defaultSettings.visibleToAll === "boolean") setVisibleToAll(defaultSettings.visibleToAll);
        if (typeof defaultSettings.sendByEmail === "boolean") setSendByEmail(defaultSettings.sendByEmail);
        if (typeof defaultSettings.sendViaMatrix === "boolean") setSendViaMatrix(defaultSettings.sendViaMatrix);
      }

      if (defaultIds.length > 0) {
        const validDefaults = defaultIds.filter((id) => tenantUserIds.has(id) && id !== userData.user.id);
        if (validDefaults.length > 0) {
          setSelectedUsers(validDefaults);
          setProfilesLoaded(true);
          return;
        }
      }

      const { data: deputyIds, error: deputyError } = await supabase.rpc("list_task_deputy_ids", {
        p_tenant_id: tenantId,
      });
      if (deputyError) throw deputyError;
      setSelectedUsers((deputyIds ?? []).filter((id) => tenantUserIds.has(id) && id !== userData.user.id));

      setProfilesLoaded(true);
    } catch (error) {
      setUploadStatus(null);
      debugConsole.error("Error loading profiles:", error);
      notify.error("Benutzer konnten nicht geladen werden");
      setProfilesLoaded(true);
    }
  }, [tenantId]);

  useEffect(() => {
    if (isOpen && !profilesLoaded) {
      void loadProfiles();
    }
  }, [isOpen, profilesLoaded, loadProfiles]);

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setResponseDeadline("");
    setSelectedUsers([]);
    setSelectedFiles([]);
    setSelectedFileMetadata({});
    setSelectedTopicIds([]);
    setSendByEmail(false);
    setSendViaMatrix(false);
    setVisibleToAll(true);
    setPriority(false);
    setSelectedTemplateId(DEFAULT_TEMPLATE_ID);
    const resetTemplate = getTemplateById(DEFAULT_TEMPLATE_ID);
    setCustomOptions(resetTemplate ? resetTemplate.options.map((option) => ({ ...option })) : []);
    setProfilesLoaded(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      notify.error("Fehler", {
        description: "Bitte geben Sie einen Titel ein."
});
      return;
    }

    if (!visibleToAll && selectedUsers.length === 0) {
      notify.error("Fehler", {
        description: "Bitte wählen Sie mindestens einen Benutzer aus oder machen Sie die Entscheidung öffentlich."
});
      return;
    }

    setIsLoading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        debugConsole.error("Auth error:", userError);
        throw new Error(`Authentication error: ${userError.message}`);
      }

      if (!userData.user) {
        debugConsole.error("No user found");
        throw new Error("User not authenticated");
      }

      const tenantData = currentTenant;
      if (!tenantData) throw new Error("Kein Büro ausgewählt");
      const profileIds = new Set(profiles.map(({ user_id }) => user_id));
      const validSelectedUsers = selectedUsers.filter((userId) => profileIds.has(userId));

      if (!visibleToAll && validSelectedUsers.length === 0) {
        notify.error("Fehler", {
          description: "Bitte wählen Sie mindestens einen Benutzer aus Ihrem Tenant aus oder machen Sie die Entscheidung öffentlich."
});
        return;
      }

      const insertData = {
        task_id: taskId ?? null,
        case_item_id: caseItemId ?? null,
        case_file_id: caseFileId ?? null,
        title: title.trim(),
        description: description.trim() || null,
        response_deadline: responseDeadline ? new Date(responseDeadline).toISOString() : null,
        created_by: userData.user.id,
        tenant_id: tenantData.id,
        visible_to_all: visibleToAll,
        response_options: JSON.parse(JSON.stringify(currentOptions)),
        priority: priority ? 1 : 0,
      };

      const { data: decisionJson, error: decisionError } = await supabase.rpc("create_work_decision", {
        p_id: creationId.current, p_data: insertData, p_participants: validSelectedUsers, p_note_id: undefined,
      });
      const decision = decisionJson as unknown as { id: string };

      if (decisionError) {
        debugConsole.error("Decision creation error:", decisionError);
        throw decisionError;
      }

      if (selectedFiles.length > 0) {
        const uploadResult = await uploadDecisionAttachments({
          decisionId: decision.id,
          userId: userData.user.id,
          files: selectedFiles,
          metadataByIdentity: selectedFileMetadata,
          rollbackOnAnyFailure: true,
          onFileStart: (file, index, total) => {
            setUploadStatus(`Lade Anhang ${index + 1}/${total}: ${file.name}`);
          },
        });

        if (uploadResult.failed.length > 0) {
          await supabase.from("task_decisions").delete().eq("id", decision.id);
          throw new Error(
            `Anhänge konnten nicht gespeichert werden: ${uploadResult.failed.map((failedFile) => `${failedFile.fileName}: ${failedFile.reason}`).join(" | ")}`,
          );
        }
      }

      if (selectedTopicIds.length > 0) {
        await saveDecisionTopics(decision.id, selectedTopicIds);
      }

      // Die Anfrage meldet der Trigger auf task_decision_participants im Mandanten der
      // Entscheidung; create_work_decision legt die Teilnehmer mit an.

      if (sendViaMatrix) {
        try {
          notify.success("Matrix-Nachrichten werden versendet...", {
            description: "Die Matrix-Entscheidungsanfragen werden an die ausgewählten Teilnehmer gesendet."
});

          const { data: matrixResult, error: matrixError } = await supabase.functions.invoke("matrix-bot-handler", {
            body: {
              type: "decision",
              decisionId: decision.id,
              participantIds: validSelectedUsers,
              decisionTitle: title.trim(),
              decisionDescription: description.trim() || null,
            },
          });

          if (matrixError) {
            debugConsole.error("Error sending Matrix decisions:", matrixError);
            notify.error("Matrix-Fehler", {
              description: `Matrix-Nachrichten konnten nicht versendet werden: ${matrixError.message}`
});
          } else if (isMatrixInvokeResult(matrixResult)) {
            const successCount = matrixResult.sent;
            const totalCount = matrixResult.total_participants || validSelectedUsers.length;

            if (successCount > 0) {
              notify.success("Matrix-Nachrichten versendet", {
                description: `${successCount}/${totalCount} Matrix-Entscheidungen erfolgreich versendet.`
});
            } else {
              notify.error("Matrix-Warnung", {
                description: "Keine Matrix-Nachrichten konnten versendet werden. Überprüfen Sie die Matrix-Konfiguration."
});
            }
          } else {
            notify.error("Matrix-Warnung", {
              description: "Matrix-Rückgabe hatte ein unerwartetes Format."
});
          }
        } catch (matrixError: unknown) {
          debugConsole.error("Error sending Matrix decisions:", matrixError);
          notify.error("Matrix-Fehler", {
            description: `Unerwarteter Fehler beim Matrix-Versand: ${getErrorMessage(matrixError)}`
});
        }
      }

      // Der E-Mail-Versand läuft serverseitig über die Outbox; hier wird nur die
      // Absicht festgehalten, damit auch später hinzugefügte Teilnehmende erfasst sind.
      if (sendByEmail) {
        try {
          const { data: released, error: inviteError } = await supabase
            .rpc("request_decision_email_invites", { _decision_id: decision.id });

          if (inviteError || released !== true) {
            debugConsole.error("Einladungsversand konnte nicht freigegeben werden:", inviteError);
            notify.error("E-Mail-Fehler", {
              description: `Einladungen konnten nicht vorbereitet werden: ${inviteError.message}`
            });
          } else {
            notify.success("Einladungen werden vorbereitet", {
              description: "Der E-Mail-Versand läuft im Hintergrund und an alle Teilnehmenden."
            });
          }
        } catch (emailError: unknown) {
          debugConsole.error("Einladungsversand konnte nicht vorbereitet werden:", emailError);
          notify.error("E-Mail-Fehler", {
            description: `Unerwarteter Fehler: ${getErrorMessage(emailError)}`
          });
        }
      }

      notify.success("Erfolgreich", {
        description:
          sendByEmail || sendViaMatrix
            ? "Entscheidungsanfrage wurde erstellt und Versand wird geprüft."
            : "Entscheidungsanfrage wurde erstellt."
});

      resetForm();
      handleOpenChange(false);
      creationId.current = crypto.randomUUID();
      onDecisionCreated();
      if (onCreatedWithId && decision?.id) onCreatedWithId(decision.id);
    } catch (error) {
      setUploadStatus(null);
      debugConsole.error("Error creating decision:", error);
      notify.error("Fehler", {
        description:
          error instanceof Error ? error.message : "Entscheidungsanfrage konnte nicht erstellt werden."
});
    } finally {
      setIsLoading(false);
      setUploadStatus(null);
    }
  }, [
    currentTenant,
    caseItemId,
    caseFileId,
    currentOptions,
    description,
    handleOpenChange,
    onCreatedWithId,
    onDecisionCreated,
    priority,
    profiles,
    resetForm,
    responseDeadline,
    selectedFileMetadata,
    selectedFiles,
    selectedTopicIds,
    selectedUsers,
    sendByEmail,
    sendViaMatrix,
    taskId,
    title,
    toast,
    uploadDecisionAttachments,
    visibleToAll,
  ]);

  const userOptions = useMemo(
    () =>
      Array.isArray(profiles)
        ? profiles.map((profile) => ({
            value: profile.user_id,
            label: profile.display_name || "Unbekannter Benutzer",
          }))
        : [],
    [profiles],
  );

  return {
    isOpen,
    isControlled,
    handleOpenChange,
    loadProfiles,
    handleSubmit,
    title,
    setTitle,
    description,
    setDescription,
    responseDeadline,
    setResponseDeadline,
    selectedUsers,
    setSelectedUsers,
    profilesLoaded,
    userOptions,
    isLoading,
    uploadStatus,
    sendByEmail,
    setSendByEmail,
    sendViaMatrix,
    setSendViaMatrix,
    visibleToAll,
    setVisibleToAll,
    setSelectedFiles,
    setSelectedFileMetadata,
    selectedTopicIds,
    setSelectedTopicIds,
    priority,
    setPriority,
    selectedTemplateId,
    handleTemplateChange,
    customOptions,
    setCustomOptions,
    currentOptions,
  };
};
