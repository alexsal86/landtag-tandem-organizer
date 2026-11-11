import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandGroup,
} from "@/components/ui/command";
import { validateKnowledgeTagNames } from "../logic";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCallback, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useKnowledgeTags,
  useKnowledgeTagSuggestions,
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
  const navigate = useNavigate();
  const topicFor = (name: string) =>
    platformTopics.find((t) => t.label.toLowerCase() === name.toLowerCase());
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [manage, setManage] = useState<KnowledgeTag | null>(null);
  const [newName, setNewName] = useState("");
  const [target, setTarget] = useState("");
  const tags = question.tags ?? [];
  const [open, setOpen] = useState(false);
  const listId = useId();
  const [controlledListId, setControlledListId] = useState(listId);
  const bindList = useCallback((node: HTMLDivElement | null) => {
    if (node) setControlledListId(node.id);
  }, []);
  const trigger = useRef<HTMLButtonElement>(null);
  const chips = useRef<HTMLDivElement>(null);
  const matches = useKnowledgeTagSuggestions(
    input,
    tags.map((tag) => tag.name),
    open,
  );
  const canCreate = Boolean(
    matches.data &&
    input.trim().length >= 2 &&
    !matches.data.exact &&
    !tags.some((tag) => tag.name.toLowerCase() === input.trim().toLowerCase()),
  );
  const visible = matches.data?.items.slice(0, canCreate ? 7 : 8) ?? [];
  const remaining = (matches.data?.total ?? 0) - visible.length;
  const update = async (names: string[]) => {
    setError("");
    try {
      const invalid = validateKnowledgeTagNames(names);
      if (invalid) throw new Error(invalid);
      await write.mutateAsync({
        name: "knowledge_qa_set_tags",
        args: {
          p_question: question.id,
          p_expected_revision: question.revision,
          p_names: names,
        },
      });
      setInput("");
      setOpen(false);
      if (!open)
        requestAnimationFrame(() => {
          if (trigger.current && !trigger.current.disabled)
            trigger.current.focus();
          else
            chips.current
              ?.querySelector<HTMLButtonElement>("button[aria-label^='Tag ']")
              ?.focus();
        });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Tags konnten nicht gespeichert werden.",
      );
    }
  };
  return (
    <section className={`${styles.slideCard} space-y-3`} aria-label="Themen">
      <h3 className="font-medium">
        Themen{" "}
        <span className="text-sm text-muted-foreground">{tags.length}/5</span>
      </h3>
      <div ref={chips} className={styles.topicChips}>
        {tags.map((tag) => (
          <span className={styles.topicChip} key={tag.id}>
            {topicFor(tag.name) ? (
              <button
                type="button"
                className={styles.topicName}
                aria-label={`Thema ${tag.name} plattformweit anzeigen`}
                onClick={() => navigate(`/themen/${topicFor(tag.name)!.id}`)}
              >
                {tag.name}
              </button>
            ) : (
              <span className={styles.topicName}>{tag.name}</span>
            )}
            {canWrite && question.answered_at && !question.archived_at && (
              <button
                type="button"
                aria-label={`Tag ${tag.name} entfernen`}
                disabled={write.isPending}
                className={styles.topicRemove}
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
          </span>
        ))}
      </div>
      {!tags.length && (
        <p className="text-sm text-muted-foreground">Keine Tags vergeben.</p>
      )}
      {canWrite && question.answered_at && !question.archived_at && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={trigger}
              variant="outline"
              role="combobox"
              aria-haspopup="listbox"
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setOpen(true);
                }
              }}
              aria-expanded={open}
              aria-controls={controlledListId}
              aria-label="Thema hinzufügen"
              disabled={write.isPending || tags.length >= 5}
            >
              {tags.length >= 5 ? "Maximal fünf Themen" : "Thema hinzufügen"}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className={`${styles.theme} ${styles.tagPopover}`}
            align="start"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (trigger.current && !trigger.current.disabled)
                trigger.current.focus();
              else
                chips.current
                  ?.querySelector<HTMLButtonElement>(
                    "button[aria-label^='Tag ']",
                  )
                  ?.focus();
            }}
          >
            <Command label="Themen durchsuchen" shouldFilter={false} loop>
              <CommandInput
                value={input}
                onValueChange={setInput}
                maxLength={30}
                placeholder="Thema suchen …"
                aria-label="Themen durchsuchen"
              />
              <CommandList ref={bindList} label="Themenvorschläge">
                {matches.isError ? (
                  <p role="alert" className="p-3 text-sm">
                    Themen konnten nicht geladen werden.
                  </p>
                ) : !matches.data ? (
                  <p role="status" className="p-3 text-sm">
                    Themen werden geladen …
                  </p>
                ) : (
                  <CommandGroup>
                    {visible.map((tag) => (
                      <CommandItem
                        key={tag.id}
                        value={tag.id}
                        disabled={write.isPending}
                        onSelect={() =>
                          void update([
                            ...tags.map((item) => item.name),
                            tag.name,
                          ])
                        }
                      >
                        {tag.name}
                      </CommandItem>
                    ))}
                    {canCreate && (
                      <CommandItem
                        value="__create__"
                        disabled={write.isPending}
                        onSelect={() =>
                          void update([
                            ...tags.map((tag) => tag.name),
                            input.trim(),
                          ])
                        }
                      >
                        Neu anlegen: „{input.trim()}“
                      </CommandItem>
                    )}
                    {!visible.length && !canCreate && (
                      <p className="p-3 text-sm">
                        Keine weiteren Themen gefunden.
                      </p>
                    )}
                  </CommandGroup>
                )}
              </CommandList>
              {remaining > 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  + {remaining} weitere – Suche verfeinern
                </p>
              )}
              {error && (
                <p role="alert" className="p-3 text-sm">
                  {error}
                </p>
              )}
            </Command>
          </PopoverContent>
        </Popover>
      )}
      {canManage && !question.archived_at && tags.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm">Themen verwalten</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Button
                key={tag.id}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setManage(tag);
                  setNewName(tag.name);
                  setTarget("");
                }}
              >
                {tag.name} verwalten
              </Button>
            ))}
          </div>
        </details>
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
