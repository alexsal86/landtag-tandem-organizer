import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  const comments = useKnowledgeComments(
    question.id,
    !question.answered_at && !question.archived_at,
  );
  const write = useKnowledgeExtraWrite();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  if (question.answered_at || question.archived_at) return null;
  return (
    <section className="space-y-3 border-t pt-4" aria-label="Rückfragen">
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
      {!question.answered_at && !question.archived_at && (
        <form
          className="space-y-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setMessage("");
            try {
              await write.mutateAsync({
                name: "knowledge_qa_comment",
                args: {
                  p_question: question.id,
                  p_expected_revision: question.revision,
                  p_body: body.trim(),
                },
              });
              setBody("");

              setMessage("Rückfrage gespeichert.");
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Änderung konnte nicht gespeichert werden.",
              );
            }
          }}
        >
          <Label htmlFor="knowledge-conversation">Rückfrage</Label>
          <Textarea
            id="knowledge-conversation"
            maxLength={1000}
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <Button variant="outline" disabled={write.isPending}>
            Rückfrage senden
          </Button>
        </form>
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

export function KnowledgeFollowToggle({ questionId }: { questionId: string }) {
  const following = useKnowledgeFollow(questionId);
  const write = useKnowledgeExtraWrite();
  const [error, setError] = useState("");
  return (
    <div className="min-w-0 max-w-24 break-words">
      <Button
        variant={following.data ? "secondary" : "ghost"}
        size="sm"
        aria-pressed={Boolean(following.data)}
        disabled={write.isPending || following.isPending || following.isError}
        onClick={async () => {
          setError("");
          try {
            await write.mutateAsync({
              name: "knowledge_qa_follow",
              args: { p_question: questionId, p_follow: !following.data },
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
        Folgen
      </Button>
      {following.isError && (
        <p role="alert" className="text-xs">
          Folgestatus nicht verfügbar.
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

export function KnowledgeOutdatedReport({
  question,
}: {
  question: KnowledgeCard;
}) {
  const [revision, setRevision] = useState<number | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const write = useKnowledgeExtraWrite();
  return (
    <Dialog
      open={revision !== null}
      onOpenChange={(open) => {
        if (!open && !write.isPending) setRevision(null);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setRevision(question.revision);
            setBody("");
            setError("");
          }}
        >
          Veraltet melden
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Veraltet melden</DialogTitle>
          <DialogDescription>
            Die zuständigen Personen werden informiert. Mehrere Meldungen werden
            zusammengefasst.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            try {
              await write.mutateAsync({
                name: "knowledge_qa_report_outdated",
                args: {
                  p_question: question.id,
                  p_expected_revision: revision!,
                  p_body: body.trim(),
                },
              });
              setRevision(null);
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Meldung konnte nicht gespeichert werden.",
              );
            }
          }}
        >
          <Label htmlFor="knowledge-outdated-body">
            Was ist veraltet? (optional)
          </Label>
          <Textarea
            id="knowledge-outdated-body"
            maxLength={1000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          {error && <p role="alert">{error}</p>}
          <Button variant="outline" disabled={write.isPending}>
            Meldung absenden
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
