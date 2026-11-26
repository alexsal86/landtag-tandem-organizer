import { DaySlipAppointments } from "./DaySlipAppointments";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DAY_SLIP_APPEND_EVENT, withDaySlipSourceIcon, type DaySlipAppendDetail } from "@/lib/daySlipBridge";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useTenantUsers } from "@/hooks/useTenantUsers";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { sourcePath, normalizeStore, emptyDay, missingDaySlipLines } from "./daySlipState";
import { resolveDayView, openPastDays, openLineCount, snoozePresets } from "./daySlipNavigation";
import { parseDaySlipLine } from "./daySlipShorthand";
import { archiveNeighbours, archiveStatusLabel, buildArchiveEntry, filterArchive } from "./daySlipArchive";
import type { DaySlipSource } from "./dayslipTypes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Check, ClipboardPen, Clock3, Folder, FolderArchive, ListTodo, NotebookPen,
  Pencil, Plus, Scale, Settings, Trash2, X, ExternalLink, RotateCcw, PanelRightClose, PanelRightOpen, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { WeeklyRoutineGrid } from "@/components/dayslip/WeeklyRoutineGrid";
import { WeekPlanningBanner } from "@/components/dayslip/WeekPlanningBanner";
import { DaySlipLexicalEditor } from "@/components/dayslip/DaySlipLexicalEditor";
import { DaySlipCommandHelp } from "@/components/dayslip/DaySlipCommandHelp";
import { DaySlipPages } from "@/components/dayslip/DaySlipPages";
import { DaySlipMoodTrend } from "@/components/dayslip/DaySlipMoodTrend";
import { useDaySlipLayout } from "@/components/dayslip/DaySlipLayout";
import { useDaySlipStore } from "@/components/dayslip/hooks/useDaySlipStore";
import {
  type DayTemplate, type TaskOptions,
  WEEK_DAYS, WEEK_DAY_LABELS, DEFAULT_DAY_TEMPLATES,
  STORAGE_KEY, RECURRING_STORAGE_KEY, DAY_TEMPLATE_STORAGE_KEY, formatDate, stripHtml, isRuleLine, formatTimeStamp, normalizeDayTemplates,
} from "@/components/dayslip/dayslipTypes";

const archiveBadgeClass = (status: "done" | "assigned" | "snoozed" | "open") =>
  status === "done" ? "border-palette-green/40 bg-palette-green/10 text-palette-green"
    : status === "assigned" ? "border-primary/40 bg-primary/10 text-primary"
      : status === "snoozed" ? "border-palette-amber/40 bg-palette-amber/10 text-palette-amber"
        : "border-border/60 text-muted-foreground";

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

  useEffect(() => {
    if (!open) return;
    const media = window.matchMedia("(max-width: 1023px)");
    const previousOverflow = document.body.style.overflow;
    const updateScrollLock = () => {
      document.body.style.overflow = media.matches ? "hidden" : previousOverflow;
    };
    updateScrollLock();
    media.addEventListener("change", updateScrollLock);
    return () => {
      media.removeEventListener("change", updateScrollLock);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const [showArchive, setShowArchive] = useState(false);
  const [archiveQuery, setArchiveQuery] = useState("");
  const [archiveCursor, setArchiveCursor] = useState<string | null>(null);
  const [archiveNotice, setArchiveNotice] = useState<string | null>(null);
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

  // Past sheets stay reachable, including days that were never completed.
  const [viewKey, setViewKey] = useState(() => ds.todayKey);
  useEffect(() => { setViewKey(ds.todayKey); }, [ds.todayKey]);
  useEffect(() => { if (!open) setViewKey(ds.todayKey); }, [open, ds.todayKey]);
  const dayView = useMemo(() => resolveDayView(ds.store, ds.todayKey, viewKey), [ds.store, ds.todayKey, viewKey]);
  const viewDay = useMemo(() => ds.store[dayView.key] ?? emptyDay(), [ds.store, dayView.key]);
  const viewOpenCount = useMemo(() => openLineCount(viewDay), [viewDay]);
  // Planned lines the automatic start decision left out because today's slip had already begun.
  const missingPlanLines = useMemo(() => {
    if (!ds.weekPlan?.applied || !ds.todayData.weekPlanInjected) return [];
    return missingDaySlipLines(ds.todayData, ds.weekPlan.days[ds.todayKey] ?? []);
  }, [ds.weekPlan, ds.todayData, ds.todayKey]);
  const pastOpenDays = useMemo(() => openPastDays(ds.store, ds.todayKey), [ds.store, ds.todayKey]);
  const snoozeOptions = useMemo(() => snoozePresets(ds.todayKey), [ds.todayKey]);

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

  // Done and priority live on the node; only the timestamp tooltip still needs the DOM.
  const timestampSignature = JSON.stringify(viewDay.lineTimestamps ?? {});
  useEffect(() => {
    if (!ds.editorRef.current) return;
    const stamps = viewDay.lineTimestamps ?? {};
    requestAnimationFrame(() => {
      document.querySelectorAll<HTMLElement>(".day-slip-item").forEach((node) => {
        const stamp = stamps[node.dataset.lineId ?? ""];
        node.title = stamp ? `Erfasst: ${formatTimeStamp(stamp.addedAt)} · Abgehakt: ${formatTimeStamp(stamp.checkedAt)}` : "";
      });
    });
  }, [ds.editorRef, timestampSignature, viewDay.lineTimestamps, ds.editorReadyVersion]);

  // Changes are cached synchronously; closing also asks the queue to flush.
  const animateClosePanel = () => {
    if (ds.isProcessing) return;
    void ds.flush();
    setClosing(true);
    setTimeout(() => { ds.setResolveMode(false); setOpen(false); setClosing(false); }, 220);
  };

  const archiveEntries = useMemo(() => ds.archiveDays.map(key => buildArchiveEntry(key, ds.store[key])), [ds.archiveDays, ds.store]);
  const archiveFiltered = useMemo(() => filterArchive(archiveEntries, archiveQuery), [archiveEntries, archiveQuery]);
  const archiveCursorKey = archiveFiltered.some(entry => entry.key === archiveCursor) ? archiveCursor! : archiveFiltered[0]?.key;
  const archiveNav = archiveNeighbours(archiveFiltered, archiveCursorKey ?? "");
  const openArchiveDay = (key: string) => { setArchiveNotice(null); setViewKey(key); switchView("default"); };

  /** Typed line shortcuts prefill the existing triage; nothing is created without that step. */
  const applyLineShortcuts = useCallback(() => {
    if (!ds.ready || ds.isProcessing) return;
    const users = tenantUsers.map(person => ({ id: person.id, name: person.display_name }));
    for (const line of ds.openLines) {
      const parsed = parseDaySlipLine(line.text, { todayKey: ds.todayKey, users });
      if (!parsed.kind || !parsed.text) continue;
      ds.toggleResolveLine(line.id, parsed.text, parsed.kind, undefined, {
        ...(parsed.person ? { assignedTo: parsed.person.id } : {}),
        ...(parsed.dueDate ? { dueDate: parsed.dueDate } : {}),
      });
    }
  }, [ds, tenantUsers]);

  const completeDay = async () => {
    if (closingRef.current || ds.isProcessing) return;
    if (ds.resolveMode && ds.unresolvedCount > 0) { ds.setResolveMode(false); return; }
    if (ds.unresolvedCount > 0) { applyLineShortcuts(); ds.setResolveMode(true); return; }
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
    if (!dayView.isToday) setViewKey(ds.todayKey);
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
  }, [ds, dayView.isToday]);

  useEffect(() => {
    const onAppend = (event: Event) => {
      const detail = (event as CustomEvent<DaySlipAppendDetail>).detail;
      const text = detail?.text?.trim();
      if (!text) return;
      if (ds.todayData.completedAt || !ds.ready || ds.isProcessing) { toast.info("Bitte den Tageszettel zuerst öffnen und den Tag gegebenenfalls wieder öffnen."); return; }
      if (!dayView.isToday) setViewKey(ds.todayKey);
      ds.appendLinesToToday([withDaySlipSourceIcon(text, detail.source)], detail.source);
      toast.success("Auf den Tageszettel gesetzt");
    };
    window.addEventListener(DAY_SLIP_APPEND_EVENT, onAppend);
    return () => window.removeEventListener(DAY_SLIP_APPEND_EVENT, onAppend);
  }, [ds, dayView.isToday]);

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
    if (!dayView.isToday || ds.todayData.completedAt || ds.isProcessing) return;
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
  }, [ds, navigate, dayView.isToday]);

  const handleEditorContextMenu = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!dayView.isToday || ds.todayData.completedAt || ds.isProcessing) return;
    const target = e.target as HTMLElement;
    const item = target.closest(".day-slip-item") as HTMLElement | null;
    if (!item) return;
    const lineId = item.dataset.lineId;
    const text = (item.textContent ?? "").trim();
    if (!lineId || !text || isRuleLine(text)) return;
    e.preventDefault();
    setLineContextMenu({ x: e.clientX, y: e.clientY, lineId, text });
  }, [ds.todayData.completedAt, ds.isProcessing, dayView.isToday]);

  // The editor is a record while a past day is open; only today accepts changes.
  const handleEditorChange = useCallback((...args: Parameters<typeof ds.onEditorChange>) => {
    if (!dayView.isToday) return;
    ds.onEditorChange(...args);
  }, [dayView.isToday, ds]);

  const toggleLineFromKeyboard = useCallback((lineId: string) => {
    if (!dayView.isToday || ds.todayData.completedAt || ds.isProcessing) return;
    ds.toggleStrike(lineId);
  }, [dayView.isToday, ds]);

  const handleDeleteLine = useCallback((lineId: string, text: string) => {
    setLineContextMenu(null);
    const removed = ds.deleteLine(lineId);
    if (!removed) { toast.info("Bereits verknüpfte Zeilen bleiben erhalten."); return; }
    toast("Zeile gelöscht", { description: text, duration: 8000, action: { label: "Rückgängig", onClick: () => ds.restoreLine(removed) } });
  }, [ds]);

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
    ds.setWeekdayTemplates((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next) as Array<keyof typeof next>) if (next[key] === templateId) delete next[key];
      return next;
    });
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
            docked ? "relative h-full w-full border-y-0 border-r-0" : "fixed inset-0 z-50 h-dvh w-full overflow-hidden border-0 bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] lg:inset-auto lg:bottom-24 lg:right-6 lg:h-[min(84vh,920px)] lg:max-w-[calc(100vw-1rem)] lg:rounded-2xl lg:border lg:bg-background/95 lg:shadow-2xl",
            // Ohne Andockplatz schwebt der Zettel über dem Inhalt und startet dort
            // schmaler, damit mehr vom Inhalt sichtbar bleibt.
            !docked && (layout?.desktop && !layout.canDock ? "lg:w-[min(24rem,calc(100vw-3rem))]" : "lg:w-[min(35rem,calc(100vw-3rem))]"),
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
          <div className="border-b border-border/60 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-lg font-semibold"><ClipboardPen className="h-5 w-5" /> Tageszettel</p>
                <p className="truncate text-xs text-muted-foreground">{formatDate(dayView.key)}</p>
                {/* Der Pin ist ohne Andockplatz deaktiviert; der Hinweis nennt den Grund sichtbar. */}
                {!docked && layout?.desktop && !layout.canDock && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Schwebt über dem Inhalt – Andocken ab {layout.minDockWidth} px</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <DaySlipCommandHelp />
                {layout?.desktop && <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent" onClick={() => layout.setDocked(!docked)} disabled={!layout.canDock} aria-label={docked ? "Tageszettel schwebend anzeigen" : "Tageszettel rechts andocken"} title={!layout.canDock ? `Andocken erst ab ${layout.minDockWidth} px Fensterbreite, damit der Inhalt lesbar bleibt` : docked ? "Schwebend anzeigen" : "Rechts andocken"}>
                  {docked ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                </button>}
                <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => switchView(showSettings ? "default" : "settings")} aria-label="Einstellungen anzeigen"><Settings className="h-4 w-4" /></button>
                <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => switchView(showArchive ? "default" : "archive")} aria-label="Archiv anzeigen"><Folder className="h-4 w-4" /></button>
                <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={animateClosePanel} aria-label="Panel schließen"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40" disabled={!dayView.canGoPrevious} onClick={() => { if (dayView.previousKey) setViewKey(dayView.previousKey); }} aria-label="Vorheriger Tageszettel" title="Vorheriger gespeicherter Tag"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40" disabled={!dayView.canGoNext} onClick={() => { if (dayView.nextKey) setViewKey(dayView.nextKey); }} aria-label="Nächster Tageszettel" title="Nächster gespeicherter Tag"><ChevronRight className="h-4 w-4" /></button>
                <span className={cn("rounded border px-1.5 py-0.5 text-[10px]", dayView.isToday ? "border-border/60 text-muted-foreground" : dayView.completedAt ? "border-palette-green/40 bg-palette-green/10 text-palette-green" : "border-palette-amber/40 bg-palette-amber/10 text-palette-amber")}>
                  {dayView.isToday ? "Heute" : dayView.completedAt ? "Abgeschlossen" : "Nicht abgeschlossen"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {pastOpenDays.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="rounded border border-palette-amber/40 bg-palette-amber/10 px-2 py-0.5 text-[11px] text-palette-amber hover:bg-palette-amber/20">
                        {pastOpenDays.length} offene {pastOpenDays.length === 1 ? "Vortag" : "Vortage"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-1" align="end" sideOffset={4}>
                      <p className="px-2 py-1 text-[11px] text-muted-foreground">Tage ohne Abschluss mit offenen Punkten</p>
                      <div className="max-h-64 overflow-y-auto">
                        {pastOpenDays.map(entry => (
                          <button key={entry.dayKey} type="button" className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => setViewKey(entry.dayKey)}>
                            <span>{formatDate(entry.dayKey)}</span>
                            <span className="text-muted-foreground">{entry.openCount} offen</span>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                {!dayView.isToday && <button type="button" className="rounded border border-border/60 px-2 py-0.5 text-[11px] hover:bg-muted" onClick={() => setViewKey(ds.todayKey)}>Heute</button>}
              </div>
            </div>
          </div>

          {dayView.isToday && <div className="border-b px-4 py-2 text-xs" role="status" aria-live="polite">
            {ds.saveStatus === "loading" ? "Tageszettel wird geladen …" : ds.saveStatus === "saving" ? "Speichert …" : ds.saveStatus === "saved" ? "Gespeichert" : "Speichern fehlgeschlagen"}
            {ds.saveStatus === "error" && <><p className="mt-1 text-destructive">{ds.saveError}</p><button className="mt-1 underline" onClick={() => void ds.retrySave()}>Erneut versuchen</button></>}
            {ds.deadlineError && <p className="mt-1 text-destructive">Fristen konnten nicht aktualisiert werden. Die Aktualisierung wird erneut versucht.</p>}
          </div>}
          {!showArchive && !showSettings && dayView.isToday && <DaySlipAppointments />}
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
                <p className="text-xs text-muted-foreground">Fügt vordefinierte Blöcke inkl. HR-Trennlinien ein. Die Wochentag-Zuordnung wird nur an noch leeren, unbegonnenen Tagen automatisch übernommen.</p>
                <div className="space-y-1 rounded border border-border/50 p-2">
                  <p className="text-[11px] font-medium">Automatisch je Wochentag</p>
                  <p className="text-[11px] text-muted-foreground">Zum Beispiel Dienstag = Plenartag, Donnerstag = Ausschuss. Gilt einmal pro Tag und nur an noch leeren Zetteln; begonnene Zettel bleiben auch nach späterem Leeren unverändert.</p>
                  <p className="text-[11px] text-muted-foreground">
                    {ds.todayData.dayTemplateInjected
                      ? "Für heute ist die Entscheidung gefallen: automatisch kommt keine Vorlage mehr dazu. Jede Vorlage bleibt manuell wählbar."
                      : "Beim ersten Öffnen eines noch leeren Zettels wird die Vorlage für heute automatisch eingefügt."}
                  </p>
                  {WEEK_DAYS.filter((day) => day !== "all").map((day) => (
                    <label key={day} className="flex items-center gap-2 text-xs">
                      <span className="w-20 shrink-0">{WEEK_DAY_LABELS[day]}</span>
                      <select
                        aria-label={`Vorlage für ${WEEK_DAY_LABELS[day]}`}
                        className="h-7 flex-1 rounded border border-border/60 bg-background px-1 text-xs"
                        value={ds.weekdayTemplates[day] ?? ""}
                        onChange={(event) => ds.setWeekdayTemplates((prev) => ({ ...prev, [day]: event.target.value || undefined }))}
                      >
                        <option value="">Keine Vorlage</option>
                        {ds.dayTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
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
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Archiv (nur lesen)</p>
                <div className="flex items-center gap-1">
                  <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40" aria-label="Vorheriger Archivtag" title="Älterer Archivtag" disabled={!archiveNav.previousKey} onClick={() => archiveNav.previousKey && setArchiveCursor(archiveNav.previousKey)}><ChevronLeft className="h-4 w-4" /></button>
                  <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40" aria-label="Nächster Archivtag" title="Neuerer Archivtag" disabled={!archiveNav.nextKey} onClick={() => archiveNav.nextKey && setArchiveCursor(archiveNav.nextKey)}><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
              <input aria-label="Archiv durchsuchen" type="search" value={archiveQuery} onChange={event => setArchiveQuery(event.target.value)} placeholder="Text oder Datum suchen" className="h-8 w-full rounded border border-border/60 bg-background px-2 text-xs" />
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-[11px] text-muted-foreground" htmlFor="archive-date-jump">Zu Datum springen</label>
                <input id="archive-date-jump" aria-label="Archivdatum" type="date" className="h-8 rounded border border-border/60 bg-background px-2 text-xs" onChange={event => {
                  const key = event.target.value;
                  if (!key) return;
                  if (!ds.store[key]) { setArchiveNotice(`Kein Zettel am ${formatDate(key)}.`); return; }
                  openArchiveDay(key);
                }} />
                {archiveNotice && <span role="status" className="text-[11px] text-palette-amber">{archiveNotice}</span>}
              </div>
              {archiveEntries.length === 0 && <p className="text-sm text-muted-foreground">Noch keine abgeschlossenen Tage.</p>}
              {archiveEntries.length > 0 && archiveFiltered.length === 0 && <p className="text-sm text-muted-foreground">Kein abgeschlossener Tag passt zu „{archiveQuery}“.</p>}
              {archiveFiltered.map((entry) => {
                const dayData = ds.store[entry.key];
                const moodMap = ["😞", "🙁", "😐", "🙂", "😄"] as const;
                const mood = dayData?.dayMood ? moodMap[dayData.dayMood - 1] : "—";
                const completedInfo = dayData?.completedAt ? `Abgeschlossen um ${new Date(dayData.completedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` : "Nicht explizit abgeschlossen";
                return (
                  <div key={entry.key} className={cn("rounded-lg border p-3", entry.key === archiveCursorKey ? "border-primary/50 bg-primary/5" : "border-border/60")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{entry.label}</p>
                        <p className="text-[11px] text-muted-foreground/90">{completedInfo} · {entry.counts.done} erledigt · {entry.counts.assigned} zugewiesen{entry.counts.snoozed > 0 ? ` · ${entry.counts.snoozed} Wiedervorlage` : ""} · {entry.counts.open} offen · Stimmung: {mood}</p>
                      </div>
                      <button type="button" className="shrink-0 rounded border border-border/60 px-2 py-0.5 text-[11px] hover:bg-muted" onClick={() => openArchiveDay(entry.key)}>Öffnen</button>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {entry.lines.length === 0 && <li className="text-sm text-muted-foreground">—</li>}
                      {entry.lines.map((line) => (
                        <li key={line.id} className="flex items-start justify-between gap-2 text-sm">
                          <span className={cn("min-w-0 break-words", line.status === "done" && "text-muted-foreground line-through")}>{line.text}</span>
                          <span className={cn("shrink-0 rounded border px-1.5 py-0.5 text-[10px]", archiveBadgeClass(line.status))}>{archiveStatusLabel(line)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : !dayView.isToday ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-border/60 bg-muted/30 px-4 py-2 text-xs" role="status">
                {dayView.completedAt
                  ? <>Abgeschlossen am {new Date(dayView.completedAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}</>
                  : <>Nicht abgeschlossen. {viewOpenCount > 0
                    ? `${viewOpenCount} offene ${viewOpenCount === 1 ? "Punkt wird" : "Punkte werden"} dir heute zur Übernahme angeboten.`
                    : "Alle Punkte sind abgehakt oder zugewiesen."}</>}
              </div>
              <DaySlipLexicalEditor
                key={`editor-view-${dayView.key}`}
                readOnly
                hidden={false}
                initialHtml={viewDay.html}
                initialNodes={viewDay.nodes}
                dayKey={dayView.key}
                doneLineIds={viewDay.struckLineIds ?? viewDay.struckLines}
                resolveMode={false}
                editorConfig={ds.editorConfig}
                onEditorChange={() => { /* Past days are a record and never accept edits. */ }}
                onEditorReady={ds.handleEditorReady}
                onEditorClick={handleEditorClick}
                onEditorContextMenu={handleEditorContextMenu}
                onDrop={handleDropToDaySlip}
              />
              {viewOpenCount === 0 && <p className="px-4 py-3 text-xs text-muted-foreground">Keine offenen Punkte an diesem Tag.</p>}
            </div>
          ) : (
            <div className={`flex min-h-0 flex-1 flex-col transition-all duration-300 ease-out ${contentTransitioning ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"}`}>
              {!ds.todayData.completedAt && <WeekPlanningBanner key={`week-${ds.todayKey}`} recurringItems={ds.recurringItems} weekPlan={ds.weekPlan} onChangePlan={ds.setWeekPlan} />}
              {!ds.todayData.completedAt && missingPlanLines.length > 0 && (
                <div className="border-b border-primary/30 bg-primary/5 px-4 py-2 text-sm" role="status">
                  <p>
                    <span className="font-semibold">Wochenplan für heute:</span>{" "}
                    {missingPlanLines.length === 1 ? "1 geplante Zeile fehlt" : `${missingPlanLines.length} geplante Zeilen fehlen`}{" "}
                    <span className="text-muted-foreground">– sie wurden nicht automatisch ergänzt, weil der Zettel heute bereits begonnen war.</span>
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-muted-foreground" title={missingPlanLines.join(" · ")}>{missingPlanLines.join(" · ")}</span>
                    <button
                      type="button"
                      className="shrink-0 rounded border border-primary/40 bg-primary/10 px-2 py-0.5 font-medium text-primary hover:bg-primary/20"
                      onClick={() => ds.appendLinesToToday(missingPlanLines)}
                    >
                      Jetzt nachtragen
                    </button>
                  </div>
                </div>
              )}
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
                doneLineIds={ds.struckLineIds}
                resolveMode={ds.resolveMode}
                editorConfig={ds.editorConfig}
                onEditorChange={handleEditorChange}
                onEditorReady={ds.handleEditorReady}
                onEditorClick={handleEditorClick}
                onEditorContextMenu={handleEditorContextMenu}
                onToggleLine={toggleLineFromKeyboard}
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
                            <button type="button" title="Als Notiz" aria-label="Als Notiz" aria-pressed={activeTarget === "note"} className={buttonClass("note")} onClick={() => ds.toggleResolveLine(id, text, "note")}><NotebookPen className="h-4 w-4" /></button>
                            <button type="button" title="Als Aufgabe" aria-label="Als Aufgabe" aria-pressed={activeTarget === "task"} className={buttonClass("task")} onClick={() => ds.toggleResolveLine(id, text, "task")}><ListTodo className="h-4 w-4" /></button>
                            <button type="button" title="Als Entscheidung" aria-label="Als Entscheidung" aria-pressed={activeTarget === "decision"} className={buttonClass("decision")} onClick={() => ds.toggleResolveLine(id, text, "decision")}><Scale className="h-4 w-4" /></button>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button type="button" title="Snoozen" aria-label="Snoozen" aria-pressed={activeTarget === "snoozed"} className={buttonClass("snoozed")}>
                                  <Clock3 className="h-4 w-4" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-1" align="end" sideOffset={4}>
                                <div className="flex flex-col">
                                  {snoozeOptions.map(({ label, until }) => (
                                    <button key={until} type="button" className="rounded px-3 py-1.5 text-left text-sm hover:bg-muted" onClick={() => ds.toggleResolveLine(id, text, "snoozed", until)}>
                                      {label} <span className="text-muted-foreground text-xs">({until})</span>
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                            <button type="button" title="Archivieren" aria-label="Archivieren" aria-pressed={activeTarget === "archived"} className={buttonClass("archived")} onClick={() => ds.toggleResolveLine(id, text, "archived")}><FolderArchive className="h-4 w-4" /></button>
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
                {!ds.todayData.completedAt && <button className="mt-1 underline" onClick={() => { applyLineShortcuts(); ds.setResolveMode(true); }}>Zuordnung prüfen</button>}
              </div>}
              {/* Footer */}
              <div className="shrink-0 p-3">
                <DaySlipMoodTrend
                  key={ds.todayKey}
                  store={ds.store}
                  todayKey={ds.todayKey}
                  moodPicker={ds.resolveMode && (
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
                >
                  {ds.todayData.completedAt ? <div className="space-y-2 rounded border border-palette-green/40 p-3 text-sm">
                    <p>✓ Tag abgeschlossen</p><button className="flex items-center gap-1 underline" onClick={() => void ds.reopenDay()}><RotateCcw className="h-4 w-4" />Tag wieder öffnen</button>
                  </div> : <button type="button" disabled={ds.isProcessing} onClick={() => void completeDay()} className="flex min-h-10 w-full flex-wrap items-center justify-between gap-x-2 rounded-lg border border-palette-green/40 bg-palette-green/10 px-3 py-1 text-left text-sm font-medium text-palette-green">
                    <span>{ds.isProcessing ? "Einträge werden verarbeitet …" : completeButtonLabel}</span>
                    <span className="text-xs opacity-70">{completeButtonHint}</span>
                  </button>}
                </DaySlipMoodTrend>
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
          <button className="flex w-full rounded px-2 py-1 text-left text-sm text-destructive hover:bg-destructive/10" onClick={() => handleDeleteLine(lineContextMenu.lineId, lineContextMenu.text)}>Löschen</button>
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
        open && "max-lg:hidden",
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
