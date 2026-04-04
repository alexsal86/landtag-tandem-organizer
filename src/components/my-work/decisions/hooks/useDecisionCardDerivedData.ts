import { useMemo } from "react";
import { format } from "date-fns";
import { MyWorkDecision, getResponseSummary } from "../types";
import {
  APPOINTMENT_REQUEST_APPOINTMENT_MARKER,
  APPOINTMENT_REQUEST_REQUESTER_MARKER,
  APPOINTMENT_REQUEST_START_MARKER,
  APPOINTMENT_REQUEST_TARGET_DEPUTY_MARKER,
  APPOINTMENT_REQUEST_TITLE_MARKER,
  extractMarkerValue,
  getAppointmentRequestNarrative,
  getDecisionSummaryItems,
  getDisplayDescription,
  getPlainDescription,
  getWinningDecisionResponse,
} from "../utils";

export const useDecisionCardDerivedData = (decision: MyWorkDecision) => {
  const isAppointmentRequest = decision.title.toLowerCase().startsWith("terminanfrage:");
  const requestedTitle =
    extractMarkerValue(decision.description, APPOINTMENT_REQUEST_TITLE_MARKER) ||
    decision.title.replace(/^Terminanfrage:\s*/i, "");
  const requestedStartIso = extractMarkerValue(decision.description, APPOINTMENT_REQUEST_START_MARKER);
  const appointmentId = extractMarkerValue(decision.description, APPOINTMENT_REQUEST_APPOINTMENT_MARKER);
  const requestedBy = extractMarkerValue(decision.description, APPOINTMENT_REQUEST_REQUESTER_MARKER) || "Ein Mitarbeiter";
  const targetDeputy = extractMarkerValue(decision.description, APPOINTMENT_REQUEST_TARGET_DEPUTY_MARKER);
  const requestedStart = useMemo(
    () => (requestedStartIso ? new Date(requestedStartIso) : null),
    [requestedStartIso],
  );
  const isRequestedStartValid = Boolean(requestedStart && !Number.isNaN(requestedStart.getTime()));

  const summary = useMemo(() => getResponseSummary(decision.participants), [decision.participants]);
  const displayDescription = useMemo(
    () => getDisplayDescription(decision, isAppointmentRequest),
    [decision, isAppointmentRequest],
  );
  const plainDescription = useMemo(() => getPlainDescription(displayDescription), [displayDescription]);
  const summaryItems = useMemo(
    () => getDecisionSummaryItems(decision, isAppointmentRequest),
    [decision, isAppointmentRequest],
  );
  const winningResponse = useMemo(
    () => getWinningDecisionResponse(summary, summaryItems, isAppointmentRequest),
    [summary, summaryItems, isAppointmentRequest],
  );
  const appointmentRequestNarrative = useMemo(
    () =>
      getAppointmentRequestNarrative(
        requestedBy,
        requestedTitle,
        requestedStart,
        isAppointmentRequest,
        isRequestedStartValid,
      ),
    [requestedBy, requestedTitle, requestedStart, isAppointmentRequest, isRequestedStartValid],
  );
  const appointmentLink = useMemo(() => {
    if (!appointmentId || !isRequestedStartValid || !requestedStart) return null;
    return `/calendar?date=${format(requestedStart, "yyyy-MM-dd")}&event=${appointmentId}`;
  }, [appointmentId, isRequestedStartValid, requestedStart]);

  return {
    appointmentId,
    appointmentLink,
    appointmentRequestNarrative,
    displayDescription,
    isAppointmentRequest,
    isRequestedStartValid,
    plainDescription,
    requestedBy,
    requestedStart,
    requestedStartIso,
    requestedTitle,
    summary,
    summaryItems,
    targetDeputy,
    winningResponse,
  };
};
