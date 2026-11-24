import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlarmClock, Mic, Square } from "lucide-react";
import { useAppointmentFeedback, type AppointmentWithFeedback } from "@/hooks/useAppointmentFeedback";
import { useUserPreference } from "@/hooks/useUserPreference";
import { useAuth } from "@/hooks/useAuth";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { DeputyDebriefReview } from "./DeputyDebriefReview";
import { useOfficeDebriefInbox } from "./useOfficeDebriefInbox";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { WebSpeechToTextAdapter, type SpeechToTextState } from "@/lib/speechToTextAdapter";
import { notify } from "@/lib/notify";
import { isOfficeReminderDue, isOlderOfficeFeedback, needsOfficeFeedback, officeReminderLabel, officeReminderTime, readOfficeSnooze, showsOfficeTaskHint, type OfficeSnooze, type ReminderChoice } from "./officeFeedback";

const green = "bg-[#55ad21] text-white hover:bg-[#4c9c1e]";
const eventKey = (event: AppointmentWithFeedback) => event.event_type + ":" + event.id;
const clock = (value: string) => new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit",
}).format(new Date(value));

export function OfficeFeedbackCard() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  // Changing scope remounts the form and stops an active dictation.
  return <OfficeFeedbackForm key={`${currentTenant?.id}:${user?.id}`} />;
}

function OfficeFeedbackForm() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const feedback = useAppointmentFeedback();
  const { isAbgeordneter } = useResolvedUserRole();
  const reviews = useOfficeDebriefInbox(true, isAbgeordneter);
  const [promises, setPromises] = useState<Record<string, string>>({});
  const spokenSeconds = useRef<Record<string, number>>({});
  const recordingStarted = useRef<number | null>(null);
  const dictated = useRef(false);
  const qc = useQueryClient();
  const [snoozes, setSnoozes] = useUserPreference<Record<string, string | OfficeSnooze>>(
    `office-feedback-snoozes:${currentTenant?.id}:${user?.id}`, {},
  );
  const [now, setNow] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const [mode, setMode] = useState<"write" | "review" | "remind">("write");
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState<"sent" | "empty" | null>(null);
  const [speechState, setSpeechState] = useState<SpeechToTextState>("idle");
  const [interim, setInterim] = useState("");
  const speech = useMemo(() => new WebSpeechToTextAdapter(), []);
  const speechTarget = useRef<string | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
      void feedback.refetch();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [feedback.refetch]);
  useEffect(() => {
    speech.onStateChange = state => {
      setSpeechState(state);
      const key = speechTarget.current;
      if (state === "idle" && recordingStarted.current !== null) {
        if (key && dictated.current) spokenSeconds.current[key] = (spokenSeconds.current[key] ?? 0)
          + Math.max(1, Math.round((Date.now() - recordingStarted.current) / 1000));
        recordingStarted.current = null;
        dictated.current = false;
      }
    };
    speech.onInterimTranscript = setInterim;
    speech.onFinalTranscript = text => {
      const key = speechTarget.current;
      if (key) {
        dictated.current = true;
        const next = { ...draftsRef.current, [key]: [draftsRef.current[key], text].filter(Boolean).join(" ") };
        draftsRef.current = next;
        setDrafts(next);
      }
      setInterim("");
    };
    speech.onError = error => notify.error(error.message);
    return () => {
      speech.onStateChange = undefined;
      speech.destroy();
    };
  }, [speech]);

  const pending = feedback.appointments.filter(event => needsOfficeFeedback(event.feedback)
    && !(feedback.settings?.auto_skip_internal && event.category === "intern"));
  const isDeferred = (event: AppointmentWithFeedback) =>
    Date.parse(readOfficeSnooze(snoozes[eventKey(event)])?.until ?? "") > now.getTime();
  const visible = pending.filter(event => !isDeferred(event));
  const due = pending.filter(event => isOfficeReminderDue(snoozes[eventKey(event)], now))
    .sort((a, b) => Date.parse(readOfficeSnooze(snoozes[eventKey(a)])!.until)
      - Date.parse(readOfficeSnooze(snoozes[eventKey(b)])!.until));
  const current = pending.find(event => eventKey(event) === selected) ?? due[0] ?? visible[0];
  const key = current ? eventKey(current) : "";
  const text = drafts[key] ?? "";
  const deferred = pending.filter(event => isDeferred(event) && eventKey(event) !== key);
  const others = visible.filter(event => eventKey(event) !== key);
  const older = others.filter(event => isOlderOfficeFeedback(event.start_time, now));
  const shown = expanded ? others : others.slice(0, 2);
  const recording = speechState === "listening" || speechState === "stopping";
  const nextDueKey = due[0] ? eventKey(due[0]) : null;
  const nextDueUntil = nextDueKey ? readOfficeSnooze(snoozes[nextDueKey])?.until : undefined;
  const openedReminder = useRef<string | null>(null);
  const [acknowledgedReminder, setAcknowledgedReminder] = useState<string | null>(null);
  const reminderToken = nextDueKey && nextDueUntil ? nextDueKey + ":" + nextDueUntil : null;

  useEffect(() => {
    if (!reminderToken || reminderToken === openedReminder.current || recording || busy || mode !== "write") return;
    if (draftsRef.current[key]?.trim()) return;
    openedReminder.current = reminderToken;
    setAcknowledgedReminder(reminderToken);
    setSelected(nextDueKey);
    setMode("write");
  }, [reminderToken, nextDueKey, recording, busy, mode, key, text]);

  // Wake at the reminder time even if the periodic data refresh is later.
  useEffect(() => {
    const future = Object.values(snoozes).map(value => Date.parse(readOfficeSnooze(value)?.until ?? ""))
      .filter(timestamp => timestamp > now.getTime());
    if (!future.length) return;
    const timer = window.setTimeout(() => setNow(new Date()),
      Math.min(Math.max(0, Math.min(...future) - Date.now()), 2147483647));
    return () => window.clearTimeout(timer);
  }, [snoozes, now]);

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["appointment-feedback-appointments"] }),
      qc.invalidateQueries({ queryKey: ["appointment-feedback-external"] }),
      qc.invalidateQueries({ queryKey: ["pending-debriefs"] }),
      qc.invalidateQueries({ queryKey: ["office-debriefs", currentTenant?.id] }),
    ]);
  };

  const persist = async (event: AppointmentWithFeedback, status: "completed" | "skipped", notes?: string) => {
    if (!user || !currentTenant) throw new Error("Bitte anmelden und ein Büro wählen.");
    if (isAbgeordneter) {
      const key = eventKey(event);
      const result = await supabase.rpc("update_office_debrief", {
        _tenant: currentTenant.id, _action: status === "completed" ? "submit" : "skip", _id: event.id, _external: event.event_type === "external_event",
        _text: notes, _promise: notes ? promises[key]?.trim() || undefined : undefined, _seconds: notes ? spokenSeconds.current[key] : undefined,
      });
      if (result.error) throw result.error;
      return;
    }
    const values = { feedback_status: status, completed_at: new Date().toISOString(), ...(notes ? { notes } : {}) };
    if (event.feedback) {
      const result = await supabase.from("appointment_feedback").update(values)
        .eq("id", event.feedback.id).eq("user_id", user.id).eq("tenant_id", currentTenant.id)
        .eq("feedback_status", "pending").or("notes.is.null,notes.eq.").select("id").single();
      if (result.error) throw result.error;
    } else {
      const result = await supabase.from("appointment_feedback").insert({
        ...values, user_id: user.id, tenant_id: currentTenant.id, event_type: event.event_type,
        appointment_id: event.event_type === "appointment" ? event.id : null,
        external_event_id: event.event_type === "external_event" ? event.id : null,
      }).select("id").single();
      if (result.error) throw result.error;
    }
  };

  const finish = async (events: AppointmentWithFeedback[], report?: string) => {
    if (busy || !events.length) return;
    setBusy(true);
    try {
      if (recording && !(await speech.stop())) return;
      const results = await Promise.allSettled(events.map(event => persist(event, report ? "completed" : "skipped", report)));
      await refresh();
      const failed = results.filter(result => result.status === "rejected");
      if (failed.length) {
        notify.error(`${failed.length} Rückmeldung(en) konnten nicht abgeschlossen werden. Bitte erneut versuchen.`);
        return;
      }
      setCompleted(report ? "sent" : "empty");
      setPromises(previous => {
        const next = { ...previous };
        events.forEach(event => { delete next[eventKey(event)]; });
        return next;
      });
      events.forEach(event => { delete spokenSeconds.current[eventKey(event)]; });
      setMode("write");
      setSelected(null);
      setInterim("");
      setDrafts(previous => {
        const next = { ...previous };
        events.forEach(event => { delete next[eventKey(event)]; });
        return next;
      });
    } catch {
      notify.error("Rückmeldung konnte nicht gespeichert werden. Dein Text bleibt erhalten.");
    } finally {
      setBusy(false);
    }
  };

  const choose = async (event: AppointmentWithFeedback) => {
    if (recording && !(await speech.stop())) return;
    const target = eventKey(event);
    setSnoozes(previous => {
      const saved = readOfficeSnooze(previous[target]);
      return saved ? { ...previous, [target]: { ...saved, until: "" } } : previous;
    });
    setSelected(target);
    setMode("write");
  };

  const remind = async (choice: ReminderChoice) => {
    if (!current || busy) return;
    if (recording && !(await speech.stop())) return;
    setSnoozes(previous => ({
      ...previous,
      [key]: { until: officeReminderTime(choice), count: (readOfficeSnooze(previous[key])?.count ?? 0) + 1 },
    }));
    setSelected(null);
    setMode("write");
  };

  const review = async () => {
    if (recording && !(await speech.stop())) return;
    if (draftsRef.current[key]?.trim()) setMode("review");
  };

  return (
    <section aria-label="Rückmeldung ans Büro" style={{ animationDelay: "60ms" }} className="dashboard-motion-card animate-rise rounded-dashboard-card shadow-dashboard-card hover:shadow-dashboard-card-hover border border-border/70 bg-card">
      <header className="flex min-h-[52px] flex-row flex-wrap items-center justify-between gap-2 space-y-0 pt-5 pb-3 px-5">
        <h2 className="inline-flex items-center gap-2 text-card-title"><Mic className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />Rückmeldung ans Büro</h2>
        <span className="shrink-0 text-meta font-normal text-muted-foreground">
          {feedback.isLoading ? "Wird geladen…" : pending.length ? `${pending.length} ${pending.length === 1 ? "Termin" : "Termine"}${pending.filter(isDeferred).length ? ` · ${pending.filter(isDeferred).length} verschoben` : ""}` : "Alles erledigt"}
        </span>
      </header>
      <div className="px-5 pb-5">
      {isAbgeordneter && <DeputyDebriefReview reviews={reviews} tenantScope={`${currentTenant?.id}:${user?.id}`} />}
      {!feedback.isLoading && !feedback.isError && current && reminderToken !== acknowledgedReminder && isOfficeReminderDue(snoozes[key], now) && (
        <div key={key} role="status" className="animate-fade-up mb-4 flex items-start gap-2 rounded-2xl bg-[#eaf5df] px-3 py-2 text-meta font-medium text-[#55ad21]">
          <AlarmClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Du wolltest dich an den Termin „{current.title}“ erinnern lassen – jetzt ist es soweit.</span>
        </div>
      )}
      {feedback.isError ? <p role="alert" className="text-sm text-destructive">Terminrückmeldungen konnten nicht geladen werden.</p>
        : feedback.isLoading ? <p role="status" className="text-sm text-muted-foreground">Termine werden geladen…</p>
        : !current ? pending.length ? null : (
          <div role="status" className="py-6 text-center">
            <p className="text-lg text-[#55ad21]">Abgeschlossen ✓</p>
            <p className="mt-1 text-sm text-muted-foreground">{completed === "sent" ? "Deine Rückmeldung liegt dem Büro vor." : completed === "empty" ? "Nichts zu berichten." : "Keine offenen Terminrückmeldungen."}</p>
          </div>
        ) : mode === "remind" ? (
          <>
            <p className="mb-4 font-medium">Wann soll ich dich erinnern?</p>
            <div className="flex flex-wrap gap-2">
              {([["hour", "In 1 Stunde"], ["evening", isOlderOfficeFeedback(now.toISOString(), new Date(officeReminderTime("evening", now))) ? "Morgen Abend" : "Heute Abend"], ["morning", "Morgen früh"]] as const).map(([choice, label]) =>
                <button key={choice} type="button" className="rounded-2xl bg-muted px-4 py-3 text-body hover:bg-muted/70" onClick={() => void remind(choice)}>{label}</button>)}
            </div>
            <button type="button" className="mt-4 rounded-full bg-muted px-4 py-2 text-sm" onClick={() => { if (current && isDeferred(current)) setSelected(null); setMode("write"); }}>Zurück</button>
          </>
        ) : (
          <>
            <p className="mb-3 text-body-lg font-medium">{current.title}<span className="font-normal text-muted-foreground"> · {clock(current.start_time)}</span></p>
            {mode === "review" ? (
              <div className="animate-fade-up space-y-3">
                <p className="whitespace-pre-wrap rounded-2xl bg-muted/60 p-3 text-sm">{text}</p>
                {isAbgeordneter && <input aria-label="Zusage" placeholder="Zusage, falls vereinbart" value={promises[key] ?? ""}
                  onChange={event => setPromises(previous => ({ ...previous, [key]: event.target.value }))}
                  maxLength={1000} className="w-full rounded-xl border bg-background p-2" />}
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} className={`rounded-xl px-4 py-2 text-sm ${green}`} onClick={() => void finish([current], text.trim())}>{busy ? "Wird gesendet…" : "Ans Büro senden"}</button>
                  <button type="button" disabled={busy} className="px-3 py-2 text-sm text-muted-foreground" onClick={() => setMode("write")}>Zurück</button>
                </div>
              </div>
            ) : (
              <>
                <div className="peer/feedback-input flex items-end gap-2 rounded-[22px] border border-border/80 bg-muted/60 p-1.5 focus-within:border-[#55ad21] focus-within:ring-4 focus-within:ring-[#eaf5df]">
                  <textarea aria-label="Rückmeldung zum Termin" placeholder="Wie war’s? Kurz schreiben …" rows={1}
                    className="min-h-8 min-w-0 flex-1 resize-y bg-transparent px-2 py-1.5 text-body-lg outline-none"
                    value={text} disabled={busy} maxLength={12000} onChange={event => {
                      setSelected(key);
                      setDrafts(previous => ({ ...previous, [key]: event.target.value }));
                    }} />
                  <button type="button" aria-label={recording ? "Diktat beenden" : "Rückmeldung diktieren"} aria-pressed={recording}
                    disabled={busy || !speech.supported || speechState === "stopping"} title={speech.supported ? "Diktieren" : "Spracherkennung wird von diesem Browser nicht unterstützt"}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eaf5df] text-[#55ad21] disabled:opacity-40"
                    onClick={() => { if (recording) void speech.stop(); else { setSelected(key); speechTarget.current = key; recordingStarted.current = Date.now(); dictated.current = false; speech.start(); } }}>
                    {recording ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
                  </button>
                  <button type="button" disabled={busy || (!text.trim() && !recording)} className={`h-8 shrink-0 rounded-2xl px-4 text-body font-medium disabled:opacity-40 ${green}`} onClick={() => void review()}>Weiter</button>
                </div>
                  <div className="animate-fade-up mt-3 hidden flex-wrap gap-1.5 peer-focus-within/feedback-input:flex" aria-label="Hinweise zur Rückmeldung">
                    {["Wer war da?", "Was wurde zugesagt?", "Was soll das Büro tun?"].map(hint => (
                      <span key={hint} className="rounded-full bg-muted px-2.5 py-1 text-xs leading-4 text-muted-foreground">{hint}</span>
                    ))}
                  </div>
                {recording && <p role="status" className="mt-2 text-xs text-muted-foreground">{interim || "Ich höre zu …"}</p>}
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-meta font-medium text-muted-foreground">
                  <button type="button" disabled={busy} className="py-1 hover:text-foreground" onClick={() => { setSelected(key); setMode("remind"); }}>Später erinnern</button>
                  <button type="button" disabled={busy} className="py-1 hover:text-foreground" onClick={() => void finish([current])}>Nichts zu berichten</button>
                </div>
              </>
            )}
            {shown.length > 0 && <div className="mt-4 border-t">
              {shown.map(event => <div key={eventKey(event)} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b py-3 text-body">
                <span className="min-w-0 flex-1 font-medium">{new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "numeric", month: "numeric" }).format(new Date(event.start_time))} · {event.title}</span>
                <button type="button" disabled={busy} className="text-meta font-medium text-muted-foreground hover:text-foreground" onClick={() => void choose(event)}>Schreiben</button>
                <button type="button" disabled={busy || recording} className="text-meta font-medium text-muted-foreground hover:text-foreground" onClick={() => void finish([event])}>Nichts zu berichten</button>
              </div>)}
              <div className="flex flex-wrap justify-between gap-2 pt-3 text-meta font-medium text-muted-foreground">
                {!expanded && others.length > 2 && <button type="button" onClick={() => setExpanded(true)}>+{others.length - 2} weitere</button>}
                {others.length > 2 && older.length > 0 && <button type="button" disabled={busy || recording} className="ml-auto text-right hover:text-foreground" onClick={() => void finish(older)}>{older.length === 1 ? "1 älteren Termin" : `${older.length} ältere`} ohne Bericht abschließen</button>}
              </div>
            </div>}

          </>
        )}
      {!feedback.isLoading && !feedback.isError && deferred.length > 0 && (
        <div className={current ? "mt-4 border-t" : ""}>
          {deferred.map(event => {
            const reminder = readOfficeSnooze(snoozes[eventKey(event)])!;
            return (
              <div key={eventKey(event)} className="flex flex-wrap items-center gap-3 py-3 text-body">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{event.title}</p>
                  <p className="mt-0.5 text-caption text-muted-foreground">
                    {officeReminderLabel(reminder.until, now)}
                  </p>
                </div>
                <span className="rounded-full bg-[#fff4df] px-2 py-1 text-caption text-[#b96d00]">{reminder.count > 1 ? `${reminder.count}× verschoben` : "Verschoben"}</span>
                <button type="button" disabled={busy || recording} className="text-meta font-medium text-muted-foreground hover:text-foreground" onClick={() => void choose(event)}>Jetzt öffnen</button>
                <button type="button" disabled={busy || recording} className="text-meta font-medium text-muted-foreground hover:text-foreground" onClick={() => void finish([event])}>Nichts zu berichten</button>
              </div>
            );
          })}
        </div>
      )}
      {!feedback.isLoading && !feedback.isError && deferred.some(event => showsOfficeTaskHint(snoozes[eventKey(event)], now)) && (
        <p className="mt-3 text-caption text-muted-foreground">Nach 2 Tagen wird daraus eine Aufgabe für das Büro.</p>
      )}
      </div>
    </section>
  );
}
