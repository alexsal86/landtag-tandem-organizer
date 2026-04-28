import { useCallback, useEffect, useMemo, useState } from "react";
import { debugConsole } from "@/utils/debugConsole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDecisionAttachmentUpload } from "@/hooks/useDecisionAttachmentUpload";
import type { EmailMetadata } from "@/utils/emlParser";
import { saveDecisionTopics } from "@/hooks/useDecisionTopics";
import {
  DEFAULT_TEMPLATE_ID,
  ResponseOption,
  getTemplateById,
} from "@/lib/decisionTemplates";
import type { DecisionParticipantProfile } from "../types/domain";

type Profile = Pick<DecisionParticipantProfile, "user_id" | "display_name">;



interface MatrixInvokeResult {
  sent: number;
  total_participants: number;
}

interface EmailResultItem {
  success: boolean;
}

interface EmailInvokeResult {
  results: EmailResultItem[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isMatrixInvokeResult = (value: unknown): value is MatrixInvokeResult => {
  if (!isRecord(value)) return false;
  const sent = value.sent;
  const totalParticipants = value.total_participants;
  return typeof sent === "number" && typeof totalParticipants === "number";
};

const isEmailInvokeResult = (value: unknown): value is EmailInvokeResult => {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.results)) return false;
  return value.results.every((result) => isRecord(result) && typeof result.success === "boolean");
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

interface UseDecisionCreatorParams {
  taskId?: string;
  caseItemId?: string;
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
  isOpen: externalOpen,
  onOpenChange: externalOnOpenChange,
  initialTitle,
  initialDescription,
  onDecisionCreated,
  onCreatedWithId,
}: UseDecisionCreatorParams) => {
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

  const { toast } = useToast();
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
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: tenantData } = await supabase
        .from("user_tenant_memberships")
        .select("tenant_id")
        .eq("user_id", userData.user.id)
        .eq("is_active", true)
        .single();

      if (!tenantData?.tenant_id) {
        setProfiles([]);
        setProfilesLoaded(true);
        return;
      }

      const { data: tenantMembers } = await supabase
        .from("user_tenant_memberships")
        .select("user_id")
        .eq("tenant_id", tenantData.tenant_id)
        .eq("is_active", true);

      const tenantUserIdsArray = tenantMembers?.map((member: Record<string, any>) => member.user_id) || [];
      const tenantUserIds = new Set(tenantUserIdsArray);

      if (tenantUserIdsArray.length > 0) {
        const { data, error } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", tenantUserIdsArray)
          .order("display_name");

        if (error) throw error;
        setProfiles(data || []);
      } else {
        setProfiles([]);
      }

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

      const { data: roleData } = await supabase.from("user_roles").select("user_id").eq("role", "abgeordneter");
      if (roleData && roleData.length > 0) {
        const abgeordneteInTenant = roleData.filter((role: Record<string, any>) => tenantUserIds.has(role.user_id)).map((role: Record<string, any>) => role.user_id);
        setSelectedUsers(abgeordneteInTenant);
      }

      setProfilesLoaded(true);
    } catch (error) {
      setUploadStatus(null);
      debugConsole.error("Error loading profiles:", error);
      setProfilesLoaded(true);
    }
  }, []);

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
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Titel ein.",
        variant: "destructive",
      });
      return;
    }

    if (!visibleToAll && selectedUsers.length === 0) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie mindestens einen Benutzer aus oder machen Sie die Entscheidung öffentlich.",
        variant: "destructive",
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

      const { data: tenantData, error: tenantError } = await supabase
        .from("user_tenant_memberships")
        .select("tenant_id")
        .eq("user_id", userData.user.id)
        .eq("is_active", true)
        .single();

      if (tenantError || !tenantData) {
        debugConsole.error("Tenant lookup error:", tenantError);
        throw new Error("Unable to determine user tenant");
      }

      const { data: tenantMembers } = await supabase
        .from("user_tenant_memberships")
        .select("user_id")
        .eq("tenant_id", tenantData.tenant_id)
        .eq("is_active", true);

      const tenantUserIds = new Set(tenantMembers?.map((member: Record<string, any>) => member.user_id) || []);
      const validSelectedUsers = selectedUsers.filter((userId) => tenantUserIds.has(userId));

      if (!visibleToAll && validSelectedUsers.length === 0) {
        toast({
          title: "Fehler",
          description: "Bitte wählen Sie mindestens einen Benutzer aus Ihrem Tenant aus oder machen Sie die Entscheidung öffentlich.",
          variant: "destructive",
        });
        return;
      }

      const insertData = {
        task_id: taskId ?? null,
        case_item_id: caseItemId ?? null,
        title: title.trim(),
        description: description.trim() || null,
        response_deadline: responseDeadline ? new Date(responseDeadline).toISOString() : null,
        created_by: userData.user.id,
        tenant_id: tenantData.tenant_id,
        visible_to_all: visibleToAll,
        response_options: JSON.parse(JSON.stringify(currentOptions)),
        priority: priority ? 1 : 0,
      };

      const { data: decision, error: decisionError } = await supabase
        .from("task_decisions")
        .insert(insertData)
        .select()
        .single();

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

      if (validSelectedUsers.length > 0) {
        const participants = validSelectedUsers.map((userId) => ({
          decision_id: decision.id,
          user_id: userId,
        }));

        const { error: participantsError } = await supabase.from("task_decision_participants").insert(participants);
        if (participantsError) {
          debugConsole.error("Participants creation error:", participantsError);
          throw participantsError;
        }
      }

      for (const userId of validSelectedUsers) {
        const { error: notificationError } = await supabase.rpc("create_notification", {
          user_id_param: userId,
          type_name: "task_decision_request",
          title_param: "Neue Entscheidungsanfrage",
          message_param: `Sie wurden um eine Entscheidung gebeten: "${title.trim()}"`,
          data_param: JSON.stringify({
            decision_id: decision.id,
            task_id: taskId ?? undefined,
            decision_title: title.trim(),
          }),
          priority_param: "medium",
        });

        if (notificationError) {
          debugConsole.error("Error creating notification for user:", userId, notificationError);
        }
      }

      if (sendViaMatrix) {
        try {
          toast({
            title: "Matrix-Nachrichten werden versendet...",
            description: "Die Matrix-Entscheidungsanfragen werden an die ausgewählten Teilnehmer gesendet.",
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
            toast({
              title: "Matrix-Fehler",
              description: `Matrix-Nachrichten konnten nicht versendet werden: ${matrixError.message}`,
              variant: "destructive",
            });
          } else if (isMatrixInvokeResult(matrixResult)) {
            const successCount = matrixResult.sent;
            const totalCount = matrixResult.total_participants || validSelectedUsers.length;

            if (successCount > 0) {
              toast({
                title: "Matrix-Nachrichten versendet",
                description: `${successCount}/${totalCount} Matrix-Entscheidungen erfolgreich versendet.`,
              });
            } else {
              toast({
                title: "Matrix-Warnung",
                description: "Keine Matrix-Nachrichten konnten versendet werden. Überprüfen Sie die Matrix-Konfiguration.",
                variant: "destructive",
              });
            }
          } else {
            toast({
              title: "Matrix-Warnung",
              description: "Matrix-Rückgabe hatte ein unerwartetes Format.",
              variant: "destructive",
            });
          }
        } catch (matrixError: unknown) {
          debugConsole.error("Error sending Matrix decisions:", matrixError);
          toast({
            title: "Matrix-Fehler",
            description: `Unerwarteter Fehler beim Matrix-Versand: ${getErrorMessage(matrixError)}`,
            variant: "destructive",
          });
        }
      }

      if (sendByEmail) {
        try {
          toast({
            title: "E-Mails werden versendet...",
            description: "Die E-Mail-Einladungen werden an die ausgewählten Teilnehmer gesendet.",
          });

          const { data: emailResult, error: emailError } = await supabase.functions.invoke("send-decision-email", {
            body: {
              decisionId: decision.id,
              taskId: taskId ?? null,
              participantIds: validSelectedUsers,
              decisionTitle: title.trim(),
              decisionDescription: description.trim() || null,
              tenantId: tenantData.tenant_id,
            },
          });

          if (emailError) {
            debugConsole.error("Error sending decision emails:", emailError);
            toast({
              title: "E-Mail-Fehler",
              description: `E-Mails konnten nicht versendet werden: ${emailError.message}`,
              variant: "destructive",
            });
          } else if (isEmailInvokeResult(emailResult)) {
            const successCount = emailResult.results.filter((result) => result.success).length;
            const totalCount = emailResult.results.length || validSelectedUsers.length;

            if (successCount > 0) {
              toast({
                title: "E-Mails versendet",
                description: `${successCount}/${totalCount} E-Mail-Einladungen erfolgreich versendet.`,
              });
            } else {
              toast({
                title: "E-Mail-Warnung",
                description: "Keine E-Mails konnten versendet werden. Überprüfen Sie die E-Mail-Konfiguration.",
                variant: "destructive",
              });
            }
          } else {
            toast({
              title: "E-Mail-Warnung",
              description: "E-Mail-Rückgabe hatte ein unerwartetes Format.",
              variant: "destructive",
            });
          }
        } catch (emailError: unknown) {
          debugConsole.error("Error sending decision emails:", emailError);
          toast({
            title: "E-Mail-Fehler",
            description: `Unerwarteter Fehler beim E-Mail-Versand: ${getErrorMessage(emailError)}`,
            variant: "destructive",
          });
        }
      }

      toast({
        title: "Erfolgreich",
        description:
          sendByEmail || sendViaMatrix
            ? "Entscheidungsanfrage wurde erstellt und Versand wird geprüft."
            : "Entscheidungsanfrage wurde erstellt.",
      });

      resetForm();
      handleOpenChange(false);
      onDecisionCreated();
      if (onCreatedWithId && decision?.id) onCreatedWithId(decision.id);
    } catch (error) {
      setUploadStatus(null);
      debugConsole.error("Error creating decision:", error);
      toast({
        title: "Fehler",
        description:
          error instanceof Error ? error.message : "Entscheidungsanfrage konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setUploadStatus(null);
    }
  }, [
    caseItemId,
    currentOptions,
    description,
    handleOpenChange,
    onCreatedWithId,
    onDecisionCreated,
    priority,
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
