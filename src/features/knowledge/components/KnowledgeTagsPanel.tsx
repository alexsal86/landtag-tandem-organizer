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
import { useNavigate } from "react-router-dom";
import { useCallback, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useKnowledgeTagSuggestions,
  useKnowledgeExtraWrite,
} from "../hooks/useKnowledgeExtras";
import type { KnowledgeCard } from "../types";
import { useTopics } from "@/hooks/useTopics";
import styles from "./KnowledgeWorkspace.module.css";

export function KnowledgeTagsPanel({
  question,
  canWrite,
}: {
  question: KnowledgeCard;
  canWrite: boolean;
}) {
  const { topics: platformTopics } = useTopics();
  const write = useKnowledgeExtraWrite();
  const navigate = useNavigate();
  const topicFor = (name: string) =>
    platformTopics.find((t) => t.label.toLowerCase() === name.toLowerCase());
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
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
    <section
      className={`${styles.slideCard} ${styles.topicsPanel} space-y-3`}
      aria-label="Themen"
    >
      <h3 className="font-medium">Themen</h3>
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
      {canWrite && question.answered_at && !question.archived_at && (
        <div className={styles.tagEntry}>
          <p id={`${listId}-label`} className={styles.tagEntryLabel}>
            Tag hinzufügen ({tags.length} von 5)
          </p>
          <div className={styles.tagEntryRow}>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  ref={trigger}
                  className={styles.tagSearchField}
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
                  aria-labelledby={`${listId}-label`}
                  disabled={write.isPending || tags.length >= 5}
                >
                  {input || "Suchen oder neu anlegen"}
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
                    placeholder="Suchen oder neu anlegen"
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
                            onSelect={() => {
                              setInput(tag.name);
                              setOpen(false);
                            }}
                          >
                            {tag.name}
                          </CommandItem>
                        ))}
                        {canCreate && (
                          <CommandItem
                            value="__create__"
                            disabled={write.isPending}
                            onSelect={() => {
                              setInput(input.trim());
                              setOpen(false);
                            }}
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
            <Button
              type="button"
              variant="outline"
              className={styles.tagAddButton}
              disabled={
                write.isPending ||
                tags.length >= 5 ||
                (input.length > 0 &&
                  Boolean(
                    validateKnowledgeTagNames([
                      ...tags.map((tag) => tag.name),
                      input,
                    ]),
                  ))
              }
              onClick={() => {
                if (!input.trim()) setOpen(true);
                else
                  void update([...tags.map((tag) => tag.name), input.trim()]);
              }}
            >
              Hinzufügen
            </Button>
          </div>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
