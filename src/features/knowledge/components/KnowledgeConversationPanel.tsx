import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { KnowledgeCard } from "../types";
import {
  useKnowledgeComments,
  useKnowledgeExtraWrite,
  useKnowledgeFollow,
} from "../hooks/useKnowledgeExtras";
import { KnowledgePersonLabel } from "./KnowledgePersonAvatar";
import { formatKnowledgeRelativeDate } from "./presentation";

export function KnowledgeConversationPanel({
  question,
}: {
  question: KnowledgeCard;
}) {
  const comments = useKnowledgeComments(question.id, !question.answered_at && !question.archived_at);
  const following = useKnowledgeFollow(question.id);
  const write = useKnowledgeExtraWrite();
  const [body, setBody] = useState("");
  const [report, setReport] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  return (
    <section
      className="space-y-3 border-t pt-4"
      aria-label="Rückfragen und Folgen"
    >
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          aria-pressed={Boolean(following.data)}
          disabled={write.isPending || following.isPending || following.isError}
          onClick={async () => {
            setError("");
            try {
              await write.mutateAsync({
                name: "knowledge_qa_follow",
                args: { p_question: question.id, p_follow: !following.data },
              });
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Folgen konnte nicht geändert werden.",
              );
            }
          }}
        >
          {following.data ? "Nicht mehr folgen" : "Frage folgen"}
        </Button>
        {question.answered_at && !question.archived_at && (
          <Button
            variant="ghost"
            onClick={() => {
              setReport((value) => !value);
              setBody("");
            }}
          >
            Veraltet melden
          </Button>
        )}
      </div>
      {!question.answered_at && !question.archived_at && (
        <>
          <h3 className="font-medium">Rückfragen</h3>
          {comments.isPending && <p>Rückfragen werden geladen …</p>}
          {comments.isError && (
            <p role="alert">Rückfragen konnten nicht geladen werden.</p>
          )}
          {comments.data?.pages
            .flatMap((page) => page.items)
            .map((comment) => (
              <article
                className="space-y-1 rounded border p-3 text-sm"
                key={comment.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <KnowledgePersonLabel person={comment.author_person} />
                  <time
                    dateTime={comment.created_at}
                    className="text-xs text-muted-foreground"
                  >
                    {formatKnowledgeRelativeDate(comment.created_at)}
                  </time>
                </div>
                <p className="whitespace-pre-wrap">{comment.body}</p>
              </article>
            ))}
          {comments.hasNextPage && (
            <Button
              variant="outline"
              disabled={comments.isFetching}
              onClick={() => void comments.fetchNextPage()}
            >
              Ältere Rückfragen laden
            </Button>
          )}
        </>
      )}
      {((!question.answered_at && !question.archived_at) || report) && (
        <form
          className="space-y-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setMessage("");
            try {
              await write.mutateAsync({
                name: report
                  ? "knowledge_qa_report_outdated"
                  : "knowledge_qa_comment",
                args: {
                  p_question: question.id,
                  p_expected_revision: question.revision,
                  p_body: body.trim(),
                },
              });
              setBody("");
              setReport(false);
              setMessage(
                report
                  ? "Meldung erfasst. Weitere Meldungen werden zusammengefasst."
                  : "Rückfrage gespeichert.",
              );
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Änderung konnte nicht gespeichert werden.",
              );
            }
          }}
        >
          <Label htmlFor="knowledge-conversation">
            {report ? "Was ist veraltet? (optional)" : "Rückfrage"}
          </Label>
          <Textarea
            id="knowledge-conversation"
            maxLength={1000}
            required={!report}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <Button variant="outline" disabled={write.isPending}>
            {report ? "Meldung absenden" : "Rückfrage senden"}
          </Button>
        </form>
      )}
      {following.isError && (
        <p role="alert">Folgestatus konnte nicht geladen werden.</p>
      )}
      {error && <p role="alert">{error}</p>}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
