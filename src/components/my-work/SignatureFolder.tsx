import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Mic, MicOff } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { ErrorState, LoadingState } from "@/components/ui-patterns";
import { TaskDecisionResponse } from "@/components/task-decisions/TaskDecisionResponse";
import { useAuth } from "@/hooks/useAuth";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { useTenant } from "@/hooks/useTenant";
import { notify } from "@/lib/notify";
import { WebSpeechToTextAdapter } from "@/lib/speechToTextAdapter";
import { cn } from "@/lib/utils";
import { STALE_TIME } from "@/lib/query-cache";
import { decideFolderEntry, folderDate, folderTypes, loadSignatureFolder, type FolderEntry, type FolderType } from "./signatureFolderData";

const pill = "min-h-10 rounded-full px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2";
const compactPill = "inline-flex h-7 items-center rounded-full px-3 text-meta font-medium focus-visible:outline-2 focus-visible:outline-offset-2";
const green = "bg-[#38761c] text-white hover:bg-[#2b5e15] disabled:opacity-50";
const muted = "bg-muted text-foreground hover:bg-muted/75";
const entryKey = (entry: FolderEntry) => `${entry.type}:${entry.id}:${entry.version ?? ""}`;

export function SignatureFolder() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { isAbgeordneter } = useResolvedUserRole();
  if (!currentTenant?.id || !user?.id || !isAbgeordneter) return null;
  return <SignatureFolderContent key={`${currentTenant.id}:${user.id}`} tenantId={currentTenant.id} userId={user.id} />;
}

function SignatureFolderContent({ tenantId, userId }: { tenantId: string; userId: string }) {
  const qc = useQueryClient();
  const listId = useId();
  const header = useRef<HTMLButtonElement>(null);
  const queryKey = ["signature-folder", tenantId, userId];
  // Buchstaben, Presse und Social sind nicht in der Realtime-Publication, hier greift also keine
  // Subscription. Deshalb weiterhin ein Hintergrund-Intervall, aber im Rhythmus der Büroarbeit
  // statt alle 30 s: es pausiert bei verdecktem Tab, und die Rückkehr in den Tab lädt zusätzlich
  // frisch. Eigene Entscheidungen invalidieren den Key ohnehin sofort.
  const query = useQuery({
    queryKey,
    queryFn: () => loadSignatureFolder(tenantId, userId),
    staleTime: STALE_TIME.LIST_WITH_REALTIME,
    refetchInterval: STALE_TIME.LIST_WITH_REALTIME,
    refetchOnWindowFocus: true,
  });
  const [visible, setVisible] = useState(true);
  const [filter, setFilter] = useState<FolderType | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [read, setRead] = useState<Set<string>>(() => new Set());
  const entries = query.data ?? [];
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey }),
      qc.invalidateQueries({ queryKey: ["jour-fixe-platform", tenantId] }),
      qc.invalidateQueries({ queryKey: ["deputy-dashboard-decisions", tenantId] }),
      qc.invalidateQueries({ queryKey: ["my-work-decisions", userId] }),
    ]);
  };
  const filtered = filter === "all" ? entries : entries.filter(entry => entry.type === filter);
  return (
    <Card className="min-w-0 gap-0 rounded-dashboard-card shadow-dashboard-card">
      <CardHeader className="px-4 pb-3 pt-5 sm:px-5">
        <h3 className="text-card-title">
          <button type="button" ref={header} className="flex w-full items-center gap-2 text-left" aria-expanded={visible}
            aria-controls={listId} onClick={() => { setVisible(!visible); setExpanded(null); }}>
            <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            Unterschriftenmappe
            {query.data && <span className="ml-auto text-sm font-normal text-muted-foreground">{entries.length}</span>}
          </button>
        </h3>
      </CardHeader>
      <CardContent id={listId} hidden={!visible} className="px-4 pb-4 pt-3 sm:px-5">
        {query.isPending ? <LoadingState variant="list" rows={3} /> :
          query.isError ? <ErrorState description="Die Unterschriftenmappe konnte nicht geladen werden." onRetry={() => void query.refetch()} /> :
          <>
            <div role="group" aria-label="Vorgänge filtern" className="flex flex-wrap gap-1.5 pb-2">
              {[{ id: "all", filter: "Alle" } as const, ...folderTypes].map(category => (
                <button key={category.id} type="button" aria-pressed={filter === category.id}
                  className={cn(compactPill, filter === category.id ? "bg-[#17212b] text-white" : muted)}
                  onClick={() => { setFilter(category.id); setExpanded(null); }}>
                  {category.filter} {category.id === "all" ? entries.length : entries.filter(entry => entry.type === category.id).length}
                </button>
              ))}
            </div>
            {filtered.length === 0 && <p className="border-t py-4 text-sm text-muted-foreground">Keine offenen Vorgänge in dieser Ansicht.</p>}
            {filtered.map(entry => {
              const key = entryKey(entry);
              return <FolderRow key={key} entry={entry} open={expanded === key} read={read.has(key)}
                toggle={() => {
                  setExpanded(expanded === key ? null : key);
                  if (!read.has(key)) setRead(previous => new Set([...previous, key]));
                }} decide={note => decideFolderEntry(entry, tenantId, userId, note)}
                onDone={() => {
                  setExpanded(null);
                  qc.setQueryData<FolderEntry[]>(queryKey, previous => previous?.filter(item => entryKey(item) !== key));
                  header.current?.focus();
                  void refresh();
                }} />;
            })}
          </>}
        <button type="button" className="mt-3 rounded-md px-1 py-2 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => { setVisible(false); setExpanded(null); header.current?.focus(); }}>
          Einklappen
        </button>
      </CardContent>
    </Card>
  );
}

function FolderRow({ entry, open, read, toggle, decide, onDone }: {
  entry: FolderEntry;
  open: boolean;
  read: boolean;
  toggle: () => void;
  decide: (note?: string) => Promise<void>;
  onDone: () => void;
}) {
  const panelId = useId();
  const category = folderTypes.find(type => type.id === entry.type);
  const metadata = [entry.author && `von ${entry.author}`, entry.metadata, entry.date && folderDate(entry.date)].filter(Boolean).join(" · ");
  return (
    <article className="border-t py-3">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 sm:flex-nowrap">
        <span className={cn("shrink-0 rounded-full px-2 py-1 text-xs font-medium", category?.color)}>{category?.label}</span>
        <div className="min-w-0 grow basis-36">
          <h4 className="break-words text-sm font-semibold leading-snug">{entry.title}</h4>
          {metadata && <p className="mt-0.5 text-xs text-muted-foreground">{metadata}</p>}
          {entry.reminder && <p className="mt-1.5 inline-block rounded-xl bg-amber-50 px-2.5 py-1 text-sm text-amber-900">🔔 {entry.reminder}</p>}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {read && <span className="text-xs font-medium text-[#38761c] dark:text-green-300">✓ gelesen</span>}
          <button type="button" aria-expanded={open} aria-controls={open ? panelId : undefined}
            aria-label={`${open ? "Zuklappen" : "Ansehen"} – ${entry.title}`}
            className={cn(compactPill, open || read ? muted : green)} onClick={toggle}>
            {open ? "Zuklappen" : "Ansehen"}
          </button>
        </div>
      </div>
      {open && <div id={panelId} className="mt-3 space-y-3">
        <div className={cn("rounded-xl bg-card p-4 shadow-md sm:p-5", entry.type === "social" && "flex flex-wrap items-start gap-3")}>
          {entry.type === "social" && (entry.image
            ? <img src={entry.image} alt="Beitragsbild" className="aspect-square w-20 rounded-lg object-cover sm:w-24" />
            : <div aria-hidden="true" className="aspect-square w-20 rounded-lg bg-linear-to-br from-[#58a124] to-[#387fea] sm:w-24" />)}
          <div className="min-w-0 flex-1 basis-40 space-y-2">
            {entry.type === "press" && <h5 className="text-base font-semibold">{entry.title}</h5>}
            <RichTextDisplay content={entry.content} className={cn("break-words text-base leading-relaxed text-foreground", entry.type === "press" && "font-serif")} />
            {entry.hashtags?.length ? <p className="break-words text-sm text-muted-foreground">{entry.hashtags.map(tag => tag.startsWith("#") ? tag : `#${tag}`).join(" ")}</p> : null}
            {entry.results?.map((result, i) => <div key={i}>
              <h5 className="text-sm font-semibold">{result.title}</h5>
              <RichTextDisplay content={result.content} />
            </div>)}
            {entry.path && <Link to={entry.path} className="inline-block text-sm text-muted-foreground underline underline-offset-2">
              {entry.type === "protocol" ? "Protokoll öffnen" : entry.type === "letter" ? "Brief öffnen" : "In der Redaktion öffnen"}
            </Link>}
          </div>
        </div>
        {entry.type === "letter" ? entry.decisionId && entry.participantId && (
          <TaskDecisionResponse decisionId={entry.decisionId} participantId={entry.participantId} creatorId={entry.creatorId}
            onResponseSubmitted={onDone} renderActions={(submit, busy) => (
              <FolderActions disabled={busy} submit={note => submit(note ? "reject" : "approve", note)} />
            )} />
        ) : <FolderActions canRequestChanges={entry.type !== "protocol"} submit={async note => {
          await decide(note);
          notify.success(note ? "Änderungswunsch ans Büro gesendet" : "Vorgang freigegeben");
          onDone();
        }} />}
      </div>}
    </article>
  );
}

function FolderActions({ submit, disabled = false, canRequestChanges = true }: {
  submit: (note?: string) => Promise<void>;
  disabled?: boolean;
  canRequestChanges?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speech] = useState(() => new WebSpeechToTextAdapter());
  const inFlight = useRef(false);
  useEffect(() => {
    speech.onFinalTranscript = text => setNote(previous => [previous.trimEnd(), text].filter(Boolean).join(" "));
    speech.onStateChange = state => setRecording(state === "listening" || state === "stopping");
    speech.onError = error => notify.error(error.message);
    return () => {
      speech.onStateChange = undefined;
      speech.destroy();
    };
  }, [speech]);
  const send = async (message?: string) => {
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try { await submit(message); }
    catch { notify.error("Aktion fehlgeschlagen. Bitte lade den Vorgang neu und versuche es erneut."); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return editing ? (
    <form onSubmit={event => { event.preventDefault(); if (note.trim() && !recording) void send(note.trim()); }}>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-muted/60 p-2">
        <textarea autoFocus rows={1} aria-label="Änderungswunsch" placeholder="Was soll geändert werden?"
          className="min-w-0 flex-1 basis-36 resize-y rounded-lg bg-transparent px-2 py-2 text-sm"
          value={note} onChange={event => setNote(event.target.value)} disabled={busy || disabled} />
        <button type="button" aria-label={recording ? "Diktat beenden" : "Änderungswunsch diktieren"}
          aria-pressed={recording} title={speech.supported ? undefined : "Diktat wird von diesem Browser nicht unterstützt"}
          disabled={!speech.supported || busy || disabled}
          className="ml-auto grid size-10 place-items-center rounded-full bg-[#e7f3df] text-[#326a1c] disabled:opacity-50"
          onClick={() => { if (recording) void speech.stop(); else speech.start(); }}>
          {recording ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </button>
        <button type="submit" disabled={!note.trim() || recording || busy || disabled} className={cn(pill, green)}>Ans Büro</button>
      </div>
      <button type="button" disabled={busy || disabled} className="mt-2 px-1 py-1 text-sm text-muted-foreground"
        onClick={() => { speech.destroy(); setEditing(false); setNote(""); }}>Abbrechen</button>
    </form>
  ) : (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={cn(pill, green, "rounded-xl")} disabled={busy || disabled} onClick={() => void send()}>Freigeben</button>
      {canRequestChanges && <button type="button" className={cn(pill, muted, "rounded-xl")} disabled={busy || disabled}
        onClick={() => setEditing(true)}>Änderung wünschen</button>}
    </div>
  );
}
