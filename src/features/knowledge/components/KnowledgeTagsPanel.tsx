import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useKnowledgeTags,
  useKnowledgeExtraWrite,
} from "../hooks/useKnowledgeExtras";
import type { KnowledgeCard, KnowledgeTag } from "../types";
import { useTopics } from "@/hooks/useTopics";
import styles from "./KnowledgeWorkspace.module.css";

export function KnowledgeTagsPanel({
  question,
  canWrite,
  canManage,
}: {
  question: KnowledgeCard;
  canWrite: boolean;
  canManage: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const suggestions = useKnowledgeTags();
  const { topics: platformTopics } = useTopics();
  const write = useKnowledgeExtraWrite();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [manage, setManage] = useState<KnowledgeTag | null>(null);
  const [newName, setNewName] = useState("");
  const [target, setTarget] = useState("");
  const tags = question.tags ?? [];
  const update = async (names: string[]) => {
    setError("");
    try {
      if (
        names.length > 5 ||
        names.some((name) => name.trim().length < 2 || name.trim().length > 30)
      )
        throw new Error("Höchstens fünf Tags mit je 2–30 Zeichen.");
      await write.mutateAsync({
        name: "knowledge_qa_set_tags",
        args: {
          p_question: question.id,
          p_expected_revision: question.revision,
          p_names: names,
        },
      });
      setInput("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Tags konnten nicht gespeichert werden.",
      );
    }
  };
  return (
    <section className="space-y-2 border-t pt-4" aria-label="Tags">
      <h3 className="font-medium">Tags</h3>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span className={styles.tagChip} key={tag.id}>
            {tag.name}
            {canWrite && question.answered_at && !question.archived_at && (
              <button
                type="button"
                aria-label={`Tag ${tag.name} entfernen`}
                disabled={write.isPending}
                className="ml-2"
                onClick={() =>
                  void update(
                    tags
                      .filter((item) => item.id !== tag.id)
                      .map((item) => item.name),
                  )
                }
              >
                ×
              </button>
            )}
            {canManage && (
              <button
                type="button"
                className="ml-2 underline"
                aria-label={`Tag ${tag.name} verwalten`}
                onClick={() => {
                  setManage(tag);
                  setNewName(tag.name);
                  setTarget("");
                }}
              >
                Verwalten
              </button>
            )}
          </span>
        ))}
      </div>
      {!tags.length && (
        <p className="text-sm text-muted-foreground">Keine Tags vergeben.</p>
      )}
      {canWrite && question.answered_at && !question.archived_at && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (input.trim())
              void update([...tags.map((tag) => tag.name), input.trim()]);
          }}
        >
          <Label htmlFor={`tag-input-${question.id}`}>Tag hinzufügen</Label>
          <div className="flex gap-2">
            <Input
              id={`tag-input-${question.id}`}
              list={`tag-options-${question.id}`}
              value={input}
              maxLength={30}
              onChange={(event) => setInput(event.target.value)}
              disabled={write.isPending || tags.length >= 5}
            />
            <Button
              type="submit"
              variant="outline"
              disabled={
                write.isPending || tags.length >= 5 || input.trim().length < 2
              }
            >
              Hinzufügen
            </Button>
          </div>
          <datalist id={`tag-options-${question.id}`}>
            {suggestions.data
              ?.filter((tag) => !tags.some((item) => item.id === tag.id))
              .map((tag) => (
                <option key={tag.id} value={tag.name} />
              ))}
            {platformTopics
              .filter((t) => t.is_active && t.label.length <= 30)
              .filter((t) => !tags.some((item) => item.name.toLowerCase() === t.label.toLowerCase()))
              .filter((t) => !suggestions.data?.some((k) => k.name.toLowerCase() === t.label.toLowerCase()))
              .map((t) => (
                <option key={`topic-${t.id}`} value={t.label} />
              ))}
          </datalist>
        </form>
      )}
      {manage && canManage && (
        <form
          className="space-y-2 rounded border p-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            try {
              await write.mutateAsync({
                name: "knowledge_qa_manage_tag",
                args: {
                  p_tag: manage.id,
                  p_name: target ? undefined : newName.trim(),
                  p_merge_into: target || undefined,
                },
              });
              if (target && params.get("tag") === manage.id)
                setParams((previous) => {
                  const next = new URLSearchParams(previous);
                  next.set("tag", target);
                  return next;
                });
              setManage(null);
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Tag konnte nicht geändert werden.",
              );
            }
          }}
        >
          <Label htmlFor="tag-rename">Tag umbenennen</Label>
          <Input
            id="tag-rename"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            minLength={2}
            maxLength={30}
          />
          <Label htmlFor="tag-merge">
            Oder mit vorhandenem Tag zusammenführen
          </Label>
          <select
            id="tag-merge"
            className={styles.select}
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          >
            <option value="">Nicht zusammenführen</option>
            {suggestions.data
              ?.filter((tag) => tag.id !== manage.id)
              .map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
          </select>
          <div className="flex gap-2">
            <Button variant="outline" disabled={write.isPending}>
              Speichern
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setManage(null)}
            >
              Abbrechen
            </Button>
          </div>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
