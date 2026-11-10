import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionPermission } from "@/hooks/useActionPermission";
import {
  useKnowledgeCounts,
  useKnowledgePeople,
  useKnowledgeQuestions,
  useKnowledgeScope,
} from "../hooks/useKnowledgeQuestions";
import { knowledgeUrlState } from "../logic";
import type { KnowledgeView } from "../types";
import { AskQuestionDialog } from "./AskQuestionDialog";
import { KnowledgeQuestionCard } from "./KnowledgeQuestionCard";

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
  const [search, setSearch] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const questionId = params.get("frage");
  const { view, filters } = knowledgeUrlState(params);
  const list = useKnowledgeQuestions(search, view, questionId, filters);
  const counts = useKnowledgeCounts();
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
    updateParam("ansicht", next);
  };
  return (
    <div className="h-full overflow-auto">
      <section
        className="mx-auto max-w-4xl space-y-6 p-4 pb-12 sm:p-8"
        aria-label="Wissen"
      >
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Wissen</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Fragen stellen. Wissen miteinander teilen.
            </p>
          </div>
          {canWrite && (
            <Button onClick={() => setAsking("")}>
              <Plus className="mr-2 h-4 w-4" />
              Frage stellen
            </Button>
          )}
        </header>
        <div className="relative">
          <Search className="absolute left-4 top-4 h-5 w-5 text-muted-foreground" />
          <Input
            className="h-14 pl-12 pr-12 text-base"
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
              className="absolute right-4 top-4 h-5 w-5 animate-spin text-muted-foreground"
            />
          )}
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Wissensansichten">
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
              className={
                view === key && !questionId
                  ? "bg-primary/10 text-primary hover:bg-primary/15"
                  : undefined
              }
              aria-current={view === key && !questionId ? "page" : undefined}
              onClick={() => navigateView(key as KnowledgeView)}
            >
              {label}{" "}
              <span className="ml-2 text-xs">
                {counts.data?.[key as KnowledgeView] ?? "–"}
              </span>
            </Button>
          ))}
        </nav>
        {!questionId && (
          <div className="flex flex-wrap gap-3" aria-label="Wissen filtern">
            <label className="text-sm">
              Status{" "}
              <select
                className="rounded border bg-background p-2"
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
            <label className="text-sm">
              Zuständig{" "}
              <select
                className="rounded border bg-background p-2"
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
            <label className="text-sm">
              Sortierung{" "}
              <select
                className="rounded border bg-background p-2"
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
        )}
        {counts.isError && (
          <p role="alert" className="text-sm">
            Zähler konnten nicht geladen werden.
          </p>
        )}
        {questionId && (
          <Button variant="ghost" onClick={() => navigateView(view)}>
            ← Zur Übersicht
          </Button>
        )}
        {profileError && (
          <p role="alert" className="text-sm text-muted-foreground">
            Mitarbeiternamen konnten nicht geladen werden.
          </p>
        )}
        {list.isError ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 p-5"
          >
            <p>Wissen konnte nicht geladen werden.</p>
            <Button
              className="mt-3"
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
          <div className="space-y-4">
            {list.data.map((question) => (
              <KnowledgeQuestionCard
                key={question.id}
                question={question}
                detail={Boolean(questionId)}
                query={search}
                profiles={profiles}
                assignable={assignable}
                canWrite={canWrite}
                canVerify={canVerify}
                canManage={canManage}
                onOpen={() => setParams({ frage: question.id, ansicht: view })}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center">
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
            {!questionId && canWrite && (
              <Button className="mt-4" onClick={() => setAsking(search)}>
                {search ? "Diese Frage stellen" : "Frage stellen"}
              </Button>
            )}
          </div>
        )}
        <p className="text-sm text-muted-foreground" role="status">
          {list.totalCount} Einträge
        </p>
        {!questionId && list.hasNextPage && (
          <div className="text-center">
            <Button
              variant="outline"
              disabled={list.isFetching}
              onClick={() => void list.fetchNextPage()}
            >
              Mehr laden (
              {Math.max(0, list.totalCount - (list.data?.length ?? 0))} weitere)
            </Button>
          </div>
        )}
        <footer className="border-t pt-4">
          <a
            className="text-sm text-muted-foreground hover:underline"
            href="/dossiers"
          >
            Bisheriger Wissensbereich
          </a>
        </footer>
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
