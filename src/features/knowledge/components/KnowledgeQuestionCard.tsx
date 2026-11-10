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
  onOpen,
}: {
  question: KnowledgeCard;
  profiles: TenantProfileOption[];
  assignable: TenantProfileOption[];
  canWrite: boolean;
  canVerify: boolean;
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
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="min-w-0 flex-1 text-lg font-semibold break-words">
            <button className="text-left hover:underline" onClick={onOpen}>
              {question.title}
            </button>
          </h2>
          <Badge
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
        {question.description && (
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
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
            <EnhancedLexicalEditor
              key={`${question.id}-${question.answer_revision}`}
              knowledgeMode
              editable={false}
              showToolbar={false}
              content={question.answer_text}
              contentNodes={validContent}
              onChange={() => {}}
            />
            <KnowledgeAttachments question={question} canWrite={canWrite} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Diese Frage wartet auf eine Antwort.
          </p>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
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
        {canWrite ? (
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
          <div className="flex flex-wrap gap-2">
            {canWrite && (
              <Button
                variant={question.answered_at ? "outline" : "default"}
                size="sm"
                onClick={() => setEditing(true)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {question.answered_at ? "Antwort bearbeiten" : "Beantworten"}
              </Button>
            )}
            <Button
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
        {!editing && question.answered_at && canVerify && (
          <ReviewPanel question={question} now={now} />
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
          <Button onClick={() => void detail.refetch()}>
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
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap justify-between gap-2">
          <h2 className="text-lg font-semibold">
            <button onClick={props.onOpen}>{question.title}</button>
          </h2>
          <Badge>
            {question.answered_at
              ? REVIEW_LABELS[effectiveReviewStatus(question, now)]
              : "Offene Frage"}
          </Badge>
        </div>
        {question.description && (
          <p className="text-sm text-muted-foreground">
            {question.description}
          </p>
        )}
        <p className="whitespace-pre-wrap text-sm">
          {question.answered_at
            ? question.answer_excerpt
            : "Diese Frage wartet auf eine Antwort."}
        </p>
        <Button variant="outline" onClick={() => setExpanded(true)}>
          Vollständig anzeigen
        </Button>
      </CardContent>
    </Card>
  );
}
