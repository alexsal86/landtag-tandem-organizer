import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { $createTextNode, $getRoot, type EditorState, type LexicalEditor } from "lexical";
import { $generateHtmlFromNodes } from "@lexical/html";
import { $createHorizontalRuleNode, HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { ParagraphNode } from "lexical";
import { supabase } from "@/integrations/supabase/client";
import { DaySlipLineNode, $createDaySlipLineNode } from "@/components/DaySlipLineNode";
import { LabeledHorizontalRuleNode, $createLabeledHorizontalRuleNode } from "@/components/LabeledHorizontalRuleNode";
import { getWeekPlanForDay } from "@/components/dayslip/WeekPlanningBanner";
import {
  type DaySlipStore, type DaySlipDayData, type DaySlipLineEntry, type RecurringTemplate,
  type ResolvedItem, type ResolveTarget, type DayTemplate,
  STORAGE_KEY, RECURRING_STORAGE_KEY, DAY_TEMPLATE_STORAGE_KEY, RESOLVE_EXPORT_KEY,
  SAVE_DEBOUNCE_MS, WEEK_DAYS, DEFAULT_DAY_TEMPLATES,
  toDayKey, extractLinesFromHtml, normalizeLineText, isRuleLine, parseRuleLine,
  toParagraphHtml, toRuleHtml, weekdayKey, normalizeDayTemplates,
} from "../dayslipTypes";

export function useDaySlipStore(userId?: string, tenantId?: string) {
  const [store, setStore] = useState<DaySlipStore>(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  });
  const [resolveMode, setResolveMode] = useState(false);
  const [recurringItems, setRecurringItems] = useState<RecurringTemplate[]>(() => {
    try {
      const raw = localStorage.getItem(RECURRING_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as RecurringTemplate[] | string[];
      if (!Array.isArray(parsed) || parsed.length === 0) return [];
      if (typeof parsed[0] === "string") return (parsed as string[]).map((text) => ({ id: crypto.randomUUID(), text, weekday: "all" as const }));
      return (parsed as RecurringTemplate[]).map((item) => ({ id: item.id ?? crypto.randomUUID(), text: item.text, weekday: WEEK_DAYS.includes(item.weekday) ? item.weekday : "all" as const }));
    } catch { return []; }
  });
  const [dayTemplates, setDayTemplates] = useState<DayTemplate[]>(() => {
    try { const raw = localStorage.getItem(DAY_TEMPLATE_STORAGE_KEY); if (!raw) return DEFAULT_DAY_TEMPLATES; return normalizeDayTemplates(JSON.parse(raw)); } catch { return DEFAULT_DAY_TEMPLATES; }
  });

  const editorRef = useRef<LexicalEditor | null>(null);
  const [editorReadyVersion, setEditorReadyVersion] = useState(0);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [weekPlanInjected, setWeekPlanInjected] = useState(false);

  const todayKey = toDayKey(new Date());
  const todayData = store[todayKey] ?? { html: "", plainText: "", nodes: "", struckLineIds: [], lineTimestamps: {} };

  // Persist store
  useEffect(() => {
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch {} }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [store]);

  useEffect(() => { try { localStorage.setItem(RECURRING_STORAGE_KEY, JSON.stringify(recurringItems)); } catch {} }, [recurringItems]);
  useEffect(() => { try { localStorage.setItem(DAY_TEMPLATE_STORAGE_KEY, JSON.stringify(dayTemplates)); } catch {} }, [dayTemplates]);

  const yesterdayKey = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 1); return toDayKey(d); }, []);

  const yesterdayCarryLines = useMemo(() => {
    const yesterdayData = store[yesterdayKey];
    const allLines = extractLinesFromHtml(yesterdayData?.html ?? "");
    const struck = new Set(yesterdayData?.struckLineIds ?? yesterdayData?.struckLines ?? []);
    const openUnstruck = allLines.filter((line) => !struck.has(line.id));
    const snoozed = (yesterdayData?.resolved ?? []).filter((item) => item.target === "snoozed").map((item) => ({ lineId: item.lineId, text: item.text }));
    const merged = new Map<string, DaySlipLineEntry>();
    openUnstruck.forEach((line) => merged.set(line.id, line));
    snoozed.forEach((line) => { if (!line.text.trim()) return; merged.set(line.lineId, { id: line.lineId, text: line.text.trim() }); });
    return Array.from(merged.values());
  }, [store, yesterdayKey]);

  const allLineEntries = useMemo(() => extractLinesFromHtml(todayData.html), [todayData.html]);
  const struckLineIds = useMemo(() => todayData.struckLineIds ?? todayData.struckLines ?? [], [todayData.struckLineIds, todayData.struckLines]);
  const resolvedItems = useMemo<ResolvedItem[]>(() => (todayData.resolved ?? []).map((item) => ({ lineId: item.lineId ?? crypto.randomUUID(), text: item.text, target: item.target })), [todayData.resolved]);
  const resolvedByLineId = useMemo(() => new Map(resolvedItems.map((item) => [item.lineId, item.target])), [resolvedItems]);
  const openLines = useMemo(() => allLineEntries.filter((entry) => !struckLineIds.includes(entry.id)), [allLineEntries, struckLineIds]);
  const unresolvedCount = openLines.length;

  const triageEntries = useMemo(() => {
    const resolved = allLineEntries.filter((entry) => resolvedByLineId.has(entry.id));
    return [...openLines, ...resolved];
  }, [allLineEntries, openLines, resolvedByLineId]);

  const archiveDays = useMemo(() => Object.keys(store).filter((key) => key !== todayKey).sort((a, b) => b.localeCompare(a)), [store, todayKey]);

  const toggleStrike = useCallback((lineId: string) => {
    setStore((prev) => {
      const day = prev[todayKey] ?? { html: "", plainText: "", struckLineIds: [] };
      const struck = day.struckLineIds ?? day.struckLines ?? [];
      const isStruck = struck.includes(lineId);
      const now = new Date().toISOString();
      const lineTimestamps = { ...(day.lineTimestamps ?? {}) };
      if (!lineTimestamps[lineId]) lineTimestamps[lineId] = { addedAt: now };
      if (isStruck) delete lineTimestamps[lineId].checkedAt;
      else lineTimestamps[lineId].checkedAt = now;
      return { ...prev, [todayKey]: { ...day, struckLineIds: isStruck ? struck.filter((l) => l !== lineId) : [...struck, lineId], lineTimestamps } };
    });
  }, [todayKey]);

  const appendLinesToToday = useCallback((lines: string[]) => {
    const normalizedLines = lines.map((l) => l.trim()).filter((l) => l.length > 0);
    if (normalizedLines.length === 0) return;
    if (editorRef.current) {
      editorRef.current.update(() => {
        const root = $getRoot();
        const existing = new Set(root.getChildren().map((node) => normalizeLineText(node.getTextContent())).filter((l) => l.length > 0));
        normalizedLines.forEach((line) => {
          const normalized = normalizeLineText(line);
          if (!normalized || existing.has(normalized)) return;
          const paragraph = $createDaySlipLineNode();
          paragraph.append($createTextNode(line));
          root.append(paragraph);
          existing.add(normalized);
        });
      });
      return;
    }
    setStore((prev) => {
      const day = prev[todayKey] ?? { html: "", plainText: "", nodes: "", struckLineIds: [] };
      const existingLines = extractLinesFromHtml(day.html);
      const existingTexts = new Set(existingLines.map((l) => normalizeLineText(l.text)));
      const toAppend = normalizedLines.filter((l) => !existingTexts.has(normalizeLineText(l))).map((text) => ({ id: crypto.randomUUID(), text }));
      if (toAppend.length === 0) return prev;
      const merged = [...existingLines, ...toAppend];
      return { ...prev, [todayKey]: { ...day, html: merged.map(toParagraphHtml).join(""), plainText: merged.map((e) => e.text).join("\n"), nodes: undefined } };
    });
  }, [todayKey]);

  const insertStructuredLines = useCallback((lines: string[]) => {
    const editor = editorRef.current;
    const editorMounted = Boolean(editor?.getRootElement());
    if (!editorMounted) {
      setStore((prev) => {
        const day = prev[todayKey] ?? { html: "", plainText: "", struckLineIds: [] };
        const structuredHtml = lines.map((line) => {
          const parsed = parseRuleLine(line);
          if (!parsed.isRule) return toParagraphHtml({ id: crypto.randomUUID(), text: line });
          return toRuleHtml(parsed.label);
        }).join("");
        const existingLines = extractLinesFromHtml(day.html);
        const extra = lines.map((text) => ({ id: crypto.randomUUID(), text }));
        const merged = [...existingLines, ...extra];
        return { ...prev, [todayKey]: { ...day, html: `${day.html ?? ""}${structuredHtml}`, plainText: merged.map((l) => l.text).join("\n"), nodes: undefined } };
      });
      return;
    }
    editor!.update(() => {
      const root = $getRoot();
      lines.forEach((line) => {
        const parsed = parseRuleLine(line);
        if (parsed.isRule) {
          const hrNode = parsed.label ? $createLabeledHorizontalRuleNode(parsed.label) : $createHorizontalRuleNode();
          root.append(hrNode);
          return;
        }
        const paragraph = $createDaySlipLineNode();
        paragraph.append($createTextNode(line));
        root.append(paragraph);
      });
    });
  }, [todayKey]);

  const deleteLine = useCallback((lineId: string) => {
    if (editorRef.current) {
      editorRef.current.update(() => {
        const root = $getRoot();
        root.getChildren().forEach((node) => {
          if ((node as any).__lineId === lineId) node.remove();
        });
      });
    }
    setStore((prev) => {
      const day = prev[todayKey];
      if (!day) return prev;
      const lines = extractLinesFromHtml(day.html).filter((l) => l.id !== lineId);
      const lineTimestamps = { ...(day.lineTimestamps ?? {}) };
      delete lineTimestamps[lineId];
      return { ...prev, [todayKey]: { ...day, html: lines.map(toParagraphHtml).join(""), plainText: lines.map((l) => l.text).join("\n"), struckLineIds: (day.struckLineIds ?? day.struckLines ?? []).filter((id) => id !== lineId), resolved: (day.resolved ?? []).filter((item) => item.lineId !== lineId), lineTimestamps } };
    });
  }, [todayKey]);

  const syncResolveExport = useCallback((lineId: string, text: string, target: ResolveTarget, isUndo: boolean) => {
    if (target === "archived" || target === "snoozed") return;
    try {
      const raw = localStorage.getItem(RESOLVE_EXPORT_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      const filtered = existing.filter((item: any) => !(item.sourceDayKey === todayKey && item.lineId === lineId));
      const next = isUndo ? filtered : [...filtered, { sourceDayKey: todayKey, lineId, text, target, createdAt: new Date().toISOString() }];
      localStorage.setItem(RESOLVE_EXPORT_KEY, JSON.stringify(next));
    } catch {}
  }, [todayKey]);

  const toggleResolveLine = useCallback((lineId: string, line: string, target: ResolveTarget) => {
    setStore((prev) => {
      const day = prev[todayKey] ?? { html: "", plainText: "", struckLineIds: [] };
      const struck = day.struckLineIds ?? day.struckLines ?? [];
      const resolved = (day.resolved ?? []) as ResolvedItem[];
      const existing = resolved.find((item) => item.lineId === lineId);
      const isUndo = existing?.target === target;
      const nextResolved = isUndo ? resolved.filter((item) => item.lineId !== lineId) : [...resolved.filter((item) => item.lineId !== lineId), { lineId, text: line, target }];
      const nextStruck = isUndo ? struck.filter((id) => id !== lineId) : struck.includes(lineId) ? struck : [...struck, lineId];
      const now = new Date().toISOString();
      const lineTimestamps = { ...(day.lineTimestamps ?? {}) };
      if (!lineTimestamps[lineId]) lineTimestamps[lineId] = { addedAt: now };
      if (isUndo) delete lineTimestamps[lineId].checkedAt;
      else lineTimestamps[lineId].checkedAt = now;
      syncResolveExport(lineId, line, target, isUndo);
      return { ...prev, [todayKey]: { ...day, struckLineIds: nextStruck, resolved: nextResolved, lineTimestamps } };
    });
  }, [todayKey, syncResolveExport]);

  const createFromLine = useCallback(async (lineText: string, target: "note" | "task") => {
    if (!userId || !lineText.trim()) return;
    if (target === "note") { await supabase.from("quick_notes").insert({ user_id: userId, title: lineText, content: `Aus Tageszettel (${todayKey})` }); return; }
    if (!tenantId) return;
    await supabase.from("tasks").insert({ user_id: userId, tenant_id: tenantId, title: lineText, description: `Aus Tageszettel (${todayKey})`, status: "open", priority: "medium", category: "allgemein" });
  }, [userId, tenantId, todayKey]);

  const persistResolvedItems = useCallback(async () => {
    if (!userId) return;
    const resolved = (store[todayKey]?.resolved ?? []) as ResolvedItem[];
    const exportable = resolved.filter((item) => item.target === "note" || item.target === "task" || item.target === "decision");
    for (const item of exportable) {
      try {
        if (item.target === "note") await supabase.from("quick_notes").insert({ user_id: userId, title: item.text, content: `Aus Tageszettel (${todayKey})` });
        else if (item.target === "task" && tenantId) await supabase.from("tasks").insert({ user_id: userId, tenant_id: tenantId, title: item.text, description: `Aus Tageszettel (${todayKey})`, status: "open", priority: "medium", category: "allgemein" });
        else if (item.target === "decision") await supabase.from("task_decisions").insert({ created_by: userId, title: item.text, description: `Aus Tageszettel (${todayKey})`, status: "open" });
      } catch (err) { console.error(`Failed to persist resolved item (${item.target}):`, err); }
    }
  }, [userId, tenantId, store, todayKey]);

  const onEditorChange = useCallback((editorState: EditorState, editor: LexicalEditor) => {
    editorState.read(() => {
      const plainText = $getRoot().getTextContent();
      const html = $generateHtmlFromNodes(editor, null);
      let nodes: string | undefined;
      try { nodes = JSON.stringify(editorState.toJSON()); } catch { nodes = undefined; }
      setStore((prev) => {
        const day: DaySlipDayData = prev[todayKey] ?? { html: '', plainText: '', resolved: [], struckLines: [] };
        const currentEntries = extractLinesFromHtml(html);
        const now = new Date().toISOString();
        const lineTimestamps = { ...(day.lineTimestamps ?? {}) };
        currentEntries.forEach((entry) => { if (!lineTimestamps[entry.id]) lineTimestamps[entry.id] = { addedAt: now }; });
        const validLineIds = new Set(currentEntries.map((e) => e.id));
        Object.keys(lineTimestamps).forEach((id) => { if (!validLineIds.has(id)) delete lineTimestamps[id]; });
        return { ...prev, [todayKey]: { ...day, plainText, html, nodes, lineTimestamps } };
      });
    });
  }, [todayKey]);

  const handleEditorReady = useCallback((editor: LexicalEditor) => {
    if (editorRef.current !== editor) { editorRef.current = editor; setEditorReadyVersion((prev) => prev + 1); }
  }, []);

  // Recurring items injection
  useEffect(() => {
    const todayWeekday = weekdayKey(new Date());
    const recurringForToday = recurringItems.filter((item) => item.weekday === "all" || item.weekday === todayWeekday).map((item) => item.text);
    if (todayData.html.trim() || recurringForToday.length === 0 || todayData.recurringInjected) return;
    setStore((prev) => {
      const day = prev[todayKey] ?? { html: "", plainText: "" };
      if (day.html.trim() || day.recurringInjected) return prev;
      const entries = recurringForToday.map((text) => ({ id: crypto.randomUUID(), text }));
      const html = entries.map(toParagraphHtml).join("");
      return { ...prev, [todayKey]: { ...day, html, plainText: recurringForToday.join("\n"), nodes: undefined, recurringInjected: true } };
    });
  }, [todayData.html, todayData.recurringInjected, recurringItems, todayKey]);

  // Week plan injection
  useEffect(() => {
    if (weekPlanInjected) return;
    const planned = getWeekPlanForDay(todayKey);
    if (!planned || planned.length === 0) return;
    setWeekPlanInjected(true);
    appendLinesToToday(planned);
  }, [todayKey, weekPlanInjected, appendLinesToToday]);

  const handleApplyWeekPlan = useCallback((days: Record<string, string[]>) => {
    const todayItems = days[todayKey];
    if (todayItems && todayItems.length > 0) appendLinesToToday(todayItems);
    setWeekPlanInjected(true);
  }, [todayKey, appendLinesToToday]);

  const editorConfig = useMemo(() => ({
    namespace: "DaySlipEditor",
    theme: {
      paragraph: "day-slip-item group relative mb-1.5 pl-6 before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:content-['–'] before:text-muted-foreground before:opacity-0 before:cursor-pointer before:select-none before:rounded before:px-0.5 before:border before:border-transparent before:transition-colors transition-all duration-200 [&.has-text]:before:opacity-100 hover:before:border-border/70 hover:before:bg-muted/40 hover:before:shadow-sm",
      text: { bold: "font-bold", italic: "italic", underline: "underline", strikethrough: "line-through" },
      horizontalRule: "my-4 border-border/80",
    },
    nodes: [HorizontalRuleNode, LabeledHorizontalRuleNode, DaySlipLineNode, { replace: ParagraphNode, with: () => $createDaySlipLineNode() }],
    onError: (error: Error) => console.error("DaySlip Lexical error", error),
  }), []);

  return {
    store, setStore, resolveMode, setResolveMode,
    recurringItems, setRecurringItems, dayTemplates, setDayTemplates,
    editorRef, editorReadyVersion, saveTimeoutRef,
    todayKey, todayData, yesterdayKey, yesterdayCarryLines,
    allLineEntries, struckLineIds, resolvedItems, resolvedByLineId,
    openLines, unresolvedCount, triageEntries, archiveDays,
    toggleStrike, appendLinesToToday, insertStructuredLines, deleteLine,
    toggleResolveLine, createFromLine, persistResolvedItems,
    onEditorChange, handleEditorReady, handleApplyWeekPlan,
    editorConfig, weekPlanInjected, setWeekPlanInjected,
  };
}
