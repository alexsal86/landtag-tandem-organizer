import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { useKnowledgeSources } from "../hooks/useKnowledgeExtras";
import { KnowledgeSourceList } from "./KnowledgeSourcesPanel";
import styles from "./KnowledgeWorkspace.module.css";
import { useState } from "react";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { KnowledgeCard } from "../types";
import { useKnowledgeWrite } from "../hooks/useKnowledgeQuestions";

export function ReviewPanel({
  question,
  now,
  primary = false,
}: {
  question: KnowledgeCard;
  now: number;
  primary?: boolean;
}) {
  const [baseRevision, setBaseRevision] = useState<number | null>(null);
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState("");
  const write = useKnowledgeWrite();
  const sources = useKnowledgeSources(question.id, baseRevision !== null);
  const review = async (verified: boolean) => {
    setError("");
    try {
      if (
        verified &&
        dueAt &&
        (!Number.isFinite(Date.parse(dueAt)) || Date.parse(dueAt) <= now)
      ) {
        throw new Error("Der Prüftermin muss in der Zukunft liegen.");
      }
      await write.mutateAsync({
        name: "knowledge_qa_review",
        args: {
          p_question: question.id,
          p_expected_revision: verified ? baseRevision! : question.revision,
          p_verified: verified,
          p_due_at:
            verified && dueAt ? new Date(dueAt).toISOString() : undefined,
        },
      });
      setBaseRevision(null);
      setDueAt("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Prüfung konnte nicht gespeichert werden.",
      );
    }
  };
  return (
    <Dialog open={baseRevision !== null} onOpenChange={open => { if (!open) setBaseRevision(null); }}><div className={styles.reviewControls}>
      <div className={styles.reviewTriggers}>
        <DialogTrigger asChild><Button
          className={`${styles.button} ${primary && baseRevision === null ? styles.primaryButton : ""}`}
          variant={primary && baseRevision === null ? "default" : "outline"}
          size="sm"
          disabled={write.isPending}
          onClick={() => {
            setBaseRevision(question.revision);
            setError("");
          }}
        >
          <CheckCheck className="mr-2 h-4 w-4" />
          Als aktuell geprüft markieren
        </Button></DialogTrigger>
        <Button
          className={`${styles.button} ${styles.ghostButton}`}
          variant="ghost"
          size="sm"
          disabled={write.isPending}
          onClick={() => void review(false)}
        >
          Überprüfung anfordern
        </Button>
      </div>
      {baseRevision !== null && (
        <DialogContent className={`${styles.theme} space-y-3 max-h-[90dvh] overflow-auto`}>
          <DialogHeader><DialogTitle>Aktualität bestätigen</DialogTitle><DialogDescription>Prüfe Antwort und Quellen auf Aktualität.</DialogDescription></DialogHeader>
          <h4 className="font-medium">Quellen abgleichen</h4>
          {sources.isPending ? <p>Quellen werden geladen …</p> : sources.isError ? <p role="alert">Quellen konnten nicht geladen werden.</p> : <KnowledgeSourceList sources={sources.data ?? []} />}
          {error && <p role="alert">{error}</p>}
          <Label htmlFor={`due-${question.id}`}>
            Erneut prüfen am (optional)
          </Label>
          <input
            id={`due-${question.id}`}
            type="datetime-local"
            className={`${styles.formInput} block max-w-full`}
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
          />
          <div className={styles.actions}>
            <Button
              className={`${styles.button} ${styles.primaryButton}`}
              size="sm"
              disabled={write.isPending || sources.isPending || sources.isError}
              onClick={() => void review(true)}
            >
              Aktualität bestätigen
            </Button>
            <Button
              className={`${styles.button} ${styles.ghostButton}`}
              variant="ghost"
              size="sm"
              disabled={write.isPending}
              onClick={() => {
                setBaseRevision(null);
                setDueAt("");
              }}
            >
              Abbrechen
            </Button>
          </div>
        </DialogContent>
      )}
      {error && baseRevision === null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div></Dialog>
  );
}
