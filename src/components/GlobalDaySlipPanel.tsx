import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { $createTextNode, $getRoot } from "lexical";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import {
  Check, ChevronDown, ClipboardPen, Clock3, Folder, FolderArchive, ListTodo, NotebookPen,
  Pencil, Scale, Settings, Trash2, X,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { WeeklyRoutineGrid } from "@/components/dayslip/WeeklyRoutineGrid";
import { WeekPlanningBanner } from "@/components/dayslip/WeekPlanningBanner";
import { DaySlipLexicalEditor } from "@/components/dayslip/DaySlipLexicalEditor";
import { $createDaySlipLineNode, DaySlipLineNode } from "@/components/DaySlipLineNode";
import { useDaySlipStore } from "@/components/dayslip/hooks/useDaySlipStore";
import {
  type DayTemplate, type RecurringTemplate,
  WEEK_DAYS, WEEK_DAY_LABELS, DEFAULT_DAY_TEMPLATES,
  STORAGE_KEY, formatDate, stripHtml, isRuleLine, formatTimeStamp, normalizeLineText,
} from "@/components/dayslip/dayslipTypes";

export function GlobalDaySlipPanel() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const [open, setOpen] = useState(() => {
    try { const saved = localStorage.getItem('day-slip-panel-open'); return saved !== null ? JSON.parse(saved) : false; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem('day-slip-panel-open', JSON.stringify(open)); } catch {} }, [open]);

  const [showArchive, setShowArchive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [closing, setClosing] = useState(false);
  const [contentTransitioning, setContentTransitioning] = useState(false);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [showCompletePulse, setShowCompletePulse] = useState(false);
  const [carriedOver, setCarriedOver] = useState(false);

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
  const ds = useDaySlipStore(user?.id, currentTenant?.id);

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
        node.classList.toggle("bg-red-500/10", isHighPriority);
        node.classList.toggle("border", isHighPriority || isPriority);
        node.classList.toggle("border-red-400/40", isHighPriority);
        node.classList.toggle("bg-amber-400/10", isPriority);
        node.classList.toggle("border-amber-400/40", isPriority);
        const stamp = ds.todayData.lineTimestamps?.[lineId];
        node.title = stamp ? `Erfasst: ${formatTimeStamp(stamp.addedAt)} · Abgehakt: ${formatTimeStamp(stamp.checkedAt)}` : "";
      });
    });
  }, [ds.struckLineIds, ds.todayData.html, ds.todayData.lineTimestamps, open, ds.editorReadyVersion]);

  // Panel close flow
  const animateClosePanel = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ds.store)); } catch {}
    clearTimeout(ds.saveTimeoutRef.current as unknown as number | undefined);
    setClosing(true);
    setTimeout(() => { ds.setResolveMode(false); setOpen(false); setClosing(false); setShowCompletePulse(true); setTimeout(() => setShowCompletePulse(false), 500); }, 220);
  };

  const markDayCompleted = async () => {
    if (ds.store[ds.todayKey]?.completedAt) { animateClosePanel(); return; }
    await ds.persistResolvedItems();
    const completedAt = new Date().toISOString();
    ds.setStore((prev) => ({ ...prev, [ds.todayKey]: { ...(prev[ds.todayKey] ?? { html: "", plainText: "", struckLineIds: [] }), completedAt } }));
    setCompletionMessage(`✅ Tag abgeschlossen (${new Date(completedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })})`);
    animateClosePanel();
  };

  const completeDay = () => {
    if (ds.resolveMode && ds.unresolvedCount > 0) { ds.setResolveMode(false); return; }
    if (ds.unresolvedCount > 0) { ds.setResolveMode(true); return; }
    markDayCompleted();
  };

  const carryOverFromYesterday = () => {
    if (ds.yesterdayCarryLines.length === 0) return;
    ds.appendLinesToToday(ds.yesterdayCarryLines.map((l) => l.text));
    const carriedLineIds = new Set(ds.yesterdayCarryLines.map((l) => l.id));
    ds.setStore((prev) => {
      const yd = prev[ds.yesterdayKey];
      if (!yd) return prev;
      const struck = new Set(yd.struckLineIds ?? yd.struckLines ?? []);
      carriedLineIds.forEach((id) => struck.add(id));
      return { ...prev, [ds.yesterdayKey]: { ...yd, struckLineIds: Array.from(struck), resolved: (yd.resolved ?? []).filter((item) => !(item.target === "snoozed" && carriedLineIds.has(item.lineId))) } };
    });
    setCarriedOver(true);
  };

  const handleDropToDaySlip = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const droppedTaskTitle = event.dataTransfer.getData("application/x-mywork-task-title").trim();
    const droppedTaskId = event.dataTransfer.getData("application/x-mywork-task-id").trim();
    const droppedItemType = event.dataTransfer.getData("application/x-mywork-item-type").trim();
    const droppedPlainText = event.dataTransfer.getData("text/plain").trim();
    const rawValue = droppedTaskTitle || droppedPlainText;
    if (!rawValue) return;
    const typeIcons: Record<string, string> = { task: "✅", note: "📝", case: "💼", decision: "🗳️" };
    const icon = (droppedItemType && typeIcons[droppedItemType]) || (droppedTaskTitle ? "✅" : "");
    const withIcon = icon && !rawValue.startsWith(icon) ? `${icon} ${rawValue}` : rawValue;
    if (droppedTaskId && ds.editorRef.current) {
      ds.editorRef.current.update(() => {
        const root = $getRoot();
        const existing = new Set(root.getChildren().map((n) => normalizeLineText(n.getTextContent())).filter((l) => l.length > 0));
        const normalized = normalizeLineText(withIcon);
        if (!normalized || existing.has(normalized)) return;
        const paragraph = $createDaySlipLineNode(undefined, droppedTaskId);
        paragraph.append($createTextNode(withIcon));
        root.append(paragraph);
      });
    } else {
      ds.appendLinesToToday([withIcon]);
    }
    setOpen(true); ds.setResolveMode(false); setShowArchive(false); setShowSettings(false);
  }, [ds.appendLinesToToday]);

  const handleDaySlipButtonDragOver = useCallback((event: DragEvent<HTMLButtonElement>) => {
    const hasDaySlipData = event.dataTransfer.types.includes("application/x-mywork-task-title") || event.dataTransfer.types.includes("text/plain");
    if (!hasDaySlipData) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDaySlipButtonDrop = useCallback((event: DragEvent<HTMLButtonElement>) => {
    handleDropToDaySlip(event as unknown as DragEvent<HTMLElement>);
  }, [handleDropToDaySlip]);

  const handleEditorClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const item = target.closest(".day-slip-item") as HTMLElement | null;
    if (!item) return;
    const rect = item.getBoundingClientRect();
    if (e.clientX - rect.left > 24) return;
    const lineText = (item.textContent ?? "").trim();
    if (!lineText || isRuleLine(lineText)) return;
    const lineId = item.dataset.lineId;
    if (!lineId) return;
    ds.toggleStrike(lineId);
  }, [ds.toggleStrike]);

  const handleEditorContextMenu = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const item = target.closest(".day-slip-item") as HTMLElement | null;
    if (!item) return;
    const lineId = item.dataset.lineId;
    const text = (item.textContent ?? "").trim();
    if (!lineId || !text || isRuleLine(text)) return;
    e.preventDefault();
    setLineContextMenu({ x: e.clientX, y: e.clientY, lineId, text });
  }, []);

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
  }, []);

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
        <aside
          className={`fixed bottom-24 right-6 z-50 flex h-[min(84vh,920px)] w-[calc(100vw-1rem)] sm:w-[min(24rem,calc(100vw-2rem))] lg:w-[min(35rem,calc(100vw-3rem))] max-w-[calc(100vw-1rem)] flex-col rounded-2xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur transition-all duration-300 ease-out ${closing ? "translate-y-3 opacity-0" : "translate-y-0 opacity-100"}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDropToDaySlip}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div>
              <p className="flex items-center gap-2 text-lg font-semibold"><ClipboardPen className="h-5 w-5" /> Tageszettel</p>
              <p className="text-xs text-muted-foreground">{formatDate(ds.todayKey)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => switchView(showSettings ? "default" : "settings")} aria-label="Einstellungen anzeigen"><Settings className="h-4 w-4" /></button>
              <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => switchView(showArchive ? "default" : "archive")} aria-label="Archiv anzeigen"><Folder className="h-4 w-4" /></button>
              <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={animateClosePanel} aria-label="Panel schließen"><X className="h-4 w-4" /></button>
            </div>
          </div>

          {showSettings ? (
            <div className={`flex-1 space-y-4 overflow-y-auto p-4 transition-all duration-300 ease-out ${contentTransitioning ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"}`}>
              <div><p className="text-sm font-medium">Einstellungen</p><p className="text-xs text-muted-foreground">Wiederkehrende Punkte verwalten</p></div>
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
              <WeekPlanningBanner recurringItems={ds.recurringItems} onApplyPlan={ds.handleApplyWeekPlan} />
              {ds.yesterdayCarryLines.length > 0 && !carriedOver && (
                <div className="border-b border-amber-300/60 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
                  <span className="font-semibold">Gestern noch offen:</span>{" "}&ldquo;{ds.yesterdayCarryLines[0].text}&rdquo;{ds.yesterdayCarryLines.length > 1 ? ` +${ds.yesterdayCarryLines.length - 1}` : ""}
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-amber-700 dark:text-amber-100/80">
                    <span>Es werden offene und gesnoozte Punkte von gestern angeboten.</span>
                    <button type="button" className="rounded border border-amber-300/80 px-2 py-0.5 hover:bg-amber-100 dark:border-amber-300/40 dark:hover:bg-amber-400/10" onClick={carryOverFromYesterday}>In heute übernehmen</button>
                  </div>
                </div>
              )}

              <DaySlipLexicalEditor
                key={ds.todayKey}
                hidden={ds.resolveMode && ds.triageEntries.length > 0}
                initialHtml={ds.todayData.html}
                initialNodes={ds.todayData.nodes}
                dayKey={ds.todayKey}
                resolveMode={ds.resolveMode}
                editorConfig={ds.editorConfig as any}
                onEditorChange={ds.onEditorChange}
                onEditorReady={ds.handleEditorReady}
                onEditorClick={handleEditorClick}
                onEditorContextMenu={handleEditorContextMenu}
                onDrop={handleDropToDaySlip}
              />

              {ds.resolveMode && ds.triageEntries.length > 0 && (
                <div className="flex-1 border-b border-border/60">
                  <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
                    <p className="text-sm font-medium">
                      {ds.unresolvedCount > 0 ? `${ds.unresolvedCount} ${ds.unresolvedCount === 1 ? "Eintrag" : "Einträge"} noch offen – was soll damit passieren?` : "Alle Einträge sind zugewiesen. Du kannst den Tag jetzt abschließen."}
                    </p>
                  </div>
                  <div className="h-full space-y-2 overflow-y-auto p-4">
                    {ds.unresolvedCount === 0 && (
                      <p className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200">✓ Alle offenen Punkte wurden zugewiesen. Mit dem Button unten wird der Tag abgeschlossen.</p>
                    )}
                    {ds.triageEntries.map(({ id, text }) => {
                      const activeTarget = ds.resolvedByLineId.get(id);
                      const buttonClass = (target: string) => `rounded p-1 transition-colors ${activeTarget === target ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/50" : "hover:bg-muted"}`;
                      const stamp = ds.todayData.lineTimestamps?.[id];
                      const isHighPriority = /^!!\s*/.test(text);
                      const isPriority = !isHighPriority && /^!\s*/.test(text);
                      return (
                        <div key={id} className={cn("flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 text-sm", isHighPriority && "bg-red-500/10 border-red-400/40", isPriority && "bg-amber-400/10 border-amber-400/40")}>
                          <div className="flex flex-1 flex-col">
                            <span className="line-clamp-1">{text}</span>
                            <span className="text-[10px] text-muted-foreground">Erfasst {formatTimeStamp(stamp?.addedAt)} · Abgehakt {formatTimeStamp(stamp?.checkedAt)}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button type="button" title="Als Notiz" className={buttonClass("note")} onClick={() => ds.toggleResolveLine(id, text, "note")}><NotebookPen className="h-4 w-4" /></button>
                            <button type="button" title="Als Aufgabe" className={buttonClass("task")} onClick={() => ds.toggleResolveLine(id, text, "task")}><ListTodo className="h-4 w-4" /></button>
                            <button type="button" title="Als Entscheidung" className={buttonClass("decision")} onClick={() => ds.toggleResolveLine(id, text, "decision")}><Scale className="h-4 w-4" /></button>
                            <button type="button" title="Snoozen" className={buttonClass("snoozed")} onClick={() => ds.toggleResolveLine(id, text, "snoozed")}><Clock3 className="h-4 w-4" /></button>
                            <button type="button" title="Archivieren" className={buttonClass("archived")} onClick={() => ds.toggleResolveLine(id, text, "archived")}><FolderArchive className="h-4 w-4" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="space-y-2 p-3">
                {ds.resolveMode && (
                  <div className="rounded-lg border border-border/60 px-3 py-2">
                    <p className="mb-1 text-[11px] text-muted-foreground">Wie war dein Tag?</p>
                    <div className="flex items-center justify-between">
                      {["😞", "🙁", "😐", "🙂", "😄"].map((mood, index) => (
                        <button key={mood} type="button" className={cn("rounded px-1.5 py-1 text-lg transition hover:bg-muted", ds.todayData.dayMood === (index + 1) ? "bg-emerald-500/20 ring-1 ring-emerald-400/50" : "opacity-70")}
                          onClick={() => ds.setStore((prev) => ({ ...prev, [ds.todayKey]: { ...(prev[ds.todayKey] ?? { html: "", plainText: "", struckLineIds: [] }), dayMood: (index + 1) as 1 | 2 | 3 | 4 | 5 } }))}>{mood}</button>
                      ))}
                    </div>
                  </div>
                )}
                <button type="button" onClick={completeDay} className="flex h-10 w-full items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-medium text-emerald-800 dark:border-emerald-300/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                  <span>{completeButtonLabel}</span>
                  <span className="text-xs opacity-70">{completeButtonHint}</span>
                </button>
              </div>
            </div>
          )}
        </aside>
      )}

      {lineContextMenu && (
        <div className="fixed z-[70] min-w-44 rounded-md border border-border bg-popover p-1 shadow-xl" style={{ left: lineContextMenu.x, top: lineContextMenu.y }}>
          <button className="flex w-full rounded px-2 py-1 text-left text-sm hover:bg-accent" onClick={async () => { await ds.createFromLine(lineContextMenu.text, "task"); setLineContextMenu(null); }}>Als Aufgabe erstellen</button>
          <button className="flex w-full rounded px-2 py-1 text-left text-sm hover:bg-accent" onClick={async () => { await ds.createFromLine(lineContextMenu.text, "note"); setLineContextMenu(null); }}>Als Notiz speichern</button>
          <button className="flex w-full rounded px-2 py-1 text-left text-sm hover:bg-accent" onClick={() => { ds.toggleResolveLine(lineContextMenu.lineId, lineContextMenu.text, "snoozed"); setLineContextMenu(null); }}>Snoozen</button>
          <button className="flex w-full rounded px-2 py-1 text-left text-sm text-destructive hover:bg-destructive/10" onClick={() => { ds.deleteLine(lineContextMenu.lineId); setLineContextMenu(null); }}>Löschen</button>
        </div>
      )}

      {completionMessage && (
        <div className="fixed bottom-24 right-6 z-50 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800 shadow-lg backdrop-blur dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-100">{completionMessage}</div>
      )}

      <button type="button" className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/90 shadow-lg backdrop-blur hover:bg-muted" aria-label="Tageszettel öffnen (Strg+Alt+J)" onClick={() => setOpen((prev: boolean) => !prev)} onDragOver={handleDaySlipButtonDragOver} onDrop={handleDaySlipButtonDrop}>
        {showCompletePulse ? <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-300" /> : <ClipboardPen className="h-5 w-5" />}
        {ds.unresolvedCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-semibold text-white">{ds.unresolvedCount}</span>}
      </button>
    </>
  );
}
