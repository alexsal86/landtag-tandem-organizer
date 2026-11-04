import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { $getRoot, ParagraphNode, type EditorState, type LexicalEditor } from "lexical";
import { $generateHtmlFromNodes } from "@lexical/html";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import { DaySlipLineNode, $createDaySlipLineNode } from "@/components/lexical/DaySlipLineNode";
import { LabeledHorizontalRuleNode } from "@/components/lexical/LabeledHorizontalRuleNode";
import { useDaySlipPersistence } from "./useDaySlipPersistence";
import {
  type DaySlipDayData, type DaySlipLineEntry, type DaySlipSource,
  type ResolvedItem, type ResolveTarget, type TaskOptions, type DaySlipSettings,
  toDayKey, extractLinesFromHtml, parseRuleLine, toParagraphHtml, toRuleHtml, weekdayKey,
} from "../dayslipTypes";
import { appendEntries, carryLines, collectCarryLines, emptyDay, exportId } from "../daySlipState";

const errorMessage = (error: unknown) => error && typeof error === "object" && "message" in error ? String(error.message) : String(error);

export function useDaySlipStore(userId: string, tenantId: string) {
  const persistence = useDaySlipPersistence(userId, tenantId);
  const { store, storeRef, setStore, settings, setSettings, ready, flush } = persistence;
  const [resolveMode, setResolveMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const processing = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const editorRef = useRef<LexicalEditor | null>(null);
  const [editorReadyVersion, setEditorReadyVersion] = useState(0);
  const [editorReloadToken, setEditorReloadToken] = useState(0);
  const [todayKey, setTodayKey] = useState(() => toDayKey(new Date()));
  useEffect(() => {
    const update = () => setTodayKey(toDayKey(new Date()));
    const timer = setInterval(update, 15000);
    window.addEventListener("focus", update);
    return () => { clearInterval(timer); window.removeEventListener("focus", update); };
  }, []);
  useEffect(() => { setResolveMode(false); }, [todayKey]);

  const todayData = store[todayKey] ?? emptyDay();
  const allLineEntries = useMemo(() => extractLinesFromHtml(todayData.html), [todayData.html]);
  const struckLineIds = todayData.struckLineIds ?? todayData.struckLines ?? [];
  const resolvedItems = todayData.resolved ?? [];
  const resolvedByLineId = new Map(resolvedItems.map(item => [item.lineId, item.target]));
  const openLines = allLineEntries.filter(entry => !struckLineIds.includes(entry.id) && !resolvedByLineId.has(entry.id));
  const triageEntries = allLineEntries.filter(entry => openLines.includes(entry) || resolvedByLineId.has(entry.id));
  const carryEntries = useMemo(() => collectCarryLines(store, todayKey), [store, todayKey]);
  const archiveDays = Object.keys(store).filter(key => key < todayKey).sort((a, b) => b.localeCompare(a));

  const changeDay = useCallback((update: (day: DaySlipDayData) => DaySlipDayData, content = false, key = todayKey) => {
    if (!ready || processing.current || storeRef.current[key]?.completedAt) return;
    const prev = storeRef.current;
    const nextDay = update(prev[key] ?? emptyDay());
    if (nextDay === prev[key]) return;
    setStore({ ...prev, [key]: nextDay });
    if (content) setEditorReloadToken(token => token + 1);
  }, [ready, setStore, storeRef, todayKey]);

  const setSetting = useCallback(<K extends keyof DaySlipSettings>(key: K, action: SetStateAction<DaySlipSettings[K]>) => {
    if (!ready) return;
    setSettings(prev => ({ ...prev, [key]: typeof action === "function" ? (action as (value: DaySlipSettings[K]) => DaySlipSettings[K])(prev[key]) : action }));
  }, [ready, setSettings]);
  const setRecurringItems = useCallback((action: SetStateAction<DaySlipSettings["recurringItems"]>) => setSetting("recurringItems", action), [setSetting]);
  const setDayTemplates = useCallback((action: SetStateAction<DaySlipSettings["dayTemplates"]>) => setSetting("dayTemplates", action), [setSetting]);
  const setWeekPlan = useCallback((action: SetStateAction<DaySlipSettings["weekPlan"]>) => setSetting("weekPlan", action), [setSetting]);

  const setLineDone = useCallback((lineId: string, done: boolean, key = todayKey) => {
    changeDay(day => {
      const struck = new Set(day.struckLineIds ?? day.struckLines ?? []);
      if (struck.has(lineId) === done) return day;
      if (done) struck.add(lineId); else struck.delete(lineId);
      const stamp = { ...(day.lineTimestamps?.[lineId] ?? { addedAt: new Date().toISOString() }) };
      if (done) stamp.checkedAt ??= new Date().toISOString(); else delete stamp.checkedAt;
      return { ...day, struckLineIds: [...struck], lineTimestamps: { ...day.lineTimestamps, [lineId]: stamp }, resolved: done ? day.resolved : day.resolved?.filter(item => item.lineId !== lineId || item.persisted) };
    }, false, key);
  }, [changeDay, todayKey]);
  const toggleStrike = useCallback((lineId: string) => {
    const day = storeRef.current[todayKey];
    setLineDone(lineId, !(day?.struckLineIds ?? day?.struckLines ?? []).includes(lineId));
  }, [setLineDone, storeRef, todayKey]);

  const appendLinesToToday = useCallback((lines: string[], source?: DaySlipSource) => {
    changeDay(day => appendEntries(day, lines.map(text => ({ id: crypto.randomUUID(), text: text.trim(), source }))), true);
  }, [changeDay]);
  const insertStructuredLines = useCallback((lines: string[]) => {
    changeDay(day => {
      const html = lines.map(text => {
        const rule = parseRuleLine(text);
        return rule.isRule ? toRuleHtml(rule.label) : toParagraphHtml({ id: crypto.randomUUID(), text });
      }).join("");
      const nextHtml = day.html + html;
      return { ...day, html: nextHtml, plainText: extractLinesFromHtml(nextHtml).map(line => line.text).join("\n"), nodes: undefined };
    }, true);
  }, [changeDay]);
  const deleteLine = useCallback((lineId: string) => {
    changeDay(day => {
      if (day.resolved?.some(item => item.lineId === lineId && item.persisted)) return day;
      const doc = new DOMParser().parseFromString(day.html, "text/html");
      doc.querySelectorAll("p").forEach(p => { if (p.dataset.lineId === lineId) p.remove(); });
      const sources = { ...day.sources }; delete sources[lineId];
      const timestamps = { ...day.lineTimestamps }; delete timestamps[lineId];
      return { ...day, html: doc.body.innerHTML, plainText: extractLinesFromHtml(doc.body.innerHTML).map(line => line.text).join("\n"), nodes: undefined, sources, lineTimestamps: timestamps, struckLineIds: (day.struckLineIds ?? day.struckLines ?? []).filter(id => id !== lineId), resolved: day.resolved?.filter(item => item.lineId !== lineId) };
    }, true);
  }, [changeDay]);

  const toggleResolveLine = useCallback((lineId: string, text: string, target: ResolveTarget, snoozeUntil?: string, taskOptions?: TaskOptions) => {
    changeDay(day => {
      const existing = day.resolved?.find(item => item.lineId === lineId);
      if (existing?.persisted) return day;
      const undo = target !== "snoozed" && existing?.target === target && !snoozeUntil && !taskOptions;
      const tomorrow = new Date(`${todayKey}T12:00:00`); tomorrow.setDate(tomorrow.getDate() + 1);
      const struck = new Set(day.struckLineIds ?? day.struckLines ?? []);
      if (undo) struck.delete(lineId); else struck.add(lineId);
      const resolved = (day.resolved ?? []).filter(item => item.lineId !== lineId);
      if (!undo) resolved.push({ lineId, text, target, snoozeUntil: target === "snoozed" ? snoozeUntil ?? toDayKey(tomorrow) : undefined, taskOptions });
      return { ...day, struckLineIds: [...struck], resolved };
    });
  }, [changeDay, todayKey]);

  const updateTaskOptions = useCallback((lineId: string, taskOptions: TaskOptions) => {
    changeDay(day => ({ ...day, resolved: day.resolved?.map(item => item.lineId === lineId && !item.persisted ? { ...item, taskOptions } : item) }));
  }, [changeDay]);

  const carryOver = useCallback(() => {
    if (!ready || processing.current || storeRef.current[todayKey]?.completedAt) return;
    setStore(prev => carryLines(prev, todayKey, collectCarryLines(prev, todayKey)));
    setEditorReloadToken(token => token + 1);
  }, [ready, setStore, storeRef, todayKey]);

  const createResolvedItem = useCallback(async (item: ResolvedItem, key: string) => {
    if (item.target !== "note" && item.target !== "task" && item.target !== "decision") return;
    const day = storeRef.current[key];
    const existingSource = day?.sources?.[item.lineId];
    // An existing linked task/note/decision is already the destination, not a new record to duplicate.
    if (existingSource?.type === item.target) return existingSource.id;
    const id = item.entityId ?? await exportId(userId, key, item.lineId, item.target);
    const find = () => item.target === "task"
      ? supabase.from("tasks").select("id").eq("id", id).eq("user_id", userId).maybeSingle()
      : item.target === "note"
        ? supabase.from("quick_notes").select("id").eq("id", id).eq("user_id", userId).maybeSingle()
        : supabase.from("task_decisions").select("id").eq("id", id).eq("created_by", userId).maybeSingle();
    const found = await find();
    if (found.error) throw found.error;
    if (found.data) return id;
    const title = item.text.replace(/^!{1,2}\s*/, "").trim();
    if (!title) throw new Error("Der Eintrag benötigt einen Titel.");
    const description = `Aus Tageszettel (${key})`;
    const response = item.target === "note"
      ? await supabase.from("quick_notes").insert({ id, user_id: userId, title, content: description })
      : item.target === "task"
        ? await supabase.from("tasks").insert({ id, user_id: userId, tenant_id: tenantId, title, description, status: "open", priority: item.text.startsWith("!!") ? "high" : "medium", category: "allgemein", assigned_to: item.taskOptions?.assignedTo || userId, due_date: item.taskOptions?.dueDate ? new Date(`${item.taskOptions.dueDate}T12:00:00`).toISOString() : null })
        : await supabase.from("task_decisions").insert({ id, created_by: userId, tenant_id: tenantId, title, description, status: "open" });
    if (response.error) {
      // Concurrent creation or a response lost on a previous attempt: verify the exact destination.
      if (response.error.code !== "23505") throw response.error;
      const concurrent = await find();
      if (concurrent.error || !concurrent.data) throw response.error;
    }
    return id;
  }, [storeRef, userId, tenantId]);

  const persistResolvedItems = useCallback(async (key = todayKey, onlyLineId?: string): Promise<boolean> => {
    const items = storeRef.current[key]?.resolved ?? [];
    let success = true;
    for (const item of items) {
      if (item.persisted || (onlyLineId && item.lineId !== onlyLineId) || !["note", "task", "decision"].includes(item.target)) continue;
      if (!mounted.current) return false;
      try {
        const entityId = await createResolvedItem(item, key);
        if (!mounted.current) return false;
        setStore(prev => {
          const day = prev[key];
          return { ...prev, [key]: { ...day, resolved: day.resolved?.map(row => row.lineId === item.lineId ? { ...row, entityId, persisted: true, error: undefined } : row), sources: { ...day.sources, [item.lineId]: { type: item.target as DaySlipSource["type"], id: entityId! } } } };
        });
      } catch (error) {
        success = false;
        setStore(prev => ({ ...prev, [key]: { ...prev[key], resolved: prev[key]?.resolved?.map(row => row.lineId === item.lineId ? { ...row, error: errorMessage(error) } : row) } }));
      }
    }
    if (!mounted.current) return false;
    const saved = await flush();
    return success && saved;
  }, [todayKey, storeRef, createResolvedItem, setStore, flush]);

  const completeDay = useCallback(async (): Promise<boolean> => {
    if (!ready || processing.current) return false;
    const key = todayKey;
    if (storeRef.current[key]?.completedAt) return true;
    const day = storeRef.current[key] ?? emptyDay();
    const struck = new Set(day.struckLineIds ?? day.struckLines ?? []);
    if (extractLinesFromHtml(day.html).some(line => !struck.has(line.id) && !day.resolved?.some(item => item.lineId === line.id))) { setResolveMode(true); return false; }
    processing.current = true; setIsProcessing(true);
    try {
      if (!await persistResolvedItems(key) || !mounted.current) return false;
      setStore(prev => ({ ...prev, [key]: { ...(prev[key] ?? emptyDay()), completedAt: new Date().toISOString() } }));
      if (await flush()) return true;
      // A failed completion write stays visibly open and retryable.
      setStore(prev => ({ ...prev, [key]: { ...prev[key], completedAt: undefined } }));
      return false;
    } finally { processing.current = false; if (mounted.current) setIsProcessing(false); }
  }, [ready, todayKey, storeRef, persistResolvedItems, setStore, flush]);

  const reopenDay = useCallback(async () => {
    if (processing.current) return;
    setStore(prev => ({ ...prev, [todayKey]: { ...prev[todayKey], completedAt: undefined } }));
    setResolveMode(false);
    await flush();
  }, [todayKey, setStore, flush]);

  const createFromLine = useCallback(async (lineId: string, text: string, target: "note" | "task", taskOptions?: TaskOptions): Promise<boolean> => {
    if (!ready || processing.current || storeRef.current[todayKey]?.completedAt) return false;
    processing.current = true; setIsProcessing(true);
    try {
      const old = storeRef.current[todayKey]?.resolved?.find(item => item.lineId === lineId);
      if (old?.persisted) return true;
      setStore(prev => {
        const day = prev[todayKey] ?? emptyDay();
        return { ...prev, [todayKey]: { ...day, resolved: [...(day.resolved ?? []).filter(item => item.lineId !== lineId), { lineId, text, target, taskOptions }], struckLineIds: [...new Set([...(day.struckLineIds ?? day.struckLines ?? []), lineId])] } };
      });
      return await persistResolvedItems(todayKey, lineId);
    } finally { processing.current = false; if (mounted.current) setIsProcessing(false); }
  }, [ready, storeRef, todayKey, setStore, persistResolvedItems]);

  const onEditorChange = useCallback((editorState: EditorState, editor: LexicalEditor) => {
    if (!ready || processing.current || storeRef.current[todayKey]?.completedAt) return;
    editorState.read(() => {
      const html = $generateHtmlFromNodes(editor, null);
      const plainText = $getRoot().getTextContent();
      const nodes = JSON.stringify(editorState.toJSON());
      const linked: Record<string, DaySlipSource> = {};
      $getRoot().getChildren().forEach(node => {
        if (node instanceof DaySlipLineNode && node.getLinkedTaskId()) linked[node.getLineId()] = { type: "task", id: node.getLinkedTaskId()! };
      });
      setStore(prev => {
        const day = prev[todayKey] ?? emptyDay();
        if (day.nodes === nodes && day.html === html) return prev;
        const ids = new Set(extractLinesFromHtml(html).map(line => line.id));
        const lineTimestamps = { ...day.lineTimestamps };
        ids.forEach(id => { lineTimestamps[id] ??= { addedAt: new Date().toISOString() }; });
        const sources = Object.fromEntries(Object.entries({ ...day.sources, ...linked }).filter(([id]) => ids.has(id)));
        return { ...prev, [todayKey]: { ...day, html, plainText, nodes, sources, lineTimestamps, resolved: day.resolved?.filter(item => ids.has(item.lineId)), struckLineIds: (day.struckLineIds ?? day.struckLines ?? []).filter(id => ids.has(id)) } };
      });
    });
  }, [ready, storeRef, todayKey, setStore]);
  const handleEditorReady = useCallback((editor: LexicalEditor) => { editorRef.current = editor; setEditorReadyVersion(version => version + 1); }, []);

  // Initialize routines and the scoped week plan only after hydration; never race a remote load.
  useEffect(() => {
    if (!ready || todayData.completedAt) return;
    const recurring = settings.recurringItems.filter(item => item.weekday === "all" || item.weekday === weekdayKey(new Date())).map(item => item.text);
    const planned = settings.weekPlan?.applied ? settings.weekPlan.days[todayKey] ?? [] : [];
    if (todayData.recurringInjected && (todayData.weekPlanInjected || !planned.length)) return;
    changeDay(day => {
      const texts = [...(!day.recurringInjected ? recurring : []), ...(!day.weekPlanInjected ? planned : [])];
      return { ...appendEntries(day, texts.map(text => ({ id: crypto.randomUUID(), text }))), recurringInjected: true, weekPlanInjected: day.weekPlanInjected || planned.length > 0 };
    }, true);
  }, [ready, todayData.completedAt, todayData.recurringInjected, todayData.weekPlanInjected, settings.recurringItems, settings.weekPlan, todayKey, changeDay]);

  // Refresh deadlines after reconnect/focus and periodically, including deadlines added later in the day.
  const [deadlineRefresh, setDeadlineRefresh] = useState(0);
  useEffect(() => {
    const refresh = () => setDeadlineRefresh(value => value + 1);
    window.addEventListener("focus", refresh); window.addEventListener("online", refresh);
    const timer = setInterval(refresh, 60000);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); };
  }, []);
  const [deadlineError, setDeadlineError] = useState<string | null>(null);
  useEffect(() => {
    if (!ready || todayData.completedAt || isProcessing) return;
    let cancelled = false;
    const run = async () => {
      try {
        const tomorrow = new Date(`${todayKey}T12:00:00`); tomorrow.setDate(tomorrow.getDate() + 1);
        const next = toDayKey(tomorrow);
        const start = new Date(`${todayKey}T00:00:00`).toISOString();
        const end = new Date(`${next}T00:00:00`).toISOString();
        const responses = await Promise.all([
          supabase.from("tasks").select("id,title,status").eq("tenant_id", tenantId).or(`assigned_to.eq.${userId},assigned_to.ilike.%${userId}%,user_id.eq.${userId}`).neq("status", "completed").gte("due_date", start).lt("due_date", end),
          supabase.from("quick_notes").select("id,title,content").eq("user_id", userId).is("deleted_at", null).or("is_archived.is.null,is_archived.eq.false").gte("follow_up_date", todayKey).lt("follow_up_date", next),
          supabase.from("case_items").select("id,subject").eq("tenant_id", tenantId).neq("status", "erledigt").gte("due_at", start).lt("due_at", end),
          supabase.from("task_decisions").select("id,title").eq("tenant_id", tenantId).neq("status", "resolved").is("archived_at", null).gte("response_deadline", start).lt("response_deadline", end),
        ]);
        if (cancelled) return;
        const error = responses.find(result => result.error)?.error;
        if (error) throw error;
        const entries: Array<DaySlipLineEntry & { source: DaySlipSource }> = [];
        const add = (type: DaySlipSource["type"], id: string, text: string) => { if (text.trim()) entries.push({ id: crypto.randomUUID(), text: text.trim(), source: { type, id } }); };
        responses[0].data?.forEach(row => add("task", row.id, `📋 ${row.title}`));
        responses[1].data?.forEach(row => add("note", row.id, `📝 ${(row.title || row.content || "").slice(0, 80)}`));
        responses[2].data?.forEach(row => add("case", row.id, `📁 ${row.subject || "Vorgang"}`));
        responses[3].data?.forEach(row => add("decision", row.id, `⚖️ ${row.title}`));
        changeDay(day => appendEntries(day, entries), true);
        setDeadlineError(null);
      } catch (error) { if (!cancelled) setDeadlineError(errorMessage(error)); }
    };
    void run();
    return () => { cancelled = true; };
  }, [ready, userId, tenantId, todayKey, todayData.completedAt, deadlineRefresh, changeDay, isProcessing]);

  useEffect(() => {
    if (!ready) return;
    const sync = (type: DaySlipSource["type"], row: { id?: string; status?: string; is_archived?: boolean }) => {
      const done = type === "task" ? row.status === "completed" : type === "case" ? row.status === "erledigt" : type === "decision" ? row.status === "resolved" : row.is_archived === true;
      if (!done) return;
      Object.entries(storeRef.current[todayKey]?.sources ?? {}).forEach(([lineId, source]) => { if (source.type === type && source.id === row.id) setLineDone(lineId, true); });
    };
    const channel = supabase.channel(`dayslip-sync-${userId}-${tenantId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks", filter: `tenant_id=eq.${tenantId}` }, payload => sync("task", payload.new))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "case_items", filter: `tenant_id=eq.${tenantId}` }, payload => sync("case", payload.new))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "task_decisions", filter: `tenant_id=eq.${tenantId}` }, payload => sync("decision", payload.new))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "quick_notes", filter: `user_id=eq.${userId}` }, payload => sync("note", payload.new))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [ready, userId, tenantId, todayKey, storeRef, setLineDone]);

  const setMood = useCallback((dayMood: 1 | 2 | 3 | 4 | 5) => changeDay(day => ({ ...day, dayMood })), [changeDay]);
  const editorConfig = useMemo(() => ({
    namespace: "DaySlipEditor",
    theme: {
      paragraph: "day-slip-item group relative mb-1.5 pl-6 before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:content-['–'] before:text-muted-foreground before:opacity-0 before:cursor-pointer before:select-none before:rounded before:px-0.5 before:border before:border-transparent before:transition-colors transition-all duration-200 [&.has-text]:before:opacity-100 hover:before:border-border/70 hover:before:bg-muted/40 hover:before:shadow-sm",
      text: { bold: "font-bold", italic: "italic", underline: "underline", strikethrough: "line-through" },
      horizontalRule: "my-4 border-border/80",
    },
    nodes: [HorizontalRuleNode, LabeledHorizontalRuleNode, DaySlipLineNode, { replace: ParagraphNode, with: () => $createDaySlipLineNode(), withKlass: DaySlipLineNode }],
    onError: (error: Error) => debugConsole.error("DaySlip Lexical error", error),
  }), []);

  return {
    ...persistence, todayKey, todayData, resolveMode, setResolveMode, isProcessing,
    recurringItems: settings.recurringItems, setRecurringItems, dayTemplates: settings.dayTemplates, setDayTemplates,
    weekPlan: settings.weekPlan, setWeekPlan, setMood,
    editorRef, editorReadyVersion, editorReloadToken, editorConfig,
    allLineEntries, struckLineIds, resolvedItems, resolvedByLineId, openLines, unresolvedCount: openLines.length, triageEntries, archiveDays,
    carryEntries, carryOver, toggleStrike, appendLinesToToday, insertStructuredLines, deleteLine, toggleResolveLine, updateTaskOptions,
    createFromLine, completeDay, reopenDay, onEditorChange, handleEditorReady,
    deadlineError,
  };
}
