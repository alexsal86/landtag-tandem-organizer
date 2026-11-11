import { Badge } from "@/components/ui/badge";
import { effectiveReviewStatus, REVIEW_LABELS } from "../logic";
import { useReviewDeadline } from "../hooks/useReviewDeadline";
import type { KnowledgeCard } from "../types";
import styles from "./KnowledgeWorkspace.module.css";

export function KnowledgeStatusBadge({
  question,
}: {
  question: KnowledgeCard;
}) {
  const status = effectiveReviewStatus(question, useReviewDeadline(question));
  return (
    <Badge
      variant="outline"
      className={`${styles.badge} ${!question.answered_at ? styles.badgeOpen : status === "verified" ? styles.badgeVerified : status === "needs_review" ? styles.badgeDue : ""}`}
    >
      {question.archived_at
        ? "Archiviert"
        : question.answered_at
          ? REVIEW_LABELS[status]
          : "Offene Frage"}
    </Badge>
  );
}
