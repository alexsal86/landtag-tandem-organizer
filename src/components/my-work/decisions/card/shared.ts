import { MyWorkDecision } from "../types";
import { DecisionSummaryItem } from "../utils";

export interface DecisionWinningResponse {
  key: string;
  label: string;
  textClass: string;
}

export interface DayTimelineItem {
  id: string;
  title: string;
  start: string;
  end: string;
  simulated?: boolean;
}

export interface TimelineLayoutItem {
  item: DayTimelineItem;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  column: number;
  totalColumns: number;
}

export const getInitials = (name: string | null) => {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export interface DecisionCardMetaProps {
  commentCount: number;
  decision: MyWorkDecision;
  onOpenComments: (decisionId: string, title: string) => void;
  onPreviewAttachment: (payload: { file_path: string; file_name: string }) => void;
  onPreviewEmail: (payload: { file_path: string; file_name: string }) => void;
  pendingParticipantNames: string;
  summaryItems: DecisionSummaryItem[];
}
