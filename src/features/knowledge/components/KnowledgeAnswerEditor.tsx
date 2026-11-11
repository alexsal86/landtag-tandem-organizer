import styles from "./KnowledgeWorkspace.module.css";
import { useState } from "react";
import EnhancedLexicalEditor from "@/components/lexical/EnhancedLexicalEditor";
import { Button } from "@/components/ui/button";
import { parseAnswer } from "../logic";
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
  const [error, setError] = useState("");
  const write = useKnowledgeWrite();
  return (
    <div className={`${styles.editor} space-y-3`}>
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
          placeholder="Schreibe eine kurze, hilfreiche Antwort …"
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
          disabled={write.isPending || !draft.plainText.trim()}
          onClick={async () => {
            setError("");
            try {
              await write.mutateAsync({
                name: "knowledge_qa_save_answer",
                args: {
                  p_question: base.id,
                  p_expected_revision: base.revision,
                  p_content: parseAnswer(draft.nodesJson),
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
