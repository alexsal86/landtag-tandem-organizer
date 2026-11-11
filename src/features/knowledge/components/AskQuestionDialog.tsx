import styles from "./KnowledgeWorkspace.module.css";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useSimilarKnowledgeQuestions,
  useKnowledgePeople,
  useKnowledgeScope,
  useKnowledgeWrite,
} from "../hooks/useKnowledgeQuestions";
import { validateQuestion } from "../logic";

export function AskQuestionDialog({
  initialQuestion,
  onClose,
  onCreated,
}: {
  initialQuestion: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState(initialQuestion);
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [error, setError] = useState("");
  const { tenantId } = useKnowledgeScope();
  const { assignable: profiles } = useKnowledgePeople();
  const write = useKnowledgeWrite();
  const similar = useSimilarKnowledgeQuestions(title);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !write.isPending) onClose();
      }}
    >
      <DialogContent className={`${styles.theme} ${styles.dialog}`} overlayClassName="bg-black/40">
        <DialogHeader className={styles.dialogHeader}>
          <DialogTitle className={styles.dialogTitle}>Frage stellen</DialogTitle>
          <DialogDescription className={styles.dialogDescription}>
            Eine Frage genügt. Ein Kollege kann sie hier beantworten.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const validation = validateQuestion(title, description);
            if (validation) {
              setError(validation);
              return;
            }
            setError("");
            try {
              const question = await write.mutateAsync({
                name: "knowledge_qa_create_question",
                args: {
                  p_tenant: tenantId!,
                  p_title: title.trim(),
                  p_description: description,
                  p_assigned_to: assignee || undefined,
                },
              });
              onCreated(question.id);
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Die Frage konnte nicht gespeichert werden.",
              );
            }
          }}
        >
          <div className={styles.formField}>
            <Label htmlFor="knowledge-question">Frage</Label>
            <Input
              className={styles.formInput}
              id="knowledge-question"
              autoFocus
              required
              maxLength={300}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Was möchtest du wissen?"
            />
          </div>
          {similar.data && similar.data.length > 0 && (
            <section
              aria-label="Ähnliche Fragen"
              className={styles.similar}
            >
              <h3 className="text-sm font-medium">
                Gibt es dazu schon eine Antwort?
              </h3>
              {similar.data.map((question) => (
                <Link
                  key={question.id}
                  className={styles.similarCard}
                  to={`?frage=${question.id}`}
                  onClick={onClose}
                >
                  <span className="block font-medium">{question.title}</span>
                  <span className="text-muted-foreground">
                    {question.answer_excerpt}
                  </span>
                </Link>
              ))}
            </section>
          )}
          {similar.isError && (
            <p className="text-sm text-muted-foreground">
              Ähnliche Fragen konnten nicht geladen werden. Du kannst deine
              Frage trotzdem stellen.
            </p>
          )}
          <div className={styles.formField}>
            <Label htmlFor="knowledge-description">
              Ergänzende Informationen (optional)
            </Label>
            <Textarea
              className={styles.formInput}
              id="knowledge-description"
              maxLength={10000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className={styles.formField}>
            <Label htmlFor="knowledge-assignee">Zuständig (optional)</Label>
            <select
              id="knowledge-assignee"
              className={styles.formInput}
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
            >
              <option value="">Noch nicht zugeordnet</option>
              {profiles.map((profile) => (
                <option key={profile.user_id} value={profile.user_id}>
                  {profile.display_name || "Unbekannt"}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className={styles.formActions}>
            <Button
              className={`${styles.button} ${styles.ghostButton}`}
              type="button"
              variant="outline"
              disabled={write.isPending}
              onClick={onClose}
            >
              Abbrechen
            </Button>
            <Button className={`${styles.button} ${styles.primaryButton}`} disabled={!title.trim() || write.isPending}>
              {write.isPending ? "Wird gespeichert …" : "Frage stellen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
