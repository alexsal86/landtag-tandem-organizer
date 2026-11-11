import { knowledgePersonLabel } from "../person";
import type { KnowledgeSummary } from "../types";
import { effectiveReviewStatus, REVIEW_LABELS } from "../logic";
import { useReviewDeadline } from "../hooks/useReviewDeadline";
import { KnowledgePersonAvatar } from "./KnowledgePersonAvatar";
import { formatKnowledgeRelativeDate, knowledgeOpenDays } from "./presentation";
import styles from "./KnowledgeWorkspace.module.css";

export function KnowledgeQuestionRow({
  question,
  onOpen,
  showAvatar = true,
}: {
  question: KnowledgeSummary;
  onOpen: (element: HTMLButtonElement) => void;
  showAvatar?: boolean;
}) {
  const now = useReviewDeadline(question);
  const status = effectiveReviewStatus(question, now);
  const days = knowledgeOpenDays(question.created_at, now);
  return (
    <button
      type="button"
      className={styles.questionRow}
      onClick={(event) => onOpen(event.currentTarget)}
      aria-haspopup="dialog"
    >
      <span
        className={`${styles.statusDot} ${!question.answered_at ? styles.dotOpen : status === "needs_review" ? styles.dotReview : status === "verified" ? styles.dotVerified : ""}`}
        aria-label={
          question.answered_at ? REVIEW_LABELS[status] : "Offene Frage"
        }
      />
      <span className={styles.rowBody}>
        <span className={styles.rowTitle}>{question.title}</span>
        <span className={styles.rowExcerpt}>
          {question.answer_excerpt ||
            question.description ||
            "Diese Frage wartet auf eine Antwort."}
        </span>
      </span>
      <span className={styles.rowTags}>
        {question.tags?.slice(0, 2).map((tag) => (
          <span className={styles.tagChip} key={tag.id}>
            {tag.name}
          </span>
        ))}
        {(question.tags?.length ?? 0) > 2 && (
          <span>+{question.tags!.length - 2}</span>
        )}
      </span>
      {showAvatar && (
        <KnowledgePersonAvatar person={question.assigned_to_person} />
      )}
      <span className="sr-only">
        Zuständig: {knowledgePersonLabel(question.assigned_to_person)}
      </span>
      <span
        className={`${styles.rowDate} ${!question.answered_at && days >= 7 ? styles.openWarning : ""}`}
      >
        {question.answered_at
          ? formatKnowledgeRelativeDate(question.updated_at, now)
          : `seit ${days} ${days === 1 ? "Tag" : "Tagen"} offen`}
      </span>
    </button>
  );
}
