import styles from "./KnowledgeWorkspace.module.css";
import { Link } from "react-router-dom";
import { ManagementPanel } from "./ManagementPanel";
import { useMemo, useState } from "react";
import { History, Pencil } from "lucide-react";
import EnhancedLexicalEditor from "@/components/lexical/EnhancedLexicalEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { answerText, effectiveReviewStatus, REVIEW_LABELS } from "../logic";
import { useKnowledgeQuestion } from "../hooks/useKnowledgeQuestions";
import type { KnowledgeCard, KnowledgeSummary } from "../types";
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

function FullKnowledgeQuestionCard({
  question,
  profiles,
  assignable,
  canWrite,
  canVerify,
  canManage,
  onOpen,
}: {
  question: KnowledgeCard;
  profiles: TenantProfileOption[];
  assignable: TenantProfileOption[];
  canWrite: boolean;
  canVerify: boolean;
  canManage: boolean;
  query: string;
  onOpen: () => void;
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
    <Card className={styles.card}>
      <CardContent className={styles.cardContent}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            <button className="text-left hover:underline" onClick={onOpen}>
              {question.title}
            </button>
          </h2>
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
          <p className={styles.description}>
            {question.description}
          </p>
        )}

        {editing ? (
          <KnowledgeAnswerEditor
            question={question}
            onClose={() => setEditing(false)}
          />
        ) : question.answered_at ? (
          <>
            <div className={styles.answer}><EnhancedLexicalEditor
              key={`${question.id}-${question.answer_revision}`}
              knowledgeMode
              editable={false}
              showToolbar={false}
              content={question.answer_text}
              contentNodes={validContent}
              onChange={() => {}}
            /></div>
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
        <div className={styles.metadata}>
          <span>
            Gefragt von {name(question.created_by)} ·{" "}
            {formatDate(question.created_at)}
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
              Bestätigt von {name(question.verified_by)} ·{" "}
              {formatDate(question.verified_at)}
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
          />
        ) : (
          !question.answered_at &&
          question.assigned_to && (
            <p className="text-sm">Zuständig: {name(question.assigned_to)}</p>
          )
        )}
        {!editing && (
          <div className={styles.actions}>
            {canWrite && !question.archived_at && (
              <Button
                className={`${styles.button} ${question.answered_at ? "" : styles.primaryButton}`}
                variant={question.answered_at ? "outline" : "default"}
                size="sm"
                onClick={() => setEditing(true)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {question.answered_at ? "Antwort bearbeiten" : "Beantworten"}
              </Button>
            )}
            {question.answered_at && !question.archived_at && canVerify && <ReviewPanel question={question} now={now} />}
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
      </CardContent>
    </Card>
  );
}

export function KnowledgeQuestionCard(props: {
  question: KnowledgeSummary;
  profiles: TenantProfileOption[];
  assignable: TenantProfileOption[];
  canWrite: boolean;
  canVerify: boolean;
  canManage: boolean;
  query: string;
  onOpen: () => void;
  detail?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const detail = useKnowledgeQuestion(
    props.detail || expanded ? props.question.id : null,
  );
  const now = useReviewDeadline(props.question);
  if (props.detail || expanded) {
    if (detail.isError)
      return (
        <p role="alert">
          Frage konnte nicht geladen werden.{" "}
          <Button className={styles.button} onClick={() => void detail.refetch()}>
            Erneut versuchen
          </Button>
        </p>
      );
    if (detail.isPending) return <p role="status">Frage wird geladen …</p>;
    if (!detail.data) return <p>Frage nicht verfügbar.</p>;
    return <FullKnowledgeQuestionCard {...props} question={detail.data} />;
  }
  const question = props.question;
  return (
    <Card className={styles.card}>
      <CardContent className={styles.cardContent}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            <button onClick={props.onOpen}>{question.title}</button>
          </h2>
          <Badge variant="outline" className={`${styles.badge} ${!question.answered_at ? styles.badgeOpen : effectiveReviewStatus(question, now) === "verified" ? styles.badgeVerified : effectiveReviewStatus(question, now) === "needs_review" ? styles.badgeDue : ""}`}>
            {question.answered_at
              ? REVIEW_LABELS[effectiveReviewStatus(question, now)]
              : "Offene Frage"}
          </Badge>
        </div>
        {question.description && (
          <p className={styles.description}>
            {question.description}
          </p>
        )}
        <div className={question.answered_at ? `${styles.answer} ${styles.summaryAnswer}` : styles.emptyAnswer}>
          <p>{question.answered_at ? question.answer_excerpt : "Diese Frage wartet auf eine Antwort."}</p>{" "}
          <Button className={styles.expandLink} variant="link" onClick={() => setExpanded(true)}>
            Vollständig anzeigen
          </Button>
        </div>
        <div className={styles.metadata}>
          <span>Gefragt von {knowledgePersonName(props.profiles, question.created_by)} · {formatDate(question.created_at)}</span>
          {question.assigned_to && <span>Verantwortlich: {knowledgePersonName(props.profiles, question.assigned_to)}</span>}
          {question.answer_updated_at && <span>Aktualisiert: {formatDate(question.answer_updated_at)}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
