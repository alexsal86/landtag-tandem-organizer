import styles from "./KnowledgeWorkspace.module.css";
import { useState } from "react";
import EnhancedLexicalEditor from "@/components/lexical/EnhancedLexicalEditor";
import { Button } from "@/components/ui/button";
import {
  MAX_SHORT_ANSWER,
  normalizeShortAnswer,
  parseAnswer,
  validateShortAnswer,
} from "../logic";
import { useKnowledgeWrite } from "../hooks/useKnowledgeQuestions";
import type { AnswerDraft, KnowledgeQuestion } from "../types";

export function KnowledgeAnswerEditor({
  question,
  onClose,
}: {
  question: KnowledgeQuestion;
  onClose: () => void;
}) {
  // Keep the revision from opening the editor; a background refresh must not
  // silently make an old draft overwrite someone else's changes.
  const [base] = useState(question);
  const [draft, setDraft] = useState<AnswerDraft>({
    plainText: base.answer_text,
    nodesJson: base.answer_content
      ? JSON.stringify(base.answer_content)
      : undefined,
  });
  const [short, setShort] = useState(base.answer_short ?? "");
  const [error, setError] = useState("");
  const write = useKnowledgeWrite();
  const shortError = validateShortAnswer(short);
  return (
    <div className={`${styles.editor} space-y-3`}>
      <div className="space-y-1">
        <label htmlFor="knowledge-short-answer" className="text-sm font-medium">
          Kurzantwort
        </label>
        <textarea
          id="knowledge-short-answer"
          className="min-h-[76px] w-full rounded-md border bg-background p-2 text-sm"
          value={short}
          maxLength={MAX_SHORT_ANSWER}
          disabled={write.isPending}
          placeholder="In ein bis drei Sätzen: Was gilt?"
          onChange={(event) => setShort(event.target.value)}
          aria-describedby="knowledge-short-answer-hint"
        />
        <p
          id="knowledge-short-answer-hint"
          className="text-xs text-muted-foreground"
        >
          1–3 Sätze. Erscheint in Liste, Suche und Zitat.{" "}
          {normalizeShortAnswer(short).length}/{MAX_SHORT_ANSWER} Zeichen
        </p>
      </div>
      <div inert={write.isPending} aria-busy={write.isPending}>
        <EnhancedLexicalEditor
          knowledgeMode
          content={base.answer_text}
          contentNodes={
            base.answer_content
              ? JSON.stringify(base.answer_content)
              : undefined
          }
          onChange={setDraft}
          placeholder="Ausführliche Antwort mit Begründung und Belegen …"
        />
      </div>
      {base.review_status === "verified" && (
        <p className="text-xs text-muted-foreground">
          Eine gespeicherte Änderung setzt die Prüfbestätigung zurück.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <Button
          className={`${styles.button} ${styles.primaryButton}`}
          disabled={
            write.isPending ||
            !draft.plainText.trim() ||
            Boolean(shortError)
          }
          onClick={async () => {
            setError("");
            if (shortError) {
              setError(shortError);
              return;
            }
            try {
              await write.mutateAsync({
                name: "knowledge_qa_save_answer",
                args: {
                  p_question: base.id,
                  p_expected_revision: base.revision,
                  p_content: parseAnswer(draft.nodesJson),
                  p_short: normalizeShortAnswer(short),
                },
              });
              onClose();
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Die Antwort konnte nicht gespeichert werden.",
              );
            }
          }}
        >
          {write.isPending ? "Wird gespeichert …" : "Antwort speichern"}
        </Button>
        <Button className={`${styles.button} ${styles.ghostButton}`} variant="ghost" disabled={write.isPending} onClick={onClose}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
