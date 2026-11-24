import { useState } from "react";
import { debriefSourceLabel, type DebriefReport } from "./officeDebriefInbox";
import { useOfficeDebriefInbox } from "./useOfficeDebriefInbox";
import { debriefButton, debriefPrimary } from "./OfficeDebriefInboxCard";

export function DeputyDebriefReview({ reviews, tenantScope }: {
  reviews: ReturnType<typeof useOfficeDebriefInbox>;
  tenantScope: string;
}) {
  const { query, update } = reviews;
  if (query.isError) return <p role="alert" className="mb-3 text-sm text-destructive">Büroeinträge und Rückfragen konnten nicht geladen werden.</p>;
  return query.data?.reports.map(report => <Review key={`${tenantScope}:${report.id}`} report={report} update={update} />);
}

function Review({ report, update }: {
  report: DebriefReport;
  update: ReturnType<typeof useOfficeDebriefInbox>["update"];
}) {
  const [editing, setEditing] = useState<"correct" | "answer" | null>(null);
  const [text, setText] = useState("");
  const [promise, setPromise] = useState(report.promise ?? "");
  const confirmationNeeded = report.source && !report.confirmed_at;
  return <article className="mb-4 space-y-3 rounded-2xl bg-violet-100/80 p-4 dark:bg-violet-950">
    {confirmationNeeded && <>
      <div>
        <p className="font-medium">{report.entered_by || "Dein Büro"} hat für dich eingetragen: {report.title}</p>
        <p className="text-sm text-muted-foreground">Quelle: {debriefSourceLabel(report.source!, report.deputy_name)}{report.promise && ` · Zusage: ${report.promise}`}</p>
      </div>
      {editing !== "correct" && <p className="whitespace-pre-wrap break-words">„{report.notes}“</p>}
      {!editing && <div className="flex flex-wrap gap-2">
        <button type="button" className={debriefPrimary} disabled={update.isPending}
          onClick={() => update.mutate({ _id: report.id, _action: "confirm" })}>Passt so</button>
        <button type="button" className={debriefButton}
          onClick={() => { setText(report.notes); setPromise(report.promise ?? ""); setEditing("correct"); }}>Korrigieren</button>
      </div>}
    </>}
    {report.question && <>
      <div>
        <p className="font-medium">Rückfrage aus dem Büro · {report.title}</p>
        <p className="whitespace-pre-wrap break-words">{report.question}</p>
      </div>
      {!editing && <button type="button" className={debriefButton} onClick={() => { setText(""); setEditing("answer"); }}>Antworten</button>}
    </>}
    {editing && <form className="space-y-2" onSubmit={event => {
      event.preventDefault();
      if (!text.trim() || update.isPending) return;
      update.mutate({ _id: report.id, _action: editing, _text: text.trim(), _promise: editing === "correct" ? promise.trim() : undefined },
        { onSuccess: () => setEditing(null) });
    }}>
      <textarea aria-label={editing === "correct" ? "Korrigierte Rückmeldung" : "Antwort"} value={text}
        onChange={event => setText(event.target.value)} rows={3} maxLength={12000} required className="w-full rounded-xl border bg-background p-3" />
      {editing === "correct" && <input aria-label="Zusage" placeholder="Zusage, falls vereinbart" value={promise}
        onChange={event => setPromise(event.target.value)} maxLength={1000} className="w-full rounded-xl border bg-background p-2" />}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={debriefPrimary} disabled={update.isPending || !text.trim()}>
          {editing === "correct" ? "Korrektur ans Büro" : "Antwort ans Büro"}</button>
        <button type="button" className={debriefButton} onClick={() => setEditing(null)}>Abbrechen</button>
      </div>
    </form>}
  </article>;
}
