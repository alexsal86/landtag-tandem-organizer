import {
  KnowledgeConversationPanel,
  KnowledgeOutdatedReport,
} from "./KnowledgeConversationPanel";
import { KnowledgeSourcesPanel } from "./KnowledgeSourcesPanel";
import { KnowledgeTagsPanel } from "./KnowledgeTagsPanel";
import styles from "./KnowledgeWorkspace.module.css";
import { KnowledgePersonLabel } from "./KnowledgePersonAvatar";
import { knowledgePersonForId } from "../person";
import { Link } from "react-router-dom";
import { ARCHIVE_REASONS } from "./ManagementPanel";
import { useMemo, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import EnhancedLexicalEditor from "@/components/lexical/EnhancedLexicalEditor";
import { Button } from "@/components/ui/button";
import { answerText, effectiveReviewStatus } from "../logic";
import type { KnowledgeCard } from "../types";
import type { TenantProfileOption } from "@/hooks/useTenantProfiles";
import { KnowledgeAnswerEditor } from "./KnowledgeAnswerEditor";
import { KnowledgeAttachments } from "./KnowledgeAttachments";

import { AssigneeSelect } from "./AssigneeSelect";
import { ReviewPanel } from "./ReviewPanel";
import { HistoryPanel } from "./HistoryPanel";
import { useKnowledgeScope } from "../hooks/useKnowledgeQuestions";
import { useReviewDeadline } from "../hooks/useReviewDeadline";
import {
  formatKnowledgeDate as formatDate,
  formatKnowledgeCalendarDate,
} from "./presentation";

export function KnowledgeQuestionDetailContent({
  question,
  profiles,
  assignable,
  canWrite,
  canVerify,
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
  const { userId } = useKnowledgeScope();
  const canApprove = Boolean(userId && question.assigned_to === userId);
  const [editing, setEditing] = useState(false);
  const answerAction = useRef<HTMLButtonElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const now = useReviewDeadline(question);
  const status = effectiveReviewStatus(question, now);
  const validContent = useMemo(() => {
    try {
      return question.answer_content && answerText(question.answer_content)
        ? JSON.stringify(question.answer_content)
        : undefined;
    } catch {
      return undefined;
    }
  }, [question.answer_content]);
  const editAction =
    !editing && canWrite && !question.archived_at ? (
      <Button
        ref={answerAction}
        className={`${styles.button} ${styles.compactAction} ${question.answered_at && status === "needs_review" ? "" : styles.primaryButton}`}
        variant={
          question.answered_at && status === "needs_review"
            ? "outline"
            : "default"
        }
        size="sm"
        onClick={() => setEditing(true)}
      >
        <Pencil className="h-3.5 w-3.5" />
        {question.answered_at ? "Antwort bearbeiten" : "Beantworten"}
      </Button>
    ) : null;
  return (
    <div className="space-y-4">
      {question.archived_at && (
        <p className="rounded border bg-muted p-3 text-sm">
          {question.merged_into ? (
            <>
              Als Duplikat geschlossen.{" "}
              <Link className="underline" to={`?frage=${question.merged_into}`}>
                Zur Zielfrage
              </Link>
            </>
          ) : (
            "Diese Frage ist archiviert."
          )}
        </p>
      )}
      <section className={`${styles.slideCard} space-y-3`} aria-label="Antwort">
        <div className={styles.answerHeading}>
          <h3 className="font-medium">Antwort</h3>{" "}
        </div>
        {editing ? (
          <KnowledgeAnswerEditor
            question={question}
            onClose={() => {
              setEditing(false);
              requestAnimationFrame(() => answerAction.current?.focus());
            }}
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
          </>
        ) : (
          <p className={styles.emptyAnswer}>
            Diese Frage wartet auf eine Antwort.
          </p>
        )}
        {question.answered_at && (
          <KnowledgeAttachments
            question={question}
            actions={editAction}
            canWrite={canWrite && !question.archived_at && !editing}
          />
        )}

        {!question.answered_at && editAction && (
          <div className={styles.answerFooter}>{editAction}</div>
        )}
        <KnowledgeConversationPanel question={question} />
      </section>
      <section className={`${styles.slideCard} space-y-3`} aria-label="Prüfung">
        <h3 className="font-medium">Prüfung</h3>
        {!question.answered_at && (
          <p className="text-sm text-muted-foreground">
            Nach einer Antwort kann die Aktualität geprüft werden.
          </p>
        )}
        {!editing && question.answered_at && !question.archived_at && (
          <div className={styles.actions}>
            {(canVerify || canApprove) && (
              <ReviewPanel
                question={question}
                now={now}
                primary={status === "needs_review" && canApprove}
                canApprove={canApprove}
              />
            )}
            <KnowledgeOutdatedReport question={question} />
          </div>
        )}
      </section>
      <KnowledgeTagsPanel question={question} canWrite={canWrite} />
      <KnowledgeSourcesPanel question={question} canWrite={canWrite} />
      <details
        className={styles.slideCard}
        open={detailsOpen}
        onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer font-medium">Details</summary>
        <dl className={styles.detailRows}>
          <div>
            <dt>Gefragt von</dt>
            <dd>
              <KnowledgePersonLabel
                person={knowledgePersonForId(
                  question.created_by,
                  question.created_by_person,
                  profiles,
                )}
                showAvatar={showAvatars}
              />
              <span className={styles.createdDate}>
                {" "}
                ·{" "}
                <time
                  dateTime={question.created_at}
                  title={formatDate(question.created_at)}
                  tabIndex={0}
                  aria-label={`Erstellt: ${formatDate(question.created_at)}`}
                >
                  {formatKnowledgeCalendarDate(question.created_at)}
                </time>
              </span>
            </dd>
          </div>
          <div>
            <dt>Zuständig</dt>
            <dd>
              {canWrite && !question.archived_at ? (
                <AssigneeSelect
                  hideLabel
                  question={question}
                  profiles={profiles}
                  assignable={assignable}
                  showAvatars={showAvatars}
                />
              ) : (
                <KnowledgePersonLabel
                  person={knowledgePersonForId(
                    question.assigned_to,
                    question.assigned_to_person,
                    profiles,
                  )}
                  showAvatar={showAvatars}
                />
              )}
            </dd>
          </div>
          {question.answer_updated_at && (
            <div>
              <dt>Aktualisiert</dt>
              <dd>
                <time
                  dateTime={question.answer_updated_at}
                  title={formatDate(question.answer_updated_at)}
                  tabIndex={0}
                  aria-label={`Aktualisiert: ${formatDate(question.answer_updated_at)}`}
                >
                  {formatKnowledgeCalendarDate(question.answer_updated_at)}
                </time>
              </dd>
            </div>
          )}
          {question.verified_at && (
            <>
              <div>
                <dt>Bestätigt von</dt>
                <dd>
                  <KnowledgePersonLabel
                    person={knowledgePersonForId(
                      question.verified_by,
                      question.verified_by_person,
                      profiles,
                    )}
                    showAvatar={showAvatars}
                  />
                </dd>
              </div>
              <div>
                <dt>Bestätigt am</dt>
                <dd>{formatDate(question.verified_at)}</dd>
              </div>
            </>
          )}
          {question.review_due_at && (
            <div>
              <dt>Prüftermin</dt>
              <dd>{formatDate(question.review_due_at)}</dd>
            </div>
          )}
          {question.archived_at && (
            <div>
              <dt>Archiviert</dt>
              <dd>
                {formatDate(question.archived_at)}
                {question.archive_reason && (
                  <>
                    {" "}
                    ·{" "}
                    {ARCHIVE_REASONS[question.archive_reason] ??
                      question.archive_reason}
                  </>
                )}
              </dd>
            </div>
          )}
        </dl>
      </details>
      <details
        className={styles.slideCard}
        open={historyOpen}
        onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer font-medium">Verlauf</summary>
        {historyOpen && (
          <div className="mt-3">
            <HistoryPanel questionId={question.id} profiles={profiles} />
          </div>
        )}
      </details>
    </div>
  );
}
