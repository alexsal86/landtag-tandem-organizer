import { useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronRight, Mic } from "lucide-react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui-patterns";
import { useAuth } from "@/hooks/useAuth";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useCaseItems } from "@/features/cases/items/hooks/useCaseItems";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { berlinDateShort, berlinDaysSince, berlinWeekdayShortDate } from "@/utils/berlinDate";
import { debriefDuration, debriefReceivedAt, debriefSourceLabel, debriefSources, sortDebriefReports, type DebriefEvent, type DebriefReport, type DebriefSource } from "./officeDebriefInbox";
import { officeDebriefPromiseEdit, officeFeedbackPromiseMaxLength, suggestOfficeFeedbackPromises } from "./officeFeedbackPromises";
import { useOfficeDebriefInbox } from "./useOfficeDebriefInbox";

export const debriefButton = "rounded-xl bg-muted px-3 py-2 text-sm font-medium hover:bg-muted/70 disabled:opacity-50";
export const debriefPrimary = "rounded-xl bg-[#38761c] px-3 py-2 text-sm font-medium text-white hover:bg-[#2b5e15] disabled:opacity-50";
const amber = "bg-amber-100/70 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
const violet = "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200";

export function OfficeDebriefInboxCard() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { isEmployee } = useResolvedUserRole();
  if (!isEmployee || !currentTenant || !user) return null;
  return <DebriefInbox key={`${currentTenant.id}:${user.id}`} tenantId={currentTenant.id} userId={user.id} />;
}

function DebriefInbox({ tenantId, userId }: { tenantId: string; userId: string }) {
  const { query, update } = useOfficeDebriefInbox(false);
  const createCase = useDebriefCaseCreation(userId);
  const [openReport, setOpenReport] = useState<string | null>(null);
  const [openMissing, setOpenMissing] = useState<string | null>(null);
  const reports = sortDebriefReports(query.data?.reports ?? []);
  const missing = query.data?.missing ?? [];
  const promises = reports.filter(report => report.promise).length;

  return (
    <section aria-label="Nachbereitung eingegangen" className="min-w-0 rounded-dashboard-card border border-border/70 bg-card shadow-dashboard-card">
      <header className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-5">
        <h2 className="inline-flex items-center gap-2 text-card-title"><Mic aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />Nachbereitung eingegangen</h2>
        {query.data && <span className="text-sm text-muted-foreground">{reports.length} · {promises} mit Zusage</span>}
      </header>
      <div className="px-5 pb-5">
        {query.isPending ? <LoadingState variant="list" rows={2} /> : query.isError
          ? <ErrorState description="Die Nachbereitungen konnten nicht geladen werden." onRetry={() => void query.refetch()} />
          : <>
            {reports.length ? <p className="pb-2 text-sm text-muted-foreground">Sortiert: Zusagen ohne Frist zuerst, dann älteste</p>
              : <p className="text-sm text-muted-foreground">Keine offenen Nachbereitungen.</p>}
            {reports.map(report => <ReportRow key={report.id} report={report} open={openReport === report.id}
              toggle={() => setOpenReport(openReport === report.id ? null : report.id)}
              tenantId={tenantId} update={update} createCase={(text) => createCase(report, text)} />)}
            {missing.length > 0 && <div className="mt-5">
              <h3 className="mb-1.5 text-sm font-medium text-muted-foreground">Nachfrage nötig · {missing.length}</h3>
              {missing.map(event => <div key={event.id} className="border-b py-3 last:border-b-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1 basis-36">
                    <p className="font-medium">{event.title} <span className="font-normal text-muted-foreground">· {berlinWeekdayShortDate(event.starts_at)}</span></p>
                    <p className="text-sm text-muted-foreground">seit {berlinDaysSince(event.starts_at)} Tagen ohne Rückmeldung</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <button type="button" aria-expanded={openMissing === event.id} className="rounded-lg p-2 hover:bg-muted"
                      onClick={() => setOpenMissing(openMissing === event.id ? null : event.id)}>Selbst eintragen</button>
                    <button type="button" disabled={update.isPending} className="rounded-lg p-2 hover:bg-muted"
                      onClick={() => update.mutate({ _id: event.id, _external: event.is_external, _action: "skip" })}>Schließen</button>
                  </div>
                </div>
                {openMissing === event.id && <ProxyForm event={event} busy={update.isPending} cancel={() => setOpenMissing(null)}
                  save={(source, text, promise) => update.mutate({ _id: event.id, _external: event.is_external, _action: "proxy", _source: source, _text: text, _promise: promise },
                    { onSuccess: () => setOpenMissing(null) })} />}
              </div>)}
            </div>}
          </>}
      </div>
    </section>
  );
}

type DebriefUpdate = ReturnType<typeof useOfficeDebriefInbox>["update"];

function useDebriefCaseCreation(userId: string) {
  const { createCaseItem } = useCaseItems();
  return async (report: DebriefReport, text: string) => {
    const id = await createCaseItem({
      source_channel: "other", subject: text.slice(0, 120), summary: text, owner_user_id: userId,
      source_received_at: report.received_at, source_reference: `Termin-Nachbereitung ${report.id}`,
    });
    return !!id;
  };
}

export function OfficeDebriefActionDialog({ entry, tenantId, userId, update, close }: {
  entry: { report: DebriefReport } | { event: DebriefEvent };
  tenantId: string;
  userId: string;
  update: DebriefUpdate;
  close: () => void;
}) {
  const createCase = useDebriefCaseCreation(userId);
  const title = "report" in entry ? entry.report.title : entry.event.title;
  return (
    <Dialog open onOpenChange={open => { if (!open) close(); }}>
      <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{"report" in entry ? "Nachbereitung öffnen" : "Rückmeldung eintragen"}</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        {"report" in entry
          ? <ReportRow report={entry.report} open tenantId={tenantId} update={update}
              createCase={text => createCase(entry.report, text)} />
          : <ProxyForm event={entry.event} busy={update.isPending} cancel={close}
              save={(source, text, promise) => update.mutate({
                _id: entry.event.id, _external: entry.event.is_external,
                _action: "proxy", _source: source, _text: text, _promise: promise,
              }, { onSuccess: close })} />}
      </DialogContent>
    </Dialog>
  );
}

function ReportRow({ report, open, toggle, tenantId, update, createCase }: {
  report: DebriefReport; open: boolean; toggle?: () => void; tenantId: string; update: DebriefUpdate;
  createCase: (text: string) => Promise<boolean>;
}) {
  const detailsId = useId();
  const transcript = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState("");
  const [editingPromise, setEditingPromise] = useState(false);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [creatingCase, setCreatingCase] = useState(false);
  const unconfirmed = report.source && !report.confirmed_at;
  const missingDue = report.promise && !report.due_on;
  const mode = report.source ? `eingetragen von ${report.entered_by || "Büro"}`
    : report.spoken_seconds ? `gesprochen ${debriefDuration(report.spoken_seconds)}` : "geschrieben";

  const pick = () => {
    const selected = window.getSelection();
    const container = transcript.current;
    if (container && selected?.anchorNode && selected.focusNode
      && container.contains(selected.anchorNode) && container.contains(selected.focusNode)) {
      setSelection(selected.toString().trim());
    }
  };
  const due = report.due_on ?? "";
  return (
    <article className="border-t">
      {toggle && <button type="button" aria-expanded={open} aria-controls={open ? detailsId : undefined} onClick={toggle}
        className="flex w-full flex-wrap items-center gap-x-2 gap-y-1.5 py-3 text-left hover:bg-muted/30">
        <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", missingDue ? "bg-amber-700" : "bg-blue-600")} />
        <span className="min-w-0 flex-1 basis-36">
          <span className="block font-medium">{report.title}</span>
          <span className="block text-sm text-muted-foreground">{[report.received_at && debriefReceivedAt(report.received_at), mode].filter(Boolean).join(" · ")}</span>
        </span>
        {unconfirmed && <span className={cn("rounded-full px-2 py-0.5 text-xs", violet)}>unbestätigt</span>}
        {report.promise && <span className={cn("rounded-full px-2 py-0.5 text-xs", amber)}>{missingDue ? "Zusage · Frist fehlt" : "Zusage"}</span>}
        {open ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          : <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      </button>}
      {open && <div id={detailsId} className="space-y-3 pb-4 pl-5">
        <p className="text-sm text-muted-foreground">{[
          report.title, report.source ? mode : report.deputy_name && `von ${report.deputy_name}`,
          report.source && `Quelle: ${debriefSourceLabel(report.source, report.deputy_name)}`,
          unconfirmed ? "noch nicht bestätigt" : report.source ? "bestätigt" : null,
          report.spoken_seconds && `${debriefDuration(report.spoken_seconds)} · nur Text gespeichert`,
        ].filter(Boolean).join(" · ")}</p>
        {report.promise && !editingPromise && <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3", amber)}>
          <div className="flex min-w-0 flex-1 basis-36 items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="break-words"><strong>Zusage:</strong> {report.promise}</p>
          </div>
          <label className="rounded-lg border bg-card px-2 py-1 text-sm text-foreground">
            {due ? berlinDateShort(due) : "Frist wählen"}
            <input aria-label="Frist der Zusage" type="date" value={due} disabled={update.isPending}
              className="ml-1 max-w-28 bg-transparent" onChange={event => {
                if (event.target.value) update.mutate({ _id: report.id, _action: "due", _due: event.target.value });
              }} />
          </label>
        </div>}
        {editingPromise ? <PromiseEditor report={report} update={update} close={() => setEditingPromise(false)} />
          : <button type="button" className={debriefButton} disabled={update.isPending}
              onClick={() => setEditingPromise(true)}>{report.promise ? "Zusage bearbeiten" : "Zusage ergänzen"}</button>}
        <div ref={transcript} tabIndex={0} onPointerUp={pick} onKeyUp={pick}
          className="whitespace-pre-wrap break-words rounded-2xl bg-muted p-3 text-base leading-relaxed">
          <DebriefTranscript report={report} tenantId={tenantId} />
        </div>
        <p className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span className={cn("border-b-2 border-amber-700 px-1", amber)}>Stichwort</span>
          <span><span className="rounded bg-blue-100 px-1 text-blue-800">Name ✓</span> Kontakt gefunden</span>
          <span><span className="rounded bg-muted px-1">Name ?</span> neu anlegen</span>
        </p>
        <p className="text-sm text-muted-foreground">Text markieren, dann als Aufgabe oder Vorgang übernehmen.</p>
        {selection && <div className="flex flex-wrap gap-2">
          <button type="button" className={debriefButton} disabled={update.isPending || creatingCase}
            onClick={() => update.mutate({ _id: report.id, _action: "task", _text: selection }, { onSuccess: () => {
              setSelection(""); notify.success("Aufgabe angelegt.");
            } })}>Als Aufgabe übernehmen</button>
          <button type="button" className={debriefButton} disabled={update.isPending || creatingCase} onClick={async () => {
            setCreatingCase(true);
            try { if (await createCase(selection)) setSelection(""); }
            finally { setCreatingCase(false); }
          }}>Als Vorgang übernehmen</button>
          <button type="button" className={debriefButton} onClick={() => setSelection("")}>Auswahl löschen</button>
        </div>}
        {report.question && <p className="rounded-xl bg-muted p-3 text-sm"><strong>Offene Rückfrage:</strong> {report.question}</p>}
        {asking && !report.question && <form className="space-y-2" onSubmit={event => {
          event.preventDefault();
          if (!question.trim() || update.isPending) return;
          update.mutate({ _id: report.id, _action: "question", _text: question.trim() },
            { onSuccess: () => { setAsking(false); setQuestion(""); } });
        }}>
          <textarea aria-label="Rückfrage" placeholder="Was möchtest du klären?" value={question} onChange={event => setQuestion(event.target.value)}
            className="w-full rounded-xl border bg-background p-3" rows={2} maxLength={1000} required />
          <button type="submit" className={debriefPrimary} disabled={update.isPending || !question.trim()}>Rückfrage senden</button>
        </form>}
        <div className="flex flex-wrap gap-2 pt-1">
          {!report.question && <button type="button" className={debriefButton} aria-expanded={asking} onClick={() => setAsking(!asking)}>
            {asking ? "Abbrechen" : "Rückfrage an Abgeordneten"}</button>}
          <button type="button" className={debriefButton} disabled={update.isPending || editingPromise}
            onClick={() => update.mutate({ _id: report.id, _action: "done" })}>Erledigt</button>
        </div>
      </div>}
    </article>
  );
}

function PromiseEditor({ report, update, close }: { report: DebriefReport; update: DebriefUpdate; close: () => void }) {
  const [draft, setDraft] = useState(report.promise ?? suggestOfficeFeedbackPromises(report.notes));
  const [due, setDue] = useState(report.due_on ?? "");
  const [hasPromise, setHasPromise] = useState(true);

  return <form className="space-y-3 rounded-2xl bg-muted p-3" onSubmit={event => {
    event.preventDefault();
    if (update.isPending || (hasPromise && !draft.trim())) return;
    update.mutate({ _id: report.id, _action: "edit_promise", ...officeDebriefPromiseEdit(hasPromise, draft, due) },
      { onSuccess: close });
  }}>
    <fieldset disabled={update.isPending} className="space-y-2">
      <legend className="mb-2 text-sm font-medium">Wurde etwas zugesagt?</legend>
      <div className="flex gap-2">
        <button type="button" aria-pressed={hasPromise} className={hasPromise ? debriefPrimary : debriefButton}
          onClick={() => setHasPromise(true)}>Ja</button>
        <button type="button" aria-pressed={!hasPromise} className={!hasPromise ? debriefPrimary : debriefButton}
          onClick={() => setHasPromise(false)}>Nein</button>
      </div>
      {hasPromise && <>
        <textarea aria-label="Zusagen" placeholder="Zusagen hier eintragen" rows={3} required
          maxLength={officeFeedbackPromiseMaxLength} className="w-full rounded-xl border bg-background p-2"
          value={draft} onChange={event => setDraft(event.target.value)} />
        <label className="flex flex-wrap items-center gap-2 text-sm">
          Frist der Zusage
          <input type="date" value={due} onChange={event => setDue(event.target.value)}
            className="rounded-lg border bg-background p-2" />
        </label>
      </>}
    </fieldset>
    <div className="flex flex-wrap gap-2">
      <button type="submit" className={debriefPrimary} disabled={update.isPending || (hasPromise && !draft.trim())}>Speichern</button>
      <button type="button" className={debriefButton} disabled={update.isPending} onClick={close}>Abbrechen</button>
    </div>
  </form>;
}

function DebriefTranscript({ report, tenantId }: { report: DebriefReport; tenantId: string }) {
  const contacts = useQuery({
    queryKey: ["debrief-contacts", tenantId, report.appointment_id],
    enabled: !!report.appointment_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("appointment_contacts").select("contacts!inner(id,name,tenant_id)")
        .eq("appointment_id", report.appointment_id!).eq("contacts.tenant_id", tenantId).limit(50);
      if (error) throw error;
      return data.flatMap(row => row.contacts ? [row.contacts] : []);
    },
  });
  const linked = contacts.data ?? [];
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lastName = (name: string) => name.trim().split(/\s+/).at(-1) || name;
  const names = linked.flatMap(contact => [contact.name, lastName(contact.name)]).filter(name => name.length > 2).sort((a, b) => b.length - a.length);
  const alternatives = [...names.map(escape), "(?:Frau|Herr|Herrn)\\s+[\\p{Lu}][\\p{L}-]+"];
  const match = new RegExp(`(?<![\\p{L}])(${alternatives.join("|")})(?![\\p{L}])`, "gu");
  return report.notes.split(/(?<=[.!?])(?=\s|$)/).map((sentence, index) => (
    <span key={index} className={/\b(?:zugesagt|zusage|rückruf|frist|nachhaken|prüfen)\b/i.test(sentence) ? cn("border-b-2 border-amber-700", amber) : undefined}>
      {sentence.split(match).map((part, position) => {
        if (position % 2 === 0) return part;
        const matched = linked.filter(contact => contact.name === part || lastName(contact.name) === part
          || /^(?:Frau|Herr|Herrn)\s/.test(part) && lastName(contact.name) === lastName(part));
        return matched.length === 1
          ? <Link key={position} to={`/contacts/${matched[0].id}`} aria-label={`Kontakt ${part} öffnen`} className="rounded bg-blue-100 px-0.5 text-blue-800">{part}<span className="select-none" aria-hidden="true"> ✓</span></Link>
          : matched.length === 0
            ? <Link key={position} to="/contacts/new" aria-label={`Kontakt für ${part} anlegen`} className="rounded bg-muted px-0.5 text-muted-foreground">{part}<span className="select-none" aria-hidden="true"> ?</span></Link>
            : part;
      })}
    </span>
  ));
}

function ProxyForm({ event, busy, cancel, save }: {
  event: DebriefEvent; busy: boolean; cancel: () => void; save: (source: DebriefSource, text: string, promise?: string) => void;
}) {
  const [source, setSource] = useState<DebriefSource | null>(null);
  const [text, setText] = useState("");
  const [hasPromise, setHasPromise] = useState(false);
  const [promise, setPromise] = useState<string>();
  return <form className="mt-3 space-y-3 rounded-2xl bg-muted p-3" onSubmit={submission => {
    submission.preventDefault();
    if (source && text.trim() && (!hasPromise || promise?.trim()) && !busy) save(source, text.trim(), hasPromise ? promise?.trim() : undefined);
  }}>
    <fieldset>
      <legend className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Woher weißt du es?</legend>
      <div className="flex flex-wrap gap-1">{debriefSources.map(option => <button key={option} type="button"
        aria-pressed={source === option} className={cn(debriefButton, source === option && "rounded-full bg-slate-900 text-white hover:bg-slate-800")}
        onClick={() => setSource(option)}>{debriefSourceLabel(option, event.deputy_name)}</button>)}</div>
    </fieldset>
    <textarea aria-label="Was wurde besprochen?" placeholder="Was ist passiert, was wurde besprochen?" rows={3} required maxLength={12000}
      className="w-full rounded-xl border bg-background p-3" value={text} onChange={change => setText(change.target.value)} />
    <fieldset>
      <legend className="mb-1 font-medium">Wurde etwas zugesagt?</legend>
      <div className="flex gap-2">
        <button type="button" aria-pressed={!hasPromise} className={!hasPromise ? debriefPrimary : debriefButton} onClick={() => setHasPromise(false)}>Nein</button>
        <button type="button" aria-pressed={hasPromise} className={hasPromise ? debriefPrimary : debriefButton} onClick={() => { setHasPromise(true); setPromise(previous => previous ?? suggestOfficeFeedbackPromises(text)); }}>Ja</button>
      </div>
      {hasPromise && <textarea aria-label="Zusage" placeholder="Was? z. B. Besuch im Landtag" rows={2} value={promise ?? ""} onChange={change => setPromise(change.target.value)}
        required maxLength={officeFeedbackPromiseMaxLength} className="mt-2 w-full rounded-xl border bg-background p-2" />}
    </fieldset>
    <p className="text-sm text-muted-foreground">Der Abgeordnete sieht, wer die Rückmeldung eingetragen hat, und kann sie bestätigen oder korrigieren.</p>
    <div className="flex flex-wrap gap-2">
      <button type="submit" className={debriefPrimary} disabled={busy || !source || !text.trim() || (hasPromise && !promise?.trim())}>Eintragen</button>
      <button type="button" className={debriefButton} onClick={cancel}>Abbrechen</button>
    </div>
  </form>;
}
