import { format } from "date-fns";
import { de } from "date-fns/locale";
import { getColorClasses, ResponseOption } from "@/lib/decisionTemplates";
import { MyWorkDecision, getCustomResponseSummary, getResponseSummary } from "./types";

export const APPOINTMENT_REQUEST_TITLE_MARKER = "appointment_request_title:";
export const APPOINTMENT_REQUEST_START_MARKER = "appointment_request_start:";
export const APPOINTMENT_REQUEST_REQUESTER_MARKER = "appointment_request_requester:";
export const APPOINTMENT_REQUEST_APPOINTMENT_MARKER = "appointment_request_appointment_id:";
export const APPOINTMENT_REQUEST_TARGET_DEPUTY_MARKER = "appointment_request_target_deputy:";

export interface DecisionSummaryItem {
  key: string;
  label: string;
  count: number;
  textClass: string;
}

export const extractMarkerValue = (description: string | null, marker: string): string | null => {
  if (!description) return null;
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = description.match(new RegExp(`${escaped}(.+)`, "i"));
  return match?.[1]?.trim() ?? null;
};

export const deriveDeputyReference = (value: string | null) => {
  const fallbackName = "Name des Abgeordneten";
  const cleaned = (value || fallbackName).replace(/\bMdL\b/gi, "").replace(/\s+/g, " ").trim();
  const isFemale = /\bfrau\b/i.test(cleaned);
  const nominative = isFemale ? "Frau" : "Herr";
  const accusative = isFemale ? "Frau" : "Herrn";
  const dative = isFemale ? "Frau" : "Herrn";
  const nameWithoutSalutation = cleaned.replace(/^\s*(Herrn?|Frau)\s+/i, "").trim();
  const fullName = nameWithoutSalutation || fallbackName;
  const parts = fullName.split(" ").filter(Boolean);
  const lastName = parts[parts.length - 1] || fallbackName;

  return { nominative, accusative, dative, fullName, lastName };
};

export const buildMailtoFromTemplate = (template: string | null) => {
  if (!template) return null;
  const [subjectLine = "", ...bodyLines] = template.split("\n");
  const subject = subjectLine.trim();
  const body = bodyLines.join("\n").replace(/^\n+/, "");
  if (!subject) return null;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

export const getDecisionStatus = (decision: MyWorkDecision) => {
  const summary = getResponseSummary(decision.participants);
  if (summary.questionCount > 0) return "question" as const;
  if (summary.pending === 0 && summary.total > 0) return "decided" as const;
  if (summary.total > 0) return "pending" as const;
  return "idle" as const;
};

export const getVisibleDecisionTab = (decision: MyWorkDecision) => {
  if (decision.isParticipant && !decision.hasResponded && !decision.isCreator) {
    return "for-me" as const;
  }

  if (decision.isCreator) {
    const summary = getResponseSummary(decision.participants);
    if (summary.questionCount > 0 || (summary.total > 0 && summary.pending < summary.total)) {
      return "for-me" as const;
    }
    return "my-decisions" as const;
  }

  if (decision.isParticipant && decision.hasResponded) return "answered" as const;
  if (decision.visible_to_all) return "public" as const;
  return null;
};

export const filterDecisionsByQuery = (decisions: MyWorkDecision[], searchQuery: string) => {
  if (!searchQuery.trim()) return decisions;
  const q = searchQuery.toLowerCase();
  return decisions.filter(
    (decision) =>
      decision.title.toLowerCase().includes(q) ||
      (decision.description && decision.description.toLowerCase().includes(q)),
  );
};

export const filterDecisionsByTab = (decisions: MyWorkDecision[], activeTab: string) => {
  switch (activeTab) {
    case "for-me": {
      const participantDecisions = decisions.filter(
        (decision) => decision.isParticipant && !decision.hasResponded && !decision.isCreator,
      );
      const creatorActivity = decisions.filter((decision) => {
        if (!decision.isCreator) return false;
        const summary = getResponseSummary(decision.participants);
        return summary.questionCount > 0 || (summary.total > 0 && summary.pending < summary.total);
      });
      const seen = new Set(participantDecisions.map((decision) => decision.id));
      return [...participantDecisions, ...creatorActivity.filter((decision) => !seen.has(decision.id))];
    }
    case "answered":
      return decisions.filter((decision) => decision.isParticipant && decision.hasResponded && !decision.isCreator);
    case "my-decisions":
      return decisions.filter((decision) => decision.isCreator);
    case "public":
      return decisions.filter(
        (decision) => decision.visible_to_all && !decision.isCreator && !decision.isParticipant,
      );
    default:
      return decisions;
  }
};

export const getDecisionTabCounts = (decisions: MyWorkDecision[]) => {
  const forMe = filterDecisionsByTab(decisions, "for-me");
  return {
    forMe: forMe.length,
    answered: filterDecisionsByTab(decisions, "answered").length,
    myDecisions: filterDecisionsByTab(decisions, "my-decisions").length,
    public: filterDecisionsByTab(decisions, "public").length,
  };
};

export const getDisplayDescription = (decision: MyWorkDecision, isAppointmentRequest: boolean) => {
  if (!decision.description) return "";
  if (!isAppointmentRequest) return decision.description;

  return decision.description
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim().toLowerCase();
      return !(
        trimmed.startsWith(APPOINTMENT_REQUEST_TITLE_MARKER) ||
        trimmed.startsWith(APPOINTMENT_REQUEST_START_MARKER) ||
        trimmed.startsWith(APPOINTMENT_REQUEST_REQUESTER_MARKER) ||
        trimmed.startsWith("appointment_request_location:") ||
        trimmed.startsWith(APPOINTMENT_REQUEST_TARGET_DEPUTY_MARKER) ||
        trimmed.startsWith("appointment_request_appointment_id:")
      );
    })
    .join("\n")
    .trim();
};

export const getPlainDescription = (displayDescription: string) =>
  displayDescription.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();

const hasStandardResponseOptions = (responseOptions?: ResponseOption[]) => {
  if (!responseOptions || responseOptions.length === 0) return true;
  const keys = responseOptions.map((option) => option.key).sort();
  return (
    (keys.length === 2 && keys[0] === "no" && keys[1] === "yes") ||
    (keys.length === 3 && keys[0] === "no" && keys[1] === "question" && keys[2] === "yes")
  );
};

export const getDecisionSummaryItems = (decision: MyWorkDecision, isAppointmentRequest: boolean): DecisionSummaryItem[] => {
  const summary = getResponseSummary(decision.participants);

  if (
    decision.response_options &&
    decision.response_options.length > 0 &&
    !hasStandardResponseOptions(decision.response_options) &&
    decision.participants
  ) {
    const customSummary = getCustomResponseSummary(decision.participants, decision.response_options);
    return [
      ...customSummary.counts.map((entry) => ({
        key: entry.key,
        label: entry.label,
        count: entry.count,
        textClass: getColorClasses(entry.color).textClass,
      })),
      { key: "pending", label: "Ausstehend", count: customSummary.pending, textClass: "text-muted-foreground" },
    ];
  }

  return [
    { key: "yes", label: isAppointmentRequest ? "Zusage" : "Ja", count: summary.yesCount, textClass: "text-green-600" },
    { key: "no", label: isAppointmentRequest ? "Absage" : "Nein", count: summary.noCount, textClass: "text-red-600" },
    { key: "question", label: "Rückfrage", count: summary.questionCount, textClass: "text-orange-600" },
  ];
};

export const getWinningDecisionResponse = (
  summary: ReturnType<typeof getResponseSummary>,
  summaryItems: DecisionSummaryItem[],
  isAppointmentRequest: boolean,
) => {
  if (summary.pending !== 0 || summary.total === 0) return null;

  const winner = [...summaryItems]
    .filter((item) => item.key !== "pending" && item.count > 0)
    .sort((a, b) => b.count - a.count)[0];

  if (!winner || winner.key === "question") return null;

  const textClass = isAppointmentRequest
    ? winner.key === "yes"
      ? "text-green-600"
      : winner.key === "no"
        ? "text-red-600"
        : winner.textClass
    : winner.textClass;

  return { key: winner.key, label: winner.label, textClass };
};

export const getAppointmentRequestNarrative = (
  requestedBy: string,
  requestedTitle: string,
  requestedStart: Date | null,
  isAppointmentRequest: boolean,
  isRequestedStartValid: boolean,
) => {
  if (!isAppointmentRequest || !isRequestedStartValid || !requestedStart) return null;
  return `${requestedBy} fragt an, ob du den Termin „${requestedTitle}“ am ${format(requestedStart, "dd.MM.yyyy", { locale: de })} um ${format(requestedStart, "HH:mm", { locale: de })} Uhr zusagen möchtest.`;
};
