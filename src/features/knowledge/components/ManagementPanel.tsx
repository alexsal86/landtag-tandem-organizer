import styles from "./KnowledgeWorkspace.module.css";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { KnowledgeCard, KnowledgeSummary } from "../types";
import { validateQuestion } from "../logic";
import {
  useKnowledgeWrite,
  useSimilarKnowledgeQuestions,
} from "../hooks/useKnowledgeQuestions";

type Mode = "edit" | "archive" | "merge";
export function ManagementPanel({ question }: { question: KnowledgeCard }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [revision, setRevision] = useState(question.revision);
  const [title, setTitle] = useState(question.title);
  const [description, setDescription] = useState(question.description);
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<KnowledgeSummary | null>(null);
  const [error, setError] = useState("");
  const suggestions = useSimilarKnowledgeQuestions(search);
  const write = useKnowledgeWrite();
  const start = (next: Mode) => {
    setMode(next);
    setRevision(question.revision);
    setTitle(question.title);
    setDescription(question.description);
    setError("");
    setTarget(null);
    setSearch("");
  };
  return (
    <section aria-label="Frage verwalten" className={`${styles.management} space-y-3`}>
      <div className={styles.actions}>
        <Button className={`${styles.button} ${styles.ghostButton}`} size="sm" variant="ghost" onClick={() => start("edit")}>
          Frage bearbeiten
        </Button>
        <Button className={`${styles.button} ${styles.ghostButton}`} size="sm" variant="ghost" onClick={() => start("archive")}>
          Archivieren / schließen
        </Button>
        <Button className={`${styles.button} ${styles.ghostButton}`} size="sm" variant="ghost" onClick={() => start("merge")}>
          Als Duplikat zusammenführen
        </Button>
      </div>
      {mode && (
        <form
          className={`${styles.review} space-y-3`}
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            try {
              if (mode === "edit") {
                const invalid = validateQuestion(title, description);
                if (invalid) throw new Error(invalid);
              }
              if (mode === "merge" && !target)
                throw new Error("Bitte eine Zielfrage auswählen.");
              await write.mutateAsync({
                name: "knowledge_qa_manage",
                args: {
                  p_question: question.id,
                  p_expected_revision: revision,
                  p_action: mode,
                  p_title: mode === "edit" ? title : undefined,
                  p_description: mode === "edit" ? description : undefined,
                  p_target: mode === "merge" ? target!.id : undefined,
                  p_target_revision:
                    mode === "merge" ? target!.revision : undefined,
                },
              });
              setMode(null);
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Die Änderung konnte nicht gespeichert werden.",
              );
            }
          }}
        >
          {mode === "edit" && (
            <>
              <Label htmlFor={`edit-title-${question.id}`}>Frage</Label>
              <Input className={styles.formInput}
                id={`edit-title-${question.id}`}
                required
                maxLength={300}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <Label htmlFor={`edit-description-${question.id}`}>
                Beschreibung
              </Label>
              <Textarea className={styles.formInput}
                id={`edit-description-${question.id}`}
                maxLength={10000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </>
          )}
          {mode === "archive" && (
            <p className="text-sm">
              Diese Frage schließen? Sie verschwindet aus den Listen. Antwort,
              Anhänge und Verlauf bleiben erhalten.
            </p>
          )}
          {mode === "merge" && (
            <>
              <Label htmlFor={`merge-search-${question.id}`}>
                Zielantwort suchen
              </Label>
              <Input className={styles.formInput}
                id={`merge-search-${question.id}`}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setTarget(null);
                }}
                placeholder="Mindestens vier Zeichen eingeben"
              />
              {suggestions.data
                ?.filter((item) => item.id !== question.id)
                .map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    variant={target?.id === item.id ? "secondary" : "outline"}
                    className={`${styles.button} ${styles.mergeTarget} ${target?.id === item.id ? styles.selectedTarget : ""}`}
                    onClick={() => setTarget(item)}
                  >
                    {item.title}
                  </Button>
                ))}
              {suggestions.isError && (
                <p role="alert">Zielantworten konnten nicht geladen werden.</p>
              )}
              {target && (
                <p className="text-sm">
                  Als Duplikat schließen und auf „{target.title}“ verweisen?
                  Beide Antworten und Verläufe bleiben erhalten.
                </p>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              className={styles.button}
              variant="outline"
              size="sm"
              disabled={write.isPending || (mode === "merge" && !target)}
            >
              {mode === "edit"
                ? "Änderungen speichern"
                : "Schließen bestätigen"}
            </Button>
            <Button
              className={`${styles.button} ${styles.ghostButton}`}
              size="sm"
              type="button"
              variant="ghost"
              disabled={write.isPending}
              onClick={() => setMode(null)}
            >
              Abbrechen
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
