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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Frage stellen</DialogTitle>
          <DialogDescription>
            Eine Frage genügt. Ein Kollege kann sie hier beantworten.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
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
          <div className="space-y-1">
            <Label htmlFor="knowledge-question">Frage</Label>
            <Input
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
              className="space-y-2 rounded border p-3"
            >
              <h3 className="text-sm font-medium">
                Gibt es dazu schon eine Antwort?
              </h3>
              {similar.data.map((question) => (
                <Link
                  key={question.id}
                  className="block rounded border bg-muted/30 p-2 text-sm hover:bg-muted"
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
          <div className="space-y-1">
            <Label htmlFor="knowledge-description">
              Ergänzende Informationen (optional)
            </Label>
            <Textarea
              id="knowledge-description"
              maxLength={10000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="knowledge-assignee">Zuständig (optional)</Label>
            <select
              id="knowledge-assignee"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
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
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={write.isPending}
              onClick={onClose}
            >
              Abbrechen
            </Button>
            <Button disabled={!title.trim() || write.isPending}>
              {write.isPending ? "Wird gespeichert …" : "Frage stellen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
