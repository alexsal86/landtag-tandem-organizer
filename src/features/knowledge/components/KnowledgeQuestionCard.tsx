import styles from "./KnowledgeWorkspace.module.css";
import { KnowledgePersonLabel } from "./KnowledgePersonAvatar";
import { knowledgePersonForId } from "../person";
import { Link } from "react-router-dom";
import { ManagementPanel } from "./ManagementPanel";
import { useMemo, useState } from "react";
import { History, Pencil } from "lucide-react";
import EnhancedLexicalEditor from "@/components/lexical/EnhancedLexicalEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { answerText, effectiveReviewStatus, REVIEW_LABELS } from "../logic";
import type { KnowledgeCard } from "../types";
import type { TenantProfileOption } from "@/hooks/useTenantProfiles";
import { KnowledgeAnswerEditor } from "./KnowledgeAnswerEditor";
import { KnowledgeAttachments } from "./KnowledgeAttachments";

import { AssigneeSelect } from "./AssigneeSelect";
import { ReviewPanel } from "./ReviewPanel";
import { HistoryPanel } from "./HistoryPanel";
import { useReviewDeadline } from "../hooks/useReviewDeadline";
import {
  formatKnowledgeDate as formatDate,
  knowledgePersonName,
} from "./presentation";

export function KnowledgeQuestionDetailContent({
  question,
  profiles,
  assignable,
  canWrite,
  canVerify,
  canManage,
  showAvatars,
}: {
  question: KnowledgeCard;
  profiles: TenantProfileOption[];
  assignable: TenantProfileOption[];
  canWrite: boolean;
  canVerify: boolean;
  canManage: boolean;
  query: string;
  showAvatars: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const now = useReviewDeadline(question);
  const status = effectiveReviewStatus(question, now);
  const name = (id: string | null) => knowledgePersonName(profiles, id);
  const validContent = useMemo(() => {
    try {
      return question.answer_content && answerText(question.answer_content)
        ? JSON.stringify(question.answer_content)
        : undefined;
    } catch {
      return undefined;
    }
  }, [question.answer_content]);
  return (
    <div className="space-y-4">
        <div className={styles.cardHeader}>
          <Badge
            className={`${styles.badge} ${!question.answered_at ? styles.badgeOpen : status === "verified" ? styles.badgeVerified : status === "needs_review" ? styles.badgeDue : ""}`}
            variant={
              question.answered_at
                ? status === "verified"
                  ? "secondary"
                  : "outline"
                : "default"
            }
          >
            {question.answered_at ? REVIEW_LABELS[status] : "Offene Frage"}
          </Badge>
        </div>
        {question.archived_at && (
          <p className="rounded border bg-muted p-3 text-sm">
            {question.merged_into ? (
              <>
                Als Duplikat geschlossen.{" "}
                <Link
                  className="underline"
                  to={`?frage=${question.merged_into}`}
                >
                  Zur Zielfrage
                </Link>
              </>
            ) : (
              "Diese Frage ist archiviert."
            )}
          </p>
        )}
        {question.description && (
          <p className={styles.description}>{question.description}</p>
        )}

        {editing ? (
          <KnowledgeAnswerEditor
            question={question}
            onClose={() => setEditing(false)}
          />
        ) : question.answered_at ? (
          <>
            <div className={styles.answer}>
              <EnhancedLexicalEditor
                key={`${question.id}-${question.answer_revision}`}
                knowledgeMode
                editable={false}
                showToolbar={false}
                content={question.answer_text}
                contentNodes={validContent}
                onChange={() => {}}
              />
            </div>
            <KnowledgeAttachments
              question={question}
              canWrite={canWrite && !question.archived_at}
            />
          </>
        ) : (
          <p className={styles.emptyAnswer}>
            Diese Frage wartet auf eine Antwort.
          </p>
        )}
        <div className={`${styles.metadata} items-center`}>
          <span>
            Gefragt von{" "}
            <KnowledgePersonLabel
              person={knowledgePersonForId(
                question.created_by,
                question.created_by_person,
                profiles,
              )}
              showAvatar={showAvatars}
            />{" "}
            · {formatDate(question.created_at)}
          </span>
          {question.answered_at && (
            <span>
              Verantwortlich:{" "}
              {name(question.assigned_to || question.answered_by)}
            </span>
          )}
          {question.answer_updated_at && (
            <span>Aktualisiert: {formatDate(question.answer_updated_at)}</span>
          )}
          {status === "verified" && question.verified_at && (
            <span>
              Bestätigt von{" "}
              <KnowledgePersonLabel
                person={knowledgePersonForId(
                  question.verified_by,
                  question.verified_by_person,
                  profiles,
                )}
                showAvatar={showAvatars}
              />{" "}
              · {formatDate(question.verified_at)}
            </span>
          )}
          {question.review_due_at && (
            <span>Prüftermin: {formatDate(question.review_due_at)}</span>
          )}
        </div>
        {canWrite && !question.archived_at ? (
          <AssigneeSelect
            question={question}
            profiles={profiles}
            assignable={assignable}
            showAvatars={showAvatars}
          />
        ) : (
          <p className="flex items-center gap-2 text-sm">
            Zuständig:{" "}
            <KnowledgePersonLabel
              person={knowledgePersonForId(
                question.assigned_to,
                question.assigned_to_person,
                profiles,
              )}
              showAvatar={showAvatars}
            />
          </p>
        )}
        {!editing && (
          <div className={styles.actions}>
            {canWrite && !question.archived_at && (
              <Button
                className={`${styles.button} ${question.answered_at && status === "needs_review" ? "" : styles.primaryButton}`}
                variant={question.answered_at && status === "needs_review" ? "outline" : "default"}
                size="sm"
                onClick={() => setEditing(true)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {question.answered_at ? "Antwort bearbeiten" : "Beantworten"}
              </Button>
            )}
            {question.answered_at && !question.archived_at && canVerify && (
              <ReviewPanel question={question} now={now} primary={status === "needs_review"} />
            )}
            <Button
              className={`${styles.button} ${styles.ghostButton}`}
              variant="ghost"
              size="sm"
              onClick={() => setHistoryOpen((value) => !value)}
              aria-expanded={historyOpen}
            >
              <History className="mr-2 h-4 w-4" />
              Verlauf
            </Button>
          </div>
        )}

        {!editing && !question.archived_at && canManage && (
          <ManagementPanel question={question} />
        )}
        {historyOpen && (
          <HistoryPanel questionId={question.id} profiles={profiles} />
        )}
    </div>
  );
}

