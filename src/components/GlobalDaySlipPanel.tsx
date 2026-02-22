import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ClipboardList,
  Folder,
  FolderArchive,
  ListTodo,
  NotebookPen,
  Scale,
  X,
} from "lucide-react";

type EntryStatus = "open" | "done" | "note" | "task" | "decision" | "archived";

interface DaySlipEntry {
  id: string;
  text: string;
  createdAt: string;
  status: EntryStatus;
}

type DaySlipStore = Record<string, DaySlipEntry[]>;

const STORAGE_KEY = "day-slip-v1";

const toDayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDate = (dayKey: string) => {
  const date = new Date(`${dayKey}T12:00:00`);
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const statusLabel: Record<Exclude<EntryStatus, "open" | "done">, string> = {
  note: "Notiz",
  task: "Aufgabe",
  decision: "Entscheidung",
  archived: "Archiv",
};

export function GlobalDaySlipPanel() {
  const [open, setOpen] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [input, setInput] = useState("");
  const [store, setStore] = useState<DaySlipStore>({});
  const [resolveMode, setResolveMode] = useState(false);

  const todayKey = toDayKey(new Date());

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      setStore(JSON.parse(raw) as DaySlipStore);
    } catch {
      setStore({});
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const todayEntries = store[todayKey] ?? [];

  const yesterdayOpen = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const key = toDayKey(yesterday);
    return (store[key] ?? []).filter((entry) => entry.status === "open");
  }, [store]);

  const openEntries = todayEntries.filter((entry) => entry.status === "open");
  const doneEntries = todayEntries.filter((entry) => entry.status === "done");

  const archiveDays = useMemo(
    () => Object.keys(store).filter((key) => key !== todayKey).sort((a, b) => b.localeCompare(a)),
    [store, todayKey],
  );

  const addEntry = () => {
    const text = input.trim();
    if (!text) return;

    const newEntry: DaySlipEntry = {
      id: crypto.randomUUID(),
      text,
      createdAt: new Date().toISOString(),
      status: "open",
    };

    setStore((prev) => ({
      ...prev,
      [todayKey]: [...(prev[todayKey] ?? []), newEntry],
    }));
    setInput("");
  };

  const toggleDone = (id: string) => {
    setStore((prev) => ({
      ...prev,
      [todayKey]: (prev[todayKey] ?? []).map((entry) =>
        entry.id === id
          ? { ...entry, status: entry.status === "done" ? "open" : "done" }
          : entry,
      ),
    }));
  };

  const resolveEntry = (id: string, status: Exclude<EntryStatus, "open" | "done">) => {
    setStore((prev) => ({
      ...prev,
      [todayKey]: (prev[todayKey] ?? []).map((entry) => (entry.id === id ? { ...entry, status } : entry)),
    }));
  };

  const completeDay = () => {
    setStore((prev) => ({
      ...prev,
      [todayKey]: (prev[todayKey] ?? []).map((entry) => (entry.status === "done" ? { ...entry, status: "archived" } : entry)),
    }));

    if (openEntries.length > 0) {
      setResolveMode(true);
      return;
    }

    setResolveMode(false);
    setOpen(false);
  };

  const handleClose = () => {
    if (openEntries.length > 0) {
      setResolveMode(true);
      return;
    }

    setResolveMode(false);
    setOpen(false);
  };

  const unresolvedCount = openEntries.length;

  return (
    <>
      {open && (
        <aside className="fixed bottom-24 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div>
              <p className="flex items-center gap-2 text-lg font-semibold">
                <ClipboardList className="h-4 w-4" /> Tageszettel
              </p>
              <p className="text-xs text-muted-foreground">{formatDate(todayKey)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setShowArchive((prev) => !prev)}
                aria-label="Archiv anzeigen"
              >
                <Folder className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={handleClose}
                aria-label="Panel schließen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {showArchive ? (
            <div className="max-h-[420px] space-y-3 overflow-y-auto p-4">
              <p className="text-sm font-medium">Archiv (nur lesen)</p>
              {archiveDays.length === 0 && <p className="text-sm text-muted-foreground">Noch keine vergangenen Tage.</p>}
              {archiveDays.map((day) => (
                <div key={day} className="rounded-lg border border-border/60 p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{formatDate(day)}</p>
                  <ul className="space-y-1 text-sm">
                    {(store[day] ?? []).map((entry) => (
                      <li key={entry.id} className="flex items-center justify-between gap-2">
                        <span className="line-clamp-1">{entry.text}</span>
                        <span className="text-xs text-muted-foreground">{entry.status === "open" || entry.status === "done" ? entry.status : statusLabel[entry.status]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <>
              {yesterdayOpen.length > 0 && (
                <div className="border-b border-amber-400/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
                  <span className="font-semibold">Gestern noch offen:</span> "{yesterdayOpen[0].text}"
                  {yesterdayOpen.length > 1 ? ` +${yesterdayOpen.length - 1}` : ""}
                </div>
              )}

              <ul className="max-h-[280px] space-y-1 overflow-y-auto px-4 py-3">
                {todayEntries.length === 0 && (
                  <li className="py-5 text-sm italic text-muted-foreground">Was steht heute an? Einfach drauflosschreiben …</li>
                )}
                {todayEntries.map((entry) => {
                  const done = entry.status === "done";

                  return (
                    <li key={entry.id} className="group flex items-start gap-2 rounded px-2 py-1 hover:bg-muted/40">
                      <button
                        type="button"
                        onClick={() => toggleDone(entry.id)}
                        className="mt-1 h-2.5 w-2.5 rounded-full border border-muted-foreground/60"
                        aria-label="Eintrag erledigt markieren"
                      />
                      <span
                        title={`Erfasst um ${formatTime(entry.createdAt)}`}
                        className={`flex-1 text-sm ${done ? "text-muted-foreground line-through" : "text-foreground"}`}
                      >
                        {entry.text}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div className="border-t border-border/60 p-3">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addEntry();
                    }
                  }}
                  placeholder="+ noch etwas hinzufügen …"
                  className="h-10 w-full rounded-lg border border-emerald-400/50 bg-transparent px-3 text-sm outline-none ring-0 placeholder:text-muted-foreground focus:border-emerald-400"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{unresolvedCount} offen • {doneEntries.length} erledigt</span>
                  <span>Ctrl/⌘ + Alt + K</span>
                </div>
              </div>

              {resolveMode && unresolvedCount > 0 && (
                <div className="border-y border-border/60 bg-muted/30 px-4 py-3">
                  <p className="mb-2 text-sm font-medium">{unresolvedCount} Einträge noch offen – was soll damit passieren?</p>
                  <div className="space-y-2">
                    {openEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 text-sm">
                        <span className="line-clamp-1">{entry.text}</span>
                        <div className="flex items-center gap-1">
                          <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => resolveEntry(entry.id, "note")} aria-label="Als Notiz übernehmen">
                            <NotebookPen className="h-4 w-4" />
                          </button>
                          <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => resolveEntry(entry.id, "task")} aria-label="Als Aufgabe übernehmen">
                            <ListTodo className="h-4 w-4" />
                          </button>
                          <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => resolveEntry(entry.id, "decision")} aria-label="Als Entscheidung übernehmen">
                            <Scale className="h-4 w-4" />
                          </button>
                          <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => resolveEntry(entry.id, "archived")} aria-label="Archivieren">
                            <FolderArchive className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3">
                <button
                  type="button"
                  onClick={completeDay}
                  className="flex h-10 w-full items-center justify-between rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 text-sm font-medium text-emerald-200"
                >
                  <span>🏁 Tag abschließen</span>
                  <span>{unresolvedCount} offen →</span>
                </button>
              </div>
            </>
          )}
        </aside>
      )}

      <button
        type="button"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-background/90 shadow-lg backdrop-blur hover:bg-muted"
        aria-label="Tageszettel öffnen"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Archive className="h-5 w-5" />
      </button>
    </>
  );
}
