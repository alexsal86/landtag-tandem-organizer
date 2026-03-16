import { useCallback, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import {
  APPOINTMENT_REQUEST_LOCATION_MARKER,
  APPOINTMENT_REQUEST_REQUESTER_MARKER,
  APPOINTMENT_REQUEST_START_MARKER,
  APPOINTMENT_REQUEST_TARGET_DEPUTY_MARKER,
  APPOINTMENT_REQUEST_TITLE_MARKER,
} from "@/features/appointments/requestMarkers";

type Notify = (message: string, description?: string) => void;

interface UseAppointmentRequestOptions {
  onSuccess?: Notify;
  onError?: Notify;
}

export function useAppointmentRequest(options: UseAppointmentRequestOptions = {}) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { onSuccess, onError } = options;

  const [requestTitle, setRequestTitle] = useState("");
  const [requestDate, setRequestDate] = useState("");
  const [requestTime, setRequestTime] = useState("");
  const [requestLocation, setRequestLocation] = useState("");
  const [requestRequester, setRequestRequester] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const resetForm = useCallback(() => {
    setRequestTitle("");
    setRequestDate("");
    setRequestTime("");
    setRequestLocation("");
    setRequestRequester("");
  }, []);

  const createRequest = useCallback(async () => {
    if (!user?.id || !currentTenant?.id) return false;

    if (!requestTitle.trim() || !requestDate) {
      onError?.("Bitte Titel und Datum angeben");
      return false;
    }

    setIsSubmittingRequest(true);
    try {
      const requestedStart = requestTime ? `${requestDate}T${requestTime}:00` : `${requestDate}T09:00:00`;
      const requestedStartIso = new Date(requestedStart).toISOString();

      const { data: empSettings, error: settingsError } = await supabase
        .from("employee_settings")
        .select("admin_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settingsError) throw settingsError;

      const adminId = empSettings?.admin_id;

      if (!adminId) {
        onError?.(
          "Kein Abgeordneter zugeordnet",
          "Bitte lassen Sie sich in den Mitarbeiter-Einstellungen einem Abgeordneten zuordnen.",
        );
        return false;
      }

      if (adminId === user.id) {
        onError?.("Nicht möglich", "Als Abgeordneter können Sie keine Terminanfrage an sich selbst senden.");
        return false;
      }

      const { data: decision, error: decisionError } = await supabase
        .from("task_decisions")
        .insert([
          {
            title: `Terminanfrage: ${requestTitle.trim()}`,
            description: [
              "Bitte reagieren: Zusage, Absage oder Rückfrage.",
              `${APPOINTMENT_REQUEST_TITLE_MARKER}${requestTitle.trim()}`,
              `${APPOINTMENT_REQUEST_START_MARKER}${requestedStartIso}`,
              `${APPOINTMENT_REQUEST_TARGET_DEPUTY_MARKER}${adminId}`,
              requestRequester.trim() ? `${APPOINTMENT_REQUEST_REQUESTER_MARKER}${requestRequester.trim()}` : null,
              requestLocation.trim() ? `${APPOINTMENT_REQUEST_LOCATION_MARKER}${requestLocation.trim()}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
            created_by: user.id,
            tenant_id: currentTenant.id,
            response_deadline: requestedStartIso,
            status: "open",
            visible_to_all: true,
            response_options: [
              { key: "yes", label: "Zusage", color: "green", icon: "check", order: 1 },
              { key: "no", label: "Absage", color: "red", icon: "x", order: 2 },
              { key: "question", label: "Rückfrage", color: "orange", icon: "message-circle", order: 3 },
            ],
          },
        ])
        .select("id")
        .single();

      if (decisionError) throw decisionError;

      const { error: participantError } = await supabase.from("task_decision_participants").insert([
        {
          decision_id: decision.id,
          user_id: adminId,
        },
      ]);

      if (participantError) throw participantError;

      onSuccess?.(
        "Terminanfrage erstellt",
        "Anfrage wurde an den Abgeordneten gesendet. Termin wird erst nach Zustimmung angelegt.",
      );
      resetForm();
      return true;
    } catch (error: unknown) {
      debugConsole.error("Error creating appointment request:", error);
      const errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler";
      onError?.("Terminanfrage konnte nicht erstellt werden", errorMessage);
      return false;
    } finally {
      setIsSubmittingRequest(false);
    }
  }, [
    currentTenant?.id,
    onError,
    onSuccess,
    requestDate,
    requestLocation,
    requestRequester,
    requestTime,
    requestTitle,
    resetForm,
    user?.id,
  ]);

  return {
    requestTitle,
    setRequestTitle,
    requestDate,
    setRequestDate,
    requestTime,
    setRequestTime,
    requestLocation,
    setRequestLocation,
    requestRequester,
    setRequestRequester,
    isSubmittingRequest,
    resetForm,
    createRequest,
  };
}
