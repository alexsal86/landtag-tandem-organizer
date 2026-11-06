import { DaySlipAppointments } from "./DaySlipAppointments";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DAY_SLIP_APPEND_EVENT, type DaySlipAppendDetail } from "@/lib/daySlipBridge";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useTenantUsers } from "@/hooks/useTenantUsers";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { sourcePath, normalizeStore } from "./daySlipState";
import type { DaySlipSource } from "./dayslipTypes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Check, ClipboardPen, Clock3, Folder, FolderArchive, ListTodo, NotebookPen,
  Pencil, Plus, Scale, Settings, Trash2, X, ExternalLink, RotateCcw, PanelRightClose, PanelRightOpen,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { WeeklyRoutineGrid } from "@/components/dayslip/WeeklyRoutineGrid";
import { WeekPlanningBanner } from "@/components/dayslip/WeekPlanningBanner";
import { DaySlipLexicalEditor } from "@/components/dayslip/DaySlipLexicalEditor";
import { DaySlipCommandHelp } from "@/components/dayslip/DaySlipCommandHelp";
import { DaySlipPages } from "@/components/dayslip/DaySlipPages";
import { useDaySlipLayout } from "@/components/dayslip/DaySlipLayout";
import { useDaySlipStore } from "@/components/dayslip/hooks/useDaySlipStore";
import {
  type DayTemplate, type TaskOptions,
  WEEK_DAYS, WEEK_DAY_LABELS, DEFAULT_DAY_TEMPLATES,
  STORAGE_KEY, RECURRING_STORAGE_KEY, DAY_TEMPLATE_STORAGE_KEY, formatDate, stripHtml, isRuleLine, formatTimeStamp, toDayKey, normalizeDayTemplates,
} from "@/components/dayslip/dayslipTypes";

function DaySlipSurface({ children }: { children: ReactNode }) {
  const layout = useDaySlipLayout();
  return layout?.docked && layout.host ? createPortal(children, layout.host) : children;
}

export function GlobalDaySlipPanel() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  if (!user || !currentTenant) return null;
  return <DaySlipPanel key={`${user.id}:${currentTenant.id}`} userId={user.id} tenantId={currentTenant.id} />;
}

function DaySlipPanel({ userId, tenantId }: { userId: string; tenantId: string }) {
  const layout = useDaySlipLayout();
  const docked = !!(layout?.docked && layout.host);
  const setDockVisible = layout?.setVisible;
  const navigate = useNavigate();
  const { users: tenantUsers } = useTenantUsers();
  const [taskDraft, setTaskDraft] = useState<{ lineId: string; text: string; options: TaskOptions } | null>(null);
  const [showLegacy, setShowLegacy] = useState(false);
  const closingRef = useRef(false);
  const [open, setOpen] = useState(() => {
    try { const saved = localStorage.getItem('day-slip-panel-open'); return saved !== null ? JSON.parse(saved) : false; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem('day-slip-panel-open', JSON.stringify(open)); } catch { /* Panel visibility is optional. */ } }, [open]);
  useEffect(() => {
    setDockVisible?.(open);
    return () => setDockVisible?.(false);
  }, [open, setDockVisible]);

  const [showArchive, setShowArchive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [closing, setClosing] = useState(false);
  const [contentTransitioning, setContentTransitioning] = useState(false);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [showCompletePulse, setShowCompletePulse] = useState(false);
  const [isDraggingToDaySlip, setIsDraggingToDaySlip] = useState(false);
  const [isOverDaySlipButton, setIsOverDaySlipButton] = useState(false);

  // Recurring UI state
  const [recurringDraft, setRecurringDraft] = useState("");
  const [recurringEditIndex, setRecurringEditIndex] = useState<number | null>(null);
  const [recurringEditDraft, setRecurringEditDraft] = useState("");
  const [recurringDraftWeekday, setRecurringDraftWeekday] = useState<(typeof WEEK_DAYS)[number]>("all");

  // Day template UI state
  const [dayTemplateDraftName, setDayTemplateDraftName] = useState("");
  const [dayTemplateDraftLines, setDayTemplateDraftLines] = useState("");
  const [dayTemplateEditId, setDayTemplateEditId] = useState<string | null>(null);

  // Context menu
  const [lineContextMenu, setLineContextMenu] = useState<{ x: number; y: number; lineId: string; text: string } | null>(null);

  // Store hook
  const ds = useDaySlipStore(userId, tenantId);
  const canDropToDaySlip = ds.ready && !ds.todayData.completedAt && !ds.isProcessing;

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const reset = () => {
      clearTimeout(timeout);
      setIsDraggingToDaySlip(false);
      setIsOverDaySlipButton(false);
    };
    const track = (event: globalThis.DragEvent) => {
      const types = event.dataTransfer?.types ?? [];
      if (!canDropToDaySlip || (!types.includes("application/x-mywork-task-title") && !types.includes("text/plain"))) return;
      setIsDraggingToDaySlip(true);
      clearTimeout(timeout);
      // Also clear the highlight when a drag leaves the browser or is cancelled externally.
      timeout = setTimeout(reset, 600);
    };
    document.addEventListener("dragstart", track);
    document.addEventListener("dragover", track);
    document.addEventListener("drop", reset);
    document.addEventListener("dragend", reset);
    window.addEventListener("blur", reset);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("dragstart", track);
      document.removeEventListener("dragover", track);
      document.removeEventListener("drop", reset);
      document.removeEventListener("dragend", reset);
      window.removeEventListener("blur", reset);
    };
  }, [canDropToDaySlip]);
  const legacyData = useMemo(() => {
    try { return normalizeStore(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")); } catch { return {}; }
  }, []);
  const [legacyImported, setLegacyImported] = useState(false);
  const taskFields = (options: TaskOptions, onChange: (value: TaskOptions) => void, disabled = false) => (
    <div className="mt-2 flex flex-wrap gap-2">
      <label className="flex flex-col gap-1 text-xs">Zuständig
        <select aria-label="Zuständig" className="h-8 rounded border bg-background px-2" disabled={disabled} value={options.assignedTo || userId} onChange={event => onChange({ ...options, assignedTo: event.target.value })}>
          <option value={userId}>Ich</option>
          {tenantUsers.filter(person => person.id !== userId).map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">Fällig am
        <input aria-label="Fällig am" type="date" className="h-8 rounded border bg-background px-2" disabled={disabled} value={options.dueDate || ""} onChange={event => onChange({ ...options, dueDate: event.target.value })} />
      </label>
    </div>
  );

  // Keyboard shortcut
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === "j") { event.preventDefault(); setOpen((prev: boolean) => !prev); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => { if (!completionMessage) return; const t = window.setTimeout(() => setCompletionMessage(null), 2800); return () => window.clearTimeout(t); }, [completionMessage]);
  useEffect(() => { const close = () => setLineContextMenu(null); window.addEventListener("click", close); window.addEventListener("scroll", close); return () => { window.removeEventListener("click", close); window.removeEventListener("scroll", close); }; }, []);

  // Strike visual sync
  useEffect(() => {
    if (!ds.editorRef.current) return;
    const struckSet = new Set(ds.struckLineIds);
    requestAnimationFrame(() => {
      const nodes = document.querySelectorAll<HTMLElement>(".day-slip-item");
      nodes.forEach((node) => {
        const lineId = node.dataset.lineId ?? "";
        const text = (node.textContent ?? "").trim();
        node.classList.toggle("has-text", text.length > 0);
        const struck = struckSet.has(lineId);
        node.classList.toggle("line-through", struck);
        node.classList.toggle("text-muted-foreground", struck);
        node.classList.toggle("opacity-70", struck);
        const isHighPriority = /^!!\s*/.test(text);
        const isPriority = !isHighPriority && /^!\s*/.test(text);
        node.classList.toggle("bg-priority-high/10", isHighPriority);
        node.classList.toggle("border", isHighPriority || isPriority);
        node.classList.toggle("border-priority-high/40", isHighPriority);
        node.classList.toggle("bg-palette-amber/10", isPriority);
        node.classList.toggle("border-palette-amber/40", isPriority);
        const stamp = ds.todayData.lineTimestamps?.[lineId];
        node.title = stamp ? `Erfasst: ${formatTimeStamp(stamp.addedAt)} · Abgehakt: ${formatTimeStamp(stamp.checkedAt)}` : "";
      });
    });
  }, [ds.editorRef, ds.struckLineIds, ds.todayData.html, ds.todayData.lineTimestamps, open, ds.editorReadyVersion]);

  // Changes are cached synchronously; closing also asks the queue to flush.
  const animateClosePanel = () => {
    if (ds.isProcessing) return;
    void ds.flush();
    setClosing(true);
    setTimeout(() => { ds.setResolveMode(false); setOpen(false); setClosing(false); }, 220);
  };

  const completeDay = async () => {
    if (closingRef.current || ds.isProcessing) return;
    if (ds.resolveMode && ds.unresolvedCount > 0) { ds.setResolveMode(false); return; }
    if (ds.unresolvedCount > 0) { ds.setResolveMode(true); return; }
    closingRef.current = true;
    try {
      if (!await ds.completeDay()) {
        ds.setResolveMode(true);
        toast.error("Der Tag bleibt offen. Bitte prüfe die markierten Einträge und den Speicherstatus.");
        return;
      }
      setCompletionMessage("✅ Tag erfolgreich abgeschlossen");
      setShowCompletePulse(true);
      setTimeout(() => setShowCompletePulse(false), 800);
      animateClosePanel();
    } finally { closingRef.current = false; }
  };

  const handleDropToDaySlip = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDraggingToDaySlip(false);
    setIsOverDaySlipButton(false);
    const droppedTaskTitle = event.dataTransfer.getData("application/x-mywork-task-title").trim();
    const droppedTaskId = event.dataTransfer.getData("application/x-mywork-task-id").trim();
    const droppedItemType = event.dataTransfer.getData("application/x-mywork-item-type").trim();
    const droppedPlainText = event.dataTransfer.getData("text/plain").trim();
    const rawValue = droppedTaskTitle || droppedPlainText;
    if (!rawValue) return;
    const typeIcons: Record<string, string> = { task: "✅", note: "📝", case: "💼", decision: "🗳️" };
    const icon = (droppedItemType && typeIcons[droppedItemType]) || (droppedTaskTitle ? "✅" : "");
    const withIcon = icon && !rawValue.startsWith(icon) ? `${icon} ${rawValue}` : rawValue;
    if (ds.todayData.completedAt || !ds.ready || ds.isProcessing) { toast.info("Bitte den Tageszettel zuerst öffnen und den Tag gegebenenfalls wieder öffnen."); return; }
    const sourceType = ["task", "note", "case", "decision"].includes(droppedItemType) ? droppedItemType as "task" | "note" | "case" | "decision" : "task";
    ds.appendLinesToToday([withIcon], droppedTaskId ? { type: sourceType, id: droppedTaskId } : undefined);
    setOpen(true); ds.setResolveMode(false); setShowArchive(false); setShowSettings(false);
  }, [ds]);

  useEffect(() => {
    const onAppend = (event: Event) => {
      const detail = (event as CustomEvent<DaySlipAppendDetail>).detail;
      const text = detail?.text?.trim();
      if (!text) return;
      if (ds.todayData.completedAt || !ds.ready || ds.isProcessing) { toast.info("Bitte den Tageszettel zuerst öffnen und den Tag gegebenenfalls wieder öffnen."); return; }
      ds.appendLinesToToday([text], detail.source);
      toast.success("Auf den Tageszettel gesetzt");
    };
    window.addEventListener(DAY_SLIP_APPEND_EVENT, onAppend);
    return () => window.removeEventListener(DAY_SLIP_APPEND_EVENT, onAppend);
  }, [ds]);

  const handleDaySlipButtonDragOver = useCallback((event: DragEvent<HTMLButtonElement>) => {
    const hasDaySlipData = event.dataTransfer.types.includes("application/x-mywork-task-title") || event.dataTransfer.types.includes("text/plain");
    if (!hasDaySlipData || !canDropToDaySlip) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingToDaySlip(true);
    setIsOverDaySlipButton(true);
  }, [canDropToDaySlip]);

  const handleDaySlipButtonDrop = useCallback((event: DragEvent<HTMLButtonElement>) => {
    handleDropToDaySlip(event as unknown as DragEvent<HTMLElement>);
  }, [handleDropToDaySlip]);

  const handleEditorClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (ds.todayData.completedAt || ds.isProcessing) return;
    const target = e.target as HTMLElement;
    const item = target.closest(".day-slip-item") as HTMLElement | null;
    if (!item) return;
    const rect = item.getBoundingClientRect();
    const linkType = item.dataset.sourceType; const linkId = item.dataset.sourceId;
    if (linkType && linkId && rect.right - e.clientX <= 24) {
      e.preventDefault();
      navigate(sourcePath({ type: linkType as DaySlipSource["type"], id: linkId }));
      return;
    }
    if (e.clientX - rect.left > 24) return;
    const lineText = (item.textContent ?? "").trim();
    if (!lineText || isRuleLine(lineText)) return;
    const lineId = item.dataset.lineId;
    if (!lineId) return;
    ds.toggleStrike(lineId);
  }, [ds, navigate]);

  const handleEditorContextMenu = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (ds.todayData.completedAt || ds.isProcessing) return;
    const target = e.target as HTMLElement;
    const item = target.closest(".day-slip-item") as HTMLElement | null;
    if (!item) return;
    const lineId = item.dataset.lineId;
    const text = (item.textContent ?? "").trim();
    if (!lineId || !text || isRuleLine(text)) return;
    e.preventDefault();
    setLineContextMenu({ x: e.clientX, y: e.clientY, lineId, text });
  }, [ds.todayData.completedAt, ds.isProcessing]);

  const switchView = (view: "settings" | "archive" | "default") => {
    setContentTransitioning(true);
    requestAnimationFrame(() => { setShowSettings(view === "settings"); setShowArchive(view === "archive"); setTimeout(() => setContentTransitioning(false), 360); });
  };

  // Recurring item CRUD
  const addRecurringItem = () => {
    const value = recurringDraft.trim();
    if (!value) return;
    ds.setRecurringItems((prev) => [...prev, { id: crypto.randomUUID(), text: value, weekday: recurringDraftWeekday }]);
    setRecurringDraft(""); setRecurringDraftWeekday("all");
  };
  const removeRecurringItem = (index: number) => {
    ds.setRecurringItems((prev) => prev.filter((_, idx) => idx !== index));
    if (recurringEditIndex === index) { setRecurringEditIndex(null); setRecurringEditDraft(""); }
  };
  const startEditRecurringItem = (index: number) => { setRecurringEditIndex(index); setRecurringEditDraft(ds.recurringItems[index]?.text ?? ""); };
  const saveEditRecurringItem = () => {
    if (recurringEditIndex === null) return;
    const value = recurringEditDraft.trim();
    if (!value) return;
    ds.setRecurringItems((prev) => prev.map((item, idx) => idx === recurringEditIndex ? { ...item, text: value } : item));
    setRecurringEditIndex(null); setRecurringEditDraft("");
  };
  const handleChangeRecurringWeekday = useCallback((id: string, newWeekday: string) => {
    ds.setRecurringItems((prev) => prev.map((item) => item.id === id ? { ...item, weekday: newWeekday as (typeof WEEK_DAYS)[number] } : item));
  }, [ds]);

  // Day template CRUD
  const applyDayTemplate = (template: DayTemplate) => { ds.insertStructuredLines(template.lines); setShowSettings(false); };
  const startEditDayTemplate = (template: DayTemplate) => { setDayTemplateEditId(template.id); setDayTemplateDraftName(template.name); setDayTemplateDraftLines(template.lines.join("\n")); };
  const resetTemplateDraft = () => { setDayTemplateEditId(null); setDayTemplateDraftName(""); setDayTemplateDraftLines(""); };
  const saveDayTemplate = () => {
    const name = dayTemplateDraftName.trim();
    const lines = dayTemplateDraftLines.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!name || lines.length === 0) return;
    ds.setDayTemplates((prev) => {
      if (dayTemplateEditId) return prev.map((t) => t.id === dayTemplateEditId ? { ...t, name, lines } : t);
      return [...prev, { id: crypto.randomUUID(), name, lines }];
    });
    resetTemplateDraft();
  };
  const removeDayTemplate = (templateId: string) => {
    ds.setDayTemplates((prev) => { const next = prev.filter((t) => t.id !== templateId); return next.length > 0 ? next : DEFAULT_DAY_TEMPLATES; });
    if (dayTemplateEditId === templateId) resetTemplateDraft();
  };

  const completeButtonLabel = ds.resolveMode && ds.unresolvedCount === 0 ? "✓ Alle zugewiesen – Tag abschließen" : "🏁 Tag abschließen";
  const completeButtonHint = ds.resolveMode && ds.unresolvedCount > 0 ? "abbrechen" : ds.unresolvedCount > 0 ? `${ds.unresolvedCount} offen →` : "alles erledigt →";

  return (
    <>
      {open && (
        <DaySlipSurface>
        <aside
          aria-label="Tageszettel"
          className={cn(
            "flex flex-col border border-border/60 bg-background/95 backdrop-blur transition-[opacity,transform] duration-300 ease-out",
            docked ? "relative h-full w-full border-y-0 border-r-0" : "fixed bottom-24 right-6 z-50 h-[min(84vh,920px)] w-[calc(100vw-1rem)] sm:w-[min(24rem,calc(100vw-2rem))] lg:w-[min(35rem,calc(100vw-3rem))] max-w-[calc(100vw-1rem)] rounded-2xl shadow-2xl",
            closing ? "translate-y-3 opacity-0" : "translate-y-0 opacity-100",
          )}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDropToDaySlip}
        >
          {docked && layout && <div
            role="separator"
            aria-label="Breite des Tageszettels"
            aria-orientation="vertical"
            aria-valuemin={320}
            aria-valuemax={Math.floor(Math.min(640, window.innerWidth * 0.45))}
            aria-valuenow={Math.round(layout.width)}
            tabIndex={0}
            className="absolute inset-y-0 -left-1 z-10 w-2 touch-none cursor-col-resize rounded hover:bg-primary/30 focus-visible:bg-primary/30 focus-visible:outline-none"
            onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) layout.setWidth(window.innerWidth - event.clientX); }}
            onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
            onKeyDown={event => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                layout.setWidth(layout.width + (event.key === "ArrowLeft" ? 24 : -24));
              }
            }}
          />}
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div>
              <p className="flex items-center gap-2 text-lg font-semibold"><ClipboardPen className="h-5 w-5" /> Tageszettel</p>
              <p className="text-xs text-muted-foreground">{formatDate(ds.todayKey)}</p>
            </div>
            <div className="flex items-center gap-2">
              <DaySlipCommandHelp />
              {layout?.desktop && <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => layout.setDocked(!docked)} aria-label={docked ? "Tageszettel schwebend anzeigen" : "Tageszettel rechts andocken"} title={docked ? "Schwebend anzeigen" : "Rechts andocken"}>
                {docked ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </button>}
              <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => switchView(showSettings ? "default" : "settings")} aria-label="Einstellungen anzeigen"><Settings className="h-4 w-4" /></button>
              <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => switchView(showArchive ? "default" : "archive")} aria-label="Archiv anzeigen"><Folder className="h-4 w-4" /></button>
              <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={animateClosePanel} aria-label="Panel schließen"><X className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="border-b px-4 py-2 text-xs" role="status" aria-live="polite">
            {ds.saveStatus === "loading" ? "Tageszettel wird geladen …" : ds.saveStatus === "saving" ? "Speichert …" : ds.saveStatus === "saved" ? "Gespeichert" : "Speichern fehlgeschlagen"}
            {ds.saveStatus === "error" && <><p className="mt-1 text-destructive">{ds.saveError}</p><button className="mt-1 underline" onClick={() => void ds.retrySave()}>Erneut versuchen</button></>}
            {ds.deadlineError && <p className="mt-1 text-destructive">Fristen konnten nicht aktualisiert werden. Die Aktualisierung wird erneut versucht.</p>}
          </div>
          {!showArchive && !showSettings && <DaySlipAppointments />}
          {!ds.ready ? <div className="flex-1 p-4 text-sm text-muted-foreground">{ds.saveStatus === "error" ? "Deine lokalen Einträge bleiben erhalten. Bitte versuche das Laden erneut." : "Deine Einträge werden geladen …"}</div> : showSettings ? (
            <div className={`flex-1 space-y-4 overflow-y-auto p-4 transition-all duration-300 ease-out ${contentTransitioning ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"}`}>
              <div><p className="text-sm font-medium">Einstellungen</p><p className="text-xs text-muted-foreground">Wiederkehrende Punkte verwalten</p></div>
              {Object.keys(legacyData).length > 0 && !legacyImported && <button className="rounded border px-3 py-2 text-xs" onClick={() => setShowLegacy(true)}>Ältere lokale Daten prüfen und übernehmen</button>}
              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Wiederkehrende Punkte</p>
                <div className="mb-2 flex flex-wrap gap-1">
                  {WEEK_DAYS.map((day) => (
                    <button key={day} type="button" onClick={() => setRecurringDraftWeekday(day)} className={`rounded border px-2 py-0.5 text-[11px] transition-colors ${recurringDraftWeekday === day ? "border-primary/60 bg-primary/15 text-primary" : "border-border/60 hover:bg-muted"}`}>{WEEK_DAY_LABELS[day]}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={recurringDraft} onChange={(e) => setRecurringDraft(e.target.value)} placeholder="z. B. Inbox prüfen" className="h-8 flex-1 rounded border border-border/60 bg-background px-2 text-xs" />
                  <button type="button" onClick={addRecurringItem} className="rounded border border-border/60 px-2 text-xs hover:bg-muted">Hinzufügen</button>
                </div>
                <WeeklyRoutineGrid recurringItems={ds.recurringItems} onChangeWeekday={handleChangeRecurringWeekday} />
                <div className="space-y-2">
                  {ds.recurringItems.length === 0 && <p className="text-xs text-muted-foreground">Noch keine wiederkehrenden Punkte gespeichert.</p>}
                  {ds.recurringItems.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-2 rounded border border-border/50 px-2 py-1.5 text-xs">
                      {recurringEditIndex === index ? (
                        <>
                          <input value={recurringEditDraft} onChange={(e) => setRecurringEditDraft(e.target.value)} className="h-7 flex-1 rounded border border-border/60 bg-background px-2 text-xs" />
                          <button type="button" className="rounded border border-border/60 px-2 py-1 hover:bg-muted" onClick={saveEditRecurringItem}>Speichern</button>
                          <button type="button" className="rounded border border-border/60 px-2 py-1 hover:bg-muted" onClick={() => setRecurringEditIndex(null)}>Abbrechen</button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1">{item.text}</span>
                          <span className="rounded border border-border/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">{WEEK_DAY_LABELS[item.weekday]}</span>
                          <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => startEditRecurringItem(index)} aria-label="Bearbeiten"><Pencil className="h-3.5 w-3.5" /></button>
                          <button type="button" className="rounded p-1 text-destructive hover:bg-destructive/10" onClick={() => removeRecurringItem(index)} aria-label="Löschen"><Trash2 className="h-3.5 w-3.5" /></button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tagesvorlagen</p>
                <p className="text-xs text-muted-foreground">Fügt vordefinierte Blöcke inkl. HR-Trennlinien ein.</p>
                <div className="space-y-1.5">
                  {ds.dayTemplates.map((template) => (
                    <div key={template.id} className="flex items-center gap-1.5">
                      <button type="button" className="flex-1 rounded border border-border/60 px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => applyDayTemplate(template)}>{template.name}</button>
                      <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => startEditDayTemplate(template)} aria-label="Bearbeiten"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" className="rounded p-1 text-destructive hover:bg-destructive/10" onClick={() => removeDayTemplate(template.id)} aria-label="Löschen"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 border-t border-border/60 pt-2">
                  <input value={dayTemplateDraftName} onChange={(e) => setDayTemplateDraftName(e.target.value)} placeholder="Vorlagenname" className="h-8 w-full rounded border border-border/60 bg-background px-2 text-xs" />
                  <textarea value={dayTemplateDraftLines} onChange={(e) => setDayTemplateDraftLines(e.target.value)} placeholder={"Zeilen eingeben (eine pro Zeile).\n--- Überschrift --- → wird zur Trennlinie\n!! Wichtig → wird rot markiert\n! Priorität → wird gelb markiert"} className="min-h-[90px] w-full rounded border border-border/60 bg-background px-2 py-1.5 text-xs" />
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={saveDayTemplate} disabled={!dayTemplateDraftName.trim() || !dayTemplateDraftLines.trim()} className="rounded border border-border/60 px-2 py-1 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">{dayTemplateEditId ? "Speichern" : "Neu anlegen"}</button>
                    {dayTemplateEditId && <button type="button" className="rounded border border-border/60 px-2 py-1 text-xs hover:bg-muted" onClick={resetTemplateDraft}>Abbrechen</button>}
                  </div>
                </div>
              </div>
            </div>
          ) : showArchive ? (
            <div className={`flex-1 space-y-3 overflow-y-auto p-4 transition-all duration-300 ease-out ${contentTransitioning ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"}`}>
              <p className="text-sm font-medium">Archiv (nur lesen)</p>
              {ds.archiveDays.length === 0 && <p className="text-sm text-muted-foreground">Noch keine vergangenen Tage.</p>}
              {ds.archiveDays.map((day) => {
                const dayData = ds.store[day];
                const moodMap = ["😞", "🙁", "😐", "🙂", "😄"] as const;
                const mood = dayData?.dayMood ? moodMap[dayData.dayMood - 1] : "—";
                const completedInfo = dayData?.completedAt ? `Abgeschlossen um ${new Date(dayData.completedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` : "Nicht explizit abgeschlossen";
                return (
                  <div key={day} className="rounded-lg border border-border/60 p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{formatDate(day)}</p>
                    <p className="mb-2 text-[11px] text-muted-foreground/90">{completedInfo} · {(dayData?.resolved ?? []).length} zugewiesen · Stimmung: {mood}</p>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{stripHtml(dayData?.html ?? "") || "—"}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`flex min-h-0 flex-1 flex-col transition-all duration-300 ease-out ${contentTransitioning ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"}`}>
              {!ds.todayData.completedAt && <WeekPlanningBanner key={`week-${ds.todayKey}`} recurringItems={ds.recurringItems} weekPlan={ds.weekPlan} onChangePlan={ds.setWeekPlan} />}
              {ds.carryEntries.length > 0 && !ds.todayData.completedAt && (
                <div className="border-b border-palette-amber/40 bg-palette-amber/10 px-4 py-2 text-sm text-palette-amber   ">
                  <span className="font-semibold">Noch offen oder wieder fällig:</span>{" "}&ldquo;{ds.carryEntries[0].text}&rdquo;{ds.carryEntries.length > 1 ? ` +${ds.carryEntries.length - 1}` : ""}
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-palette-amber ">
                    <span>Auch offene Punkte und fällige Wiedervorlagen aus älteren Tagen.</span>
                    <button type="button" className="rounded border border-palette-amber/50 px-2 py-0.5 hover:bg-palette-amber/20  " onClick={ds.carryOver}>In heute übernehmen</button>
                  </div>
                </div>
              )}

              <DaySlipLexicalEditor
                key={`editor-${ds.todayKey}`}
                forceReloadToken={ds.editorReloadToken}
                readOnly={!!ds.todayData.completedAt || ds.isProcessing}
                hidden={ds.resolveMode && ds.triageEntries.length > 0}
                initialHtml={ds.todayData.html}
                initialNodes={ds.todayData.nodes}
                dayKey={ds.todayKey}
                resolveMode={ds.resolveMode}
                editorConfig={ds.editorConfig}
                onEditorChange={ds.onEditorChange}
                onEditorReady={ds.handleEditorReady}
                onEditorClick={handleEditorClick}
                onEditorContextMenu={handleEditorContextMenu}
                onDrop={handleDropToDaySlip}
              />

              {ds.resolveMode && ds.triageEntries.length > 0 && (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-border/60">
                  <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
                    <p className="text-sm font-medium">
                      {ds.unresolvedCount > 0 ? `${ds.unresolvedCount} ${ds.unresolvedCount === 1 ? "Eintrag" : "Einträge"} noch offen – was soll damit passieren?` : "Alle Einträge sind zugewiesen. Du kannst den Tag jetzt abschließen."}
                    </p>
                  </div>
                  <DaySlipPages>
                  <div className="space-y-2 p-4">
                    {ds.unresolvedCount === 0 && (() => {
                      const resolved = ds.resolvedItems;
                      const noteCount = resolved.filter(r => r.target === "note").length;
                      const taskCount = resolved.filter(r => r.target === "task").length;
                      const decisionCount = resolved.filter(r => r.target === "decision").length;
                      const snoozedCount = resolved.filter(r => r.target === "snoozed").length;
                      const archivedCount = resolved.filter(r => r.target === "archived").length;
                      const parts: string[] = [];
                      if (noteCount > 0) parts.push(`${noteCount} Notiz${noteCount > 1 ? "en" : ""}`);
                      if (taskCount > 0) parts.push(`${taskCount} Aufgabe${taskCount > 1 ? "n" : ""}`);
                      if (decisionCount > 0) parts.push(`${decisionCount} Entscheidung${decisionCount > 1 ? "en" : ""}`);
                      if (snoozedCount > 0) parts.push(`${snoozedCount} gesnoozed`);
                      if (archivedCount > 0) parts.push(`${archivedCount} archiviert`);
                      const summary = parts.length > 0 ? `Zuordnung: ${parts.join(", ")}. Vorgemerkte Einträge werden beim Abschluss verarbeitet.` : "";
                      return (
                        <div className="rounded border border-palette-green/40 bg-palette-green/10 px-3 py-2 text-xs text-palette-green">
                          <p>✓ Alle offenen Punkte wurden zugewiesen.</p>
                          {summary && <p className="mt-1 font-medium">{summary}</p>}
                        </div>
                      );
                    })()}
                    {ds.triageEntries.map(({ id, text }) => {
                      const activeTarget = ds.resolvedByLineId.get(id);
                      const buttonClass = (target: string) => `rounded p-1 transition-colors ${activeTarget === target ? "bg-palette-green/20 text-palette-green ring-1 ring-palette-green dark:ring-palette-green/50" : "hover:bg-muted"}`;
                      const stamp = ds.todayData.lineTimestamps?.[id];
                      const isHighPriority = /^!!\s*/.test(text);
                      const isPriority = !isHighPriority && /^!\s*/.test(text);
                      const resolution = ds.resolvedItems.find(r => r.lineId === id);
                      const snoozeItem = resolution?.target === "snoozed" ? resolution : undefined;
                      const source = ds.todayData.sources?.[id];
                      return (
                        <div key={id} className={cn("flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 text-sm", isHighPriority && "bg-priority-high/10 border-priority-high/40", isPriority && "bg-palette-amber/10 border-palette-amber/40")}>
                          <div className="flex flex-1 flex-col">
                            <span className="line-clamp-1">{text}</span>
                            <span className="text-[10px] text-muted-foreground">{resolution?.persisted ? "Erfolgreich erstellt / verknüpft" : activeTarget && source?.type === activeTarget ? "Verknüpfung vorgemerkt" : activeTarget && ["task", "note", "decision"].includes(activeTarget) ? "Zur Erstellung vorgemerkt" : activeTarget === "snoozed" ? "Wiedervorlage" : activeTarget === "archived" ? "Archiviert" : "Gesammelt"}</span>
                            {source && <button className="flex items-center gap-1 text-left text-xs text-primary underline" onClick={() => navigate(sourcePath(source))}><ExternalLink className="h-3 w-3" />Original öffnen</button>}
                            {resolution?.error && <span role="alert" className="text-xs text-destructive">Erstellen fehlgeschlagen: {resolution.error}</span>}
                            {activeTarget === "task" && source?.type !== "task" && taskFields(resolution?.taskOptions ?? {}, value => ds.updateTaskOptions(id, value), !!resolution?.persisted || ds.isProcessing)}
                            <span className="text-[10px] text-muted-foreground">
                              Erfasst {formatTimeStamp(stamp?.addedAt)} · Abgehakt {formatTimeStamp(stamp?.checkedAt)}
                              {snoozeItem?.snoozeUntil && <> · Snooze bis {snoozeItem.snoozeUntil}</>}
                            </span>
                          </div>
                          <fieldset disabled={ds.isProcessing || !!resolution?.persisted} className="flex items-center gap-1 flex-shrink-0 disabled:opacity-60">
                            <button type="button" title="Als Notiz" className={buttonClass("note")} onClick={() => ds.toggleResolveLine(id, text, "note")}><NotebookPen className="h-4 w-4" /></button>
                            <button type="button" title="Als Aufgabe" className={buttonClass("task")} onClick={() => ds.toggleResolveLine(id, text, "task")}><ListTodo className="h-4 w-4" /></button>
                            <button type="button" title="Als Entscheidung" className={buttonClass("decision")} onClick={() => ds.toggleResolveLine(id, text, "decision")}><Scale className="h-4 w-4" /></button>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button type="button" title="Snoozen" className={buttonClass("snoozed")}>
                                  <Clock3 className="h-4 w-4" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-1" align="end" sideOffset={4}>
                                <div className="flex flex-col">
                                  {([
                                    { label: "+1 Tag", days: 1 },
                                    { label: "+3 Tage", days: 3 },
                                    { label: "Nächste Woche", days: 7 },
                                  ] as const).map(({ label, days }) => {
                                    const d = new Date(); d.setDate(d.getDate() + days);
                                    const until = toDayKey(d);
                                    return (
                                      <button key={days} type="button" className="rounded px-3 py-1.5 text-left text-sm hover:bg-muted" onClick={() => ds.toggleResolveLine(id, text, "snoozed", until)}>
                                        {label} <span className="text-muted-foreground text-xs">({until})</span>
                                      </button>
                                    );
                                  })}
                                  <button type="button" className="rounded px-3 py-1.5 text-left text-sm hover:bg-muted" onClick={() => ds.toggleResolveLine(id, text, "snoozed")}>
                                    Morgen
                                  </button>
                                </div>
                              </PopoverContent>
                            </Popover>
                            <button type="button" title="Archivieren" className={buttonClass("archived")} onClick={() => ds.toggleResolveLine(id, text, "archived")}><FolderArchive className="h-4 w-4" /></button>
                          </fieldset>
                        </div>
                      );
                    })}
                  </div>
                  </DaySlipPages>
                </div>
              )}

              {Object.entries(ds.todayData.sources ?? {}).length > 0 && <div className="max-h-24 shrink-0 overflow-y-auto border-b px-4 py-2 text-xs">
                {Object.entries(ds.todayData.sources ?? {}).map(([lineId, source]) => <button key={lineId} className="mb-1 flex items-center gap-1 text-primary underline" onClick={() => navigate(sourcePath(source))}><ExternalLink className="h-3 w-3" />{ds.allLineEntries.find(line => line.id === lineId)?.text || "Original öffnen"}</button>)}
              </div>}
              {!ds.resolveMode && ds.resolvedItems.length > 0 && <div className="border-b px-4 py-2 text-xs">
                <p>{ds.resolvedItems.filter(item => item.persisted).length} erfolgreich erstellt / verknüpft · {ds.resolvedItems.filter(item => !item.persisted && ["task", "note", "decision"].includes(item.target)).length} zur Erstellung vorgemerkt</p>
                {ds.resolvedItems.filter(item => item.error).map(item => <p key={item.lineId} role="alert" className="mt-1 text-destructive">{item.text}: {item.error}</p>)}
                {!ds.todayData.completedAt && <button className="mt-1 underline" onClick={() => ds.setResolveMode(true)}>Zuordnung prüfen</button>}
              </div>}
              {/* Footer */}
              <div className="shrink-0 space-y-2 p-3">
                {ds.resolveMode && (
                  <div className="rounded-lg border border-border/60 px-3 py-2">
                    <p className="mb-1 text-[11px] text-muted-foreground">Wie war dein Tag?</p>
                    <div className="flex items-center justify-between">
                      {["😞", "🙁", "😐", "🙂", "😄"].map((mood, index) => (
                        <button key={mood} type="button" className={cn("rounded px-1.5 py-1 text-lg transition hover:bg-muted", ds.todayData.dayMood === (index + 1) ? "bg-palette-green/20 ring-1 ring-palette-green/50" : "opacity-70")}
                          disabled={ds.isProcessing || !!ds.todayData.completedAt} onClick={() => ds.setMood((index + 1) as 1 | 2 | 3 | 4 | 5)}>{mood}</button>
                      ))}
                    </div>
                  </div>
                )}
                {ds.todayData.completedAt ? <div className="space-y-2 rounded border border-palette-green/40 p-3 text-sm">
                  <p>✓ Tag abgeschlossen</p><button className="flex items-center gap-1 underline" onClick={() => void ds.reopenDay()}><RotateCcw className="h-4 w-4" />Tag wieder öffnen</button>
                </div> : <button type="button" disabled={ds.isProcessing} onClick={() => void completeDay()} className="flex h-10 w-full items-center justify-between rounded-lg border border-palette-green/40 bg-palette-green/10 px-3 text-sm font-medium text-palette-green">
                  <span>{ds.isProcessing ? "Einträge werden verarbeitet …" : completeButtonLabel}</span>
                  <span className="text-xs opacity-70">{completeButtonHint}</span>
                </button>}
              </div>
            </div>
          )}
        </aside>
        </DaySlipSurface>
      )}

      {lineContextMenu && (
        <div className="fixed z-[70] min-w-44 rounded-md border border-border bg-popover p-1 shadow-xl" style={{ left: lineContextMenu.x, top: lineContextMenu.y }}>
          {ds.todayData.sources?.[lineContextMenu.lineId] && <button className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-sm hover:bg-accent" onClick={() => { const src = ds.todayData.sources![lineContextMenu.lineId]; setLineContextMenu(null); navigate(sourcePath(src)); }}><ExternalLink className="h-3 w-3" />Original öffnen</button>}
          <button className="flex w-full rounded px-2 py-1 text-left text-sm hover:bg-accent" onClick={async () => { setTaskDraft({ lineId: lineContextMenu.lineId, text: lineContextMenu.text, options: { assignedTo: userId } }); setLineContextMenu(null); }}>Als Aufgabe erstellen</button>
          <button className="flex w-full rounded px-2 py-1 text-left text-sm hover:bg-accent" onClick={async () => { if (await ds.createFromLine(lineContextMenu.lineId, lineContextMenu.text, "note")) { toast.success("Notiz erstellt / verknüpft"); setLineContextMenu(null); } else toast.error("Notiz konnte nicht gespeichert werden. Bitte erneut versuchen."); }}>Als Notiz speichern</button>
          <button className="flex w-full rounded px-2 py-1 text-left text-sm hover:bg-accent" onClick={() => { ds.toggleResolveLine(lineContextMenu.lineId, lineContextMenu.text, "snoozed"); setLineContextMenu(null); }}>Snoozen</button>
          <button className="flex w-full rounded px-2 py-1 text-left text-sm text-destructive hover:bg-destructive/10" onClick={() => { ds.deleteLine(lineContextMenu.lineId); setLineContextMenu(null); }}>Löschen</button>
        </div>
      )}

      <Dialog open={!!taskDraft} onOpenChange={value => { if (!value && !ds.isProcessing) setTaskDraft(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Als Aufgabe erstellen</DialogTitle><DialogDescription>{taskDraft?.text}</DialogDescription></DialogHeader>
          {taskDraft && (ds.todayData.sources?.[taskDraft.lineId]?.type === "task" ? <p className="text-sm">Diese Aufgabe ist bereits verknüpft. Es wird keine neue Aufgabe erstellt.</p> : taskFields(taskDraft.options, options => setTaskDraft({ ...taskDraft, options }), ds.isProcessing))}
          <button disabled={ds.isProcessing} className="rounded border bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" onClick={async () => {
            if (!taskDraft) return;
            if (await ds.createFromLine(taskDraft.lineId, taskDraft.text, "task", taskDraft.options)) { toast.success("Aufgabe erstellt / verknüpft"); setTaskDraft(null); }
            else toast.error("Aufgabe konnte nicht gespeichert werden. Bitte erneut versuchen.");
          }}>{ds.isProcessing ? "Wird erstellt …" : "Aufgabe erstellen"}</button>
        </DialogContent>
      </Dialog>
      <Dialog open={showLegacy} onOpenChange={setShowLegacy}>
        <DialogContent className="max-h-[80vh] overflow-y-auto"><DialogHeader><DialogTitle>Ältere lokale Tageszettel</DialogTitle><DialogDescription>Diese Daten haben keine sichere Kontozuordnung. Übernimm sie nur, wenn sie dir gehören. Bereits vorhandene Tage werden beibehalten.</DialogDescription></DialogHeader>
          {Object.entries(legacyData).map(([day, data]) => <div key={day} className="rounded border p-2 text-xs"><strong>{formatDate(day)}</strong><p className="whitespace-pre-wrap">{stripHtml(data.html)}</p></div>)}
          <button className="rounded border px-3 py-2" onClick={() => {
            ds.setStore(prev => ({ ...legacyData, ...prev }));
            try {
              const recurring = JSON.parse(localStorage.getItem(RECURRING_STORAGE_KEY) || "[]");
              if (!ds.recurringItems.length && Array.isArray(recurring)) ds.setRecurringItems(recurring.map(item => typeof item === "string" ? { id: crypto.randomUUID(), text: item, weekday: "all" as const } : item));
              const templates = localStorage.getItem(DAY_TEMPLATE_STORAGE_KEY);
              if (templates && ds.dayTemplates === DEFAULT_DAY_TEMPLATES) ds.setDayTemplates(normalizeDayTemplates(JSON.parse(templates)));
            } catch { toast.error("Die älteren Einstellungen konnten nicht übernommen werden."); }
            setLegacyImported(true); setShowLegacy(false); toast.success("Fehlende Tage übernommen. Die ursprünglichen lokalen Daten bleiben erhalten.");
          }}>Diese Daten gehören mir – fehlende Tage übernehmen</button>
        </DialogContent>
      </Dialog>

      {completionMessage && (
        <div className="fixed bottom-24 right-6 z-50 rounded-lg border border-palette-green/40 bg-palette-green/10 px-3 py-1.5 text-xs text-palette-green shadow-lg backdrop-blur">{completionMessage}</div>
      )}

      {!(docked && open) && <button type="button" className={cn(
        "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border shadow-lg backdrop-blur transition-[transform,background-color,box-shadow] duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDraggingToDaySlip && canDropToDaySlip
          ? "border-palette-green bg-palette-green text-white ring-4 ring-palette-green/30 scale-110"
          : "border-border/70 bg-background/90 hover:bg-muted",
        isDraggingToDaySlip && canDropToDaySlip && isOverDaySlipButton && "scale-125 ring-8 ring-palette-green/40 shadow-xl",
      )} aria-label={isDraggingToDaySlip && canDropToDaySlip ? "Zum Tageszettel hinzufügen" : "Tageszettel öffnen (Strg+Alt+J)"} onClick={() => setOpen((prev: boolean) => !prev)} onDragOver={handleDaySlipButtonDragOver} onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOverDaySlipButton(false);
      }} onDrop={handleDaySlipButtonDrop}>
        {isDraggingToDaySlip && canDropToDaySlip ? <>
          <Plus className="pointer-events-none h-9 w-9" strokeWidth={3} aria-hidden="true" />
          <span className="pointer-events-none absolute bottom-full right-0 mb-4 whitespace-nowrap rounded-lg bg-popover px-3 py-2 text-xs font-medium text-popover-foreground shadow-lg border border-palette-green/40">{isOverDaySlipButton ? "Loslassen zum Hinzufügen" : "Hier zum Tageszettel hinzufügen"}</span>
        </> : showCompletePulse ? <Check className="h-5 w-5 text-palette-green" /> : <ClipboardPen className="h-5 w-5" />}
        {ds.unresolvedCount > 0 && !(isDraggingToDaySlip && canDropToDaySlip) && <span className="pointer-events-none absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-palette-green px-1 text-[10px] font-semibold text-white">{ds.unresolvedCount}</span>}
      </button>}
    </>
  );
}
