import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { KnowledgeCard } from "../types";
import { validateQuestion } from "../logic";
import {
  useKnowledgeWrite,
  useKnowledgeMergeTargets,
  type KnowledgeMergeTarget,
} from "../hooks/useKnowledgeQuestions";
import styles from "./KnowledgeWorkspace.module.css";

export type KnowledgeManagementMode = "edit" | "archive" | "merge" | "restore";
const TITLES = {
  edit: "Frage bearbeiten",
  archive: "Archivieren / schließen",
  merge: "Als Duplikat zusammenführen",
  restore: "Frage wiederherstellen",
};
export const ARCHIVE_REASONS: Record<string, string> = {
  completed: "Erledigt",
  obsolete: "Nicht mehr relevant",
  duplicate: "Doppelte Frage",
  other: "Sonstiges",
};
// Mounted for each opening so these values remain the user's revision baseline.
export function ManagementPanel({
  question,
  mode,
  onClose,
  onReturnFocus,
}: {
  question: KnowledgeCard;
  mode: KnowledgeManagementMode;
  onClose: () => void;
  onReturnFocus: () => void;
}) {
  const [revision] = useState(question.revision);
  const [sourceTags] = useState(question.tags ?? []);
  const [title, setTitle] = useState(question.title);
  const [description, setDescription] = useState(question.description);
  const [reason, setReason] = useState("completed");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<KnowledgeMergeTarget | null>(null);
  const [error, setError] = useState("");
  const suggestions = useKnowledgeMergeTargets(search, question.id);
  const write = useKnowledgeWrite();
  const tagCount = new Set(
    [...sourceTags, ...(target?.tags ?? [])].map((tag) =>
      tag.name.toLowerCase(),
    ),
  ).size;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !write.isPending) onClose();
      }}
    >
      <DialogContent
        className={`${styles.theme} ${styles.managementDialog}`}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{TITLES[mode]}</DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Titel und Beschreibung ändern."
              : mode === "restore"
                ? "Die Frage wird wieder in den Listen angezeigt. Bereits übernommene Themen der Zielfrage bleiben erhalten."
                : "Antwort, Anhänge und Verlauf bleiben erhalten. Die Frage kann später wiederhergestellt werden."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="min-w-0 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            try {
              if (mode === "edit") {
                const invalid = validateQuestion(title, description);
                if (invalid) throw new Error(invalid);
              }
              if (mode === "merge" && (!target || tagCount > 5))
                throw new Error(
                  "Bitte eine Zielfrage mit insgesamt höchstens fünf Themen wählen.",
                );
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
                  p_reason: mode === "archive" ? reason : undefined,
                },
              });
              onClose();
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Änderung konnte nicht gespeichert werden.",
              );
            }
          }}
        >
          {mode === "edit" && (
            <>
              <div className={styles.sourceField}>
                <Label htmlFor="knowledge-edit-title">Frage</Label>
                <Input
                  id="knowledge-edit-title"
                  required
                  maxLength={300}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className={styles.sourceField}>
                <Label htmlFor="knowledge-edit-description">Beschreibung</Label>
                <Textarea
                  id="knowledge-edit-description"
                  maxLength={10000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
            </>
          )}
          {mode === "archive" && (
            <div className={styles.sourceField}>
              <Label htmlFor="knowledge-archive-reason">Grund</Label>
              <select
                id="knowledge-archive-reason"
                className={styles.select}
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              >
                {Object.entries(ARCHIVE_REASONS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {mode === "merge" && (
            <>
              <div className={styles.sourceField}>
                <Label htmlFor="knowledge-merge-search">Zielfrage suchen</Label>
                <Input
                  id="knowledge-merge-search"
                  maxLength={300}
                  placeholder="Mindestens zwei Zeichen eingeben"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setTarget(null);
                  }}
                />
              </div>
              <div className="space-y-2" aria-label="Zielfragen">
                {suggestions.data?.map((item) => (
                  <Button
                    type="button"
                    key={item.id}
                    className={`${styles.button} ${styles.mergeTarget}`}
                    variant={target?.id === item.id ? "secondary" : "outline"}
                    aria-pressed={target?.id === item.id}
                    onClick={() => setTarget(item)}
                  >
                    {item.title}
                  </Button>
                ))}
              </div>
              {suggestions.isFetching && (
                <p role="status">Zielfragen werden gesucht …</p>
              )}
              {suggestions.isError && (
                <p role="alert">Zielfragen konnten nicht geladen werden.</p>
              )}
              {suggestions.data?.length === 0 && (
                <p>Keine passende Zielfrage gefunden.</p>
              )}
              {target && (
                <p>
                  Auf „{target.title}“ verweisen und Themen übernehmen (
                  {tagCount}/5).
                </p>
              )}
              {target && tagCount > 5 && (
                <p role="alert">
                  Zusammen mehr als fünf Themen. Bitte die Themen vor dem
                  Zusammenführen reduzieren.
                </p>
              )}
            </>
          )}
          {error && <p role="alert">{error}</p>}
          <div className={styles.actions}>
            <Button
              type="submit"
              disabled={
                write.isPending ||
                (mode === "merge" && (!target || tagCount > 5))
              }
            >
              {write.isPending
                ? "Wird gespeichert …"
                : mode === "edit"
                  ? "Änderungen speichern"
                  : mode === "restore"
                    ? "Wiederherstellen"
                    : mode === "merge"
                      ? "Zusammenführen"
                      : "Archivieren"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={write.isPending}
              onClick={onClose}
            >
              Abbrechen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
