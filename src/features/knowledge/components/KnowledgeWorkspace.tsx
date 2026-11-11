import styles from "./KnowledgeWorkspace.module.css";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionPermission } from "@/hooks/useActionPermission";
import {
  useKnowledgePeople,
  useKnowledgeQuestions,
  useKnowledgeScope,
} from "../hooks/useKnowledgeQuestions";
import { knowledgeUrlState } from "../logic";
import type { KnowledgeView } from "../types";
import { AskQuestionDialog } from "./AskQuestionDialog";
import { KnowledgeQuestionRow } from "./KnowledgeQuestionRow";
import { KnowledgeDetailPanel } from "./KnowledgeDetailPanel";

export function KnowledgeWorkspace() {
  const { tenantId, userId } = useKnowledgeScope();
  if (!tenantId || !userId)
    return (
      <p className="p-6 text-muted-foreground">
        Bitte anmelden und ein Büro auswählen.
      </p>
    );
  return <KnowledgeWorkspaceContent key={`${userId}-${tenantId}`} />;
}
function KnowledgeWorkspaceContent() {
  const [params, setParams] = useSearchParams();
  const searchInput = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.key !== "/" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.defaultPrevented ||
        params.get("frage")
      )
        return;
      if (
        target instanceof Element &&
        target.closest(
          'input,textarea,select,[contenteditable="true"],[role="textbox"],[role="combobox"],[role="dialog"]',
        )
      )
        return;
      event.preventDefault();
      searchInput.current?.focus();
    };
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, [params]);
  const [search, setSearch] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const questionId = params.get("frage");
  const { view, filters } = knowledgeUrlState(params);
  const list = useKnowledgeQuestions(search, view, null, filters);

  const updateParam = (key: string, value: string) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("frage");
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };
  const {
    data: profiles,
    assignable,
    error: profileError,
  } = useKnowledgePeople();
  const { allowed: canWrite } = useActionPermission("knowledge.write");
  const { allowed: canManage } = useActionPermission("knowledge.manage");
  const { allowed: canVerify } = useActionPermission("knowledge.verify");
  const navigateView = (next: KnowledgeView) => {
    setParams((previous) => {
      const value = new URLSearchParams(previous);
      value.delete("frage");
      value.set("ansicht", next);
      if (["open", "assigned", "review"].includes(next))
        value.set("schnell", next);
      else value.delete("schnell");
      return value;
    });
  };
  return (
    <div className={`${styles.theme} ${styles.workspace}`}>
      <section className={styles.content} aria-label="Wissen">
        <header className={styles.header}>
          <div>
            <h1 className={styles.heading}>Wissen</h1>
            <p className={styles.subtitle}>
              Fragen stellen. Wissen miteinander teilen.
            </p>
          </div>
          {canWrite && (
            <Button
              className={`${styles.button} ${styles.primaryButton}`}
              onClick={() => setAsking("")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Frage stellen
            </Button>
          )}
        </header>
        <div className={styles.search}>
          <Search className={styles.searchIcon} />
          <Input
            ref={searchInput}
            className={styles.searchInput}
            aria-label="Wissen durchsuchen"
            placeholder="Was möchtest du wissen?"
            maxLength={300}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              if (questionId) setParams({ ansicht: view });
            }}
          />
          {(list.isFetching || list.debouncing) && (
            <Loader2
              aria-label="Suche läuft"
              className={`${styles.searchPending} animate-spin`}
            />
          )}
        </div>
        {filters.tag && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateParam("tag", "")}
          >
            Tagfilter entfernen
          </Button>
        )}
        {list.topics.length > 0 && (
          <nav
            aria-label="Häufige Themen"
            className={styles.frequentTopics}
          >
            <span>Häufige Themen</span>
            {list.topics.map((tag) => (
              <Button
                key={tag.id}
                size="sm"
                variant="outline"
                className={styles.frequentTopicChip}
                aria-pressed={filters.tag === tag.id}
                onClick={() =>
                  updateParam("tag", filters.tag === tag.id ? "" : tag.id)
                }
              >
                {tag.name} <span>{tag.count}</span>
              </Button>
            ))}
          </nav>
        )}
        <nav className={styles.tabs} aria-label="Wissensansichten">
          {(
            [
              ["answers", "Antworten"],
              ["open", "Offene Fragen"],
              ["mine", "Meine Beiträge"],
              ["assigned", "Mir zugewiesen"],
              ...(canVerify ? [["review", "Prüfung fällig"] as const] : []),
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              variant="ghost"
              className={`${styles.button} ${styles.tab} ${view === key && !questionId ? styles.activeTab : ""}`}
              aria-current={view === key && !questionId ? "page" : undefined}
              onClick={() => navigateView(key as KnowledgeView)}
            >
              {label}{" "}
              <span className={styles.tabCount}>
                {list.counts?.[key as KnowledgeView] ?? "–"}
              </span>
            </Button>
          ))}
        </nav>
        {
          <div className={styles.filters} aria-label="Wissen filtern">
            <label className={styles.filterLabel}>
              <span className="sr-only">Status</span>
              <select
                className={styles.select}
                value={filters.status}
                onChange={(event) => updateParam("status", event.target.value)}
              >
                <option value="">Alle Status</option>
                <option value="open">Offen</option>
                <option value="unverified">Ungeprüft</option>
                <option value="verified">Aktuell geprüft</option>
                <option value="needs_review">Prüfung fällig</option>
              </select>
            </label>
            <label className={styles.filterLabel}>
              <span className="sr-only">Zuständig</span>
              <select
                className={styles.select}
                value={filters.assignee}
                onChange={(event) =>
                  updateParam("zustaendig", event.target.value)
                }
              >
                <option value="">Alle Zuständigen</option>
                <option value="unassigned">Noch nicht zugeordnet</option>
                {profiles.map((profile) => (
                  <option key={profile.user_id} value={profile.user_id}>
                    {profile.display_name || "Unbekannt"}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.filterLabel}>
              <span className="sr-only">Sortierung</span>
              <select
                className={styles.select}
                disabled={Boolean(search.trim())}
                value={filters.sort}
                onChange={(event) =>
                  updateParam("sortierung", event.target.value)
                }
              >
                <option value="updated">Zuletzt aktualisiert</option>
                <option value="oldest">Älteste zuerst</option>
              </select>
              {search.trim() && (
                <span className="ml-2 text-muted-foreground">
                  Suche nach Relevanz
                </span>
              )}
            </label>
          </div>
        }
        {profileError && (
          <p role="alert" className="text-sm text-muted-foreground">
            Mitarbeiternamen konnten nicht geladen werden.
          </p>
        )}
        {!list.isPending && !list.isError && !list.debouncing && (
          <p className={styles.count} role="status">
            {list.totalCount} {list.totalCount === 1 ? "Eintrag" : "Einträge"}
          </p>
        )}
        {list.isError ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 p-5"
          >
            <p>Wissen konnte nicht geladen werden.</p>
            <Button
              className={`${styles.button} mt-3`}
              variant="outline"
              onClick={() => void list.refetch()}
            >
              Erneut versuchen
            </Button>
          </div>
        ) : list.isPending || list.debouncing ? (
          <p className="py-8 text-center text-muted-foreground" role="status">
            {search ? "Antworten werden gesucht …" : "Wissen wird geladen …"}
          </p>
        ) : list.data?.length ? (
          <div>
            {list.data.map((question) => (
              <KnowledgeQuestionRow
                key={question.id}
                question={question}
                showAvatar={!search.trim()}
                onOpen={(element) => {
                  returnFocus.current = element;
                  setParams((previous) => {
                    const next = new URLSearchParams(previous);
                    next.set("frage", question.id);
                    return next;
                  });
                }}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <h2 className="font-medium">
              {questionId
                ? "Frage nicht verfügbar"
                : search
                  ? "Keine passenden Antworten gefunden"
                  : view === "open"
                    ? "Keine offenen Fragen"
                    : view === "mine"
                      ? "Noch keine eigenen Beiträge"
                      : "Hier entsteht euer gemeinsames Wissen"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {questionId
                ? "Die Frage existiert nicht oder du hast keinen Zugriff."
                : search
                  ? "Stelle deine Frage im Büro. Die Antwort bleibt hier auffindbar."
                  : view === "open"
                    ? "Alle bisherigen Fragen wurden beantwortet."
                    : "Eine Frage ist der Anfang. Kategorien oder Schlagwörter brauchst du nicht."}
            </p>
            {canWrite && (
              <Button
                className={`${styles.button} ${styles.primaryButton} mt-4`}
                onClick={() => setAsking(search)}
              >
                {search ? `„${search}“ als Frage stellen` : "Frage stellen"}
              </Button>
            )}
          </div>
        )}
        {list.hasNextPage && (
          <div className={styles.pagination}>
            <Button
              className={styles.button}
              variant="outline"
              disabled={list.isFetching}
              onClick={() => void list.fetchNextPage()}
            >
              Mehr laden (
              {Math.max(0, list.totalCount - (list.data?.length ?? 0))} weitere)
            </Button>
          </div>
        )}
        <footer className={styles.footer}>
          <a
            className="text-sm text-muted-foreground hover:underline"
            href="/dossiers"
          >
            Bisheriger Wissensbereich
          </a>
        </footer>
        <KnowledgeDetailPanel
          questionId={questionId}
          profiles={profiles}
          assignable={assignable}
          canWrite={canWrite}
          canVerify={canVerify}
          canManage={canManage}
          onClose={() =>
            setParams((previous) => {
              const next = new URLSearchParams(previous);
              next.delete("frage");
              return next;
            })
          }
          onReturnFocus={() => {
            if (returnFocus.current?.isConnected) {
              returnFocus.current.focus();
            } else {
              searchInput.current?.focus();
            }
          }}
        />
        {asking !== null && (
          <AskQuestionDialog
            initialQuestion={asking}
            onClose={() => setAsking(null)}
            onCreated={(id) => {
              setAsking(null);
              setSearch("");
              setParams({ ansicht: "open", frage: id });
            }}
          />
        )}
      </section>
    </div>
  );
}
