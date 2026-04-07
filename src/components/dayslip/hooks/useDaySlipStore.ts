import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { $createTextNode, $getRoot, type EditorState, type LexicalEditor } from "lexical";
import { $generateHtmlFromNodes } from "@lexical/html";
import { $createHorizontalRuleNode, HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { ParagraphNode } from "lexical";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import { DaySlipLineNode, $createDaySlipLineNode } from "@/components/DaySlipLineNode";
import { LabeledHorizontalRuleNode, $createLabeledHorizontalRuleNode } from "@/components/LabeledHorizontalRuleNode";
import { getWeekPlanForDay } from "@/components/dayslip/WeekPlanningBanner";
import {
  type DaySlipStore, type DaySlipDayData, type DaySlipLineEntry, type RecurringTemplate,
  type ResolvedItem, type ResolveTarget, type DayTemplate, type ResolveExportItem,
  STORAGE_KEY, RECURRING_STORAGE_KEY, DAY_TEMPLATE_STORAGE_KEY, RESOLVE_EXPORT_KEY,
  SAVE_DEBOUNCE_MS, WEEK_DAYS, DEFAULT_DAY_TEMPLATES,
  toDayKey, extractLinesFromHtml, normalizeLineText, isRuleLine, parseRuleLine,
  toParagraphHtml, toRuleHtml, weekdayKey, normalizeDayTemplates,
} from "../dayslipTypes";

const DB_SAVE_DEBOUNCE_MS = 1000;

export type DaySlipStoreEvent =
  | { type: "local-storage-migration-failed"; error: unknown }
  | { type: "db-load-error"; error: unknown }
  | { type: "resolve-export-sync-failed"; error: unknown }
  | { type: "resolved-item-persist-failed"; target: ResolveTarget; error: unknown }
  | { type: "preference-migration-failed"; dbKey: string; localKey: string; error: unknown };

export interface UseDaySlipStoreReturn {
  store: DaySlipStore;
  setStore: Dispatch<SetStateAction<DaySlipStore>>;
  resolveMode: boolean;
  setResolveMode: Dispatch<SetStateAction<boolean>>;
  recurringItems: RecurringTemplate[];
  setRecurringItems: Dispatch<SetStateAction<RecurringTemplate[]>>;
  dayTemplates: DayTemplate[];
  setDayTemplates: Dispatch<SetStateAction<DayTemplate[]>>;
  editorRef: MutableRefObject<LexicalEditor | null>;
  editorReadyVersion: number;
  saveTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout>>;
  todayKey: string;
  todayData: DaySlipDayData;
  yesterdayKey: string;
  yesterdayCarryLines: DaySlipLineEntry[];
  allLineEntries: DaySlipLineEntry[];
  struckLineIds: string[];
  resolvedItems: ResolvedItem[];
  resolvedByLineId: Map<string, ResolveTarget>;
  openLines: DaySlipLineEntry[];
  unresolvedCount: number;
  triageEntries: DaySlipLineEntry[];
  archiveDays: string[];
  toggleStrike: (lineId: string) => void;
  appendLinesToToday: (lines: string[]) => void;
  insertStructuredLines: (lines: string[]) => void;
  deleteLine: (lineId: string) => void;
  toggleResolveLine: (lineId: string, line: string, target: ResolveTarget) => void;
  createFromLine: (lineText: string, target: "note" | "task") => Promise<void>;
  persistResolvedItems: () => Promise<void>;
  onEditorChange: (editorState: EditorState, editor: LexicalEditor) => void;
  handleEditorReady: (editor: LexicalEditor) => void;
  handleApplyWeekPlan: (days: Record<string, string[]>) => void;
  editorConfig: {
    namespace: string;
    theme: {
      paragraph: string;
      text: { bold: string; italic: string; underline: string; strikethrough: string };
      horizontalRule: string;
    };
    nodes: unknown[];
    onError: (error: Error) => void;
  };
}

function logStoreEvent(event: DaySlipStoreEvent): void {
  switch (event.type) {
    case "local-storage-migration-failed":
      debugConsole.warn("useDaySlipStore: localStorage migration to DB failed", event.error);
      break;
    case "db-load-error":
      debugConsole.error("useDaySlipStore: DB load error", event.error);
      break;
    case "resolve-export-sync-failed":
      debugConsole.warn("useDaySlipStore: syncResolveExport failed", event.error);
      break;
    case "resolved-item-persist-failed":
      debugConsole.error(`Failed to persist resolved item (${event.target}):`, event.error);
      break;
    case "preference-migration-failed":
      debugConsole.warn("useDaySlipStore: preference migration failed", { dbKey: event.dbKey, localKey: event.localKey, error: event.error });
      break;
  }
}

export function useDaySlipStore(userId?: string, tenantId?: string): UseDaySlipStoreReturn {
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
  const dbSaveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const dirtyDaysRef = useRef<Set<string>>(new Set());
  const storeRef = useRef<DaySlipStore>(store);
  const dbLoadedRef = useRef(false);

  const todayKey = toDayKey(new Date());
  const todayData = store[todayKey] ?? { html: "", plainText: "", nodes: "", struckLineIds: [], lineTimestamps: {} };
  const todayLineEntries = useMemo(() => extractLinesFromHtml(todayData.html), [todayData.html]);

  // ─── DB Load & Migration ──────────────────────────────────────────────
  useEffect(() => {
    if (!userId || dbLoadedRef.current) return;
    let cancelled = false;

    const loadFromDb = async () => {
      try {
        const { data, error } = await supabase
          .from("day_slips")
          .select("day_key, data")
          .eq("user_id", userId);

        if (cancelled || error) return;

        if (data && data.length > 0) {
          // DB has data → merge into state (DB wins for existing keys)
          const dbStore: DaySlipStore = {};
          data.forEach((row: { day_key: string; data: DaySlipDayData }) => { dbStore[row.day_key] = row.data; });
          setStore(prev => {
            const merged = { ...prev, ...dbStore };
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch {}
            return merged;
          });
        } else {
          // No DB data → migrate localStorage to DB
          const localRaw = localStorage.getItem(STORAGE_KEY);
          if (localRaw) {
            try {
              const localStore: DaySlipStore = JSON.parse(localRaw);
              const entries = Object.entries(localStore);
              if (entries.length > 0) {
                // Batch insert (max 100 at a time)
                for (let i = 0; i < entries.length; i += 100) {
                  const batch = entries.slice(i, i + 100).map(([dayKey, dayData]) => ({
                    user_id: userId,
                    tenant_id: tenantId || null,
                    day_key: dayKey,
                    data: dayData,
                    updated_at: new Date().toISOString(),
                  }));
                  await supabase.from("day_slips").upsert(batch, { onConflict: "user_id,day_key" });
                }
              }
            } catch (error: unknown) { logStoreEvent({ type: "local-storage-migration-failed", error }); }
          }
        }

        // Also migrate recurring items and templates
        await migratePreference(userId, tenantId, "dayslip_recurring", RECURRING_STORAGE_KEY);
        await migratePreference(userId, tenantId, "dayslip_day_templates", DAY_TEMPLATE_STORAGE_KEY);
        await migratePreference(userId, tenantId, "dayslip_resolve_export", RESOLVE_EXPORT_KEY);

        // Load recurring/templates from DB if available
        const prefResult = await supabase
          .from("user_preferences")
          .select("key, value")
          .eq("user_id", userId)
          .in("key", ["dayslip_recurring", "dayslip_day_templates"]);

        if (!cancelled && prefResult.data) {
          prefResult.data.forEach((row: { key: string; value: unknown }) => {
            if (row.key === "dayslip_recurring" && Array.isArray(row.value)) {
              setRecurringItems(row.value as RecurringTemplate[]);
              try { localStorage.setItem(RECURRING_STORAGE_KEY, JSON.stringify(row.value)); } catch {}
            }
            if (row.key === "dayslip_day_templates") {
              const normalized = normalizeDayTemplates(row.value);
              setDayTemplates(normalized);
              try { localStorage.setItem(DAY_TEMPLATE_STORAGE_KEY, JSON.stringify(normalized)); } catch {}
            }
          });
        }

        dbLoadedRef.current = true;
      } catch (error: unknown) {
        logStoreEvent({ type: "db-load-error", error });
      }
    };

    loadFromDb();
    return () => { cancelled = true; };
  }, [userId, tenantId]);

  // ─── Persist store (localStorage + DB) ─────────────────────────────────
  useEffect(() => {
    storeRef.current = store;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch {}
    }, SAVE_DEBOUNCE_MS);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [store]);

  // Debounced DB save for dirty days
  const flushDirtyDays = useCallback(() => {
    if (!userId || dirtyDaysRef.current.size === 0) return;
    const dirtyKeys = Array.from(dirtyDaysRef.current);
    dirtyDaysRef.current.clear();

    const currentStore = storeRef.current;
    const rows = dirtyKeys
      .filter(dk => currentStore[dk])
      .map(dk => ({
        user_id: userId,
        tenant_id: tenantId || null,
        day_key: dk,
        data: currentStore[dk],
        updated_at: new Date().toISOString(),
      }));

    if (rows.length > 0) {
      supabase.from("day_slips").upsert(rows, { onConflict: "user_id,day_key" }).then();
    }
  }, [userId, tenantId]);

  useEffect(() => {
    if (!userId || dirtyDaysRef.current.size === 0) return;
    if (dbSaveTimeoutRef.current) clearTimeout(dbSaveTimeoutRef.current);
    dbSaveTimeoutRef.current = setTimeout(flushDirtyDays, DB_SAVE_DEBOUNCE_MS);
    return () => { if (dbSaveTimeoutRef.current) clearTimeout(dbSaveTimeoutRef.current); };
  }, [store, flushDirtyDays, userId]);

  // Mark day as dirty when store changes
  const setStoreAndTrack = useCallback((updater: (prev: DaySlipStore) => DaySlipStore, ...dirtyKeys: string[]) => {
    setStore(prev => {
      const next = updater(prev);
      storeRef.current = next;
      dirtyKeys.forEach(k => dirtyDaysRef.current.add(k));
      return next;
    });
  }, []);

  // Persist recurring/templates to DB
  useEffect(() => {
    try { localStorage.setItem(RECURRING_STORAGE_KEY, JSON.stringify(recurringItems)); } catch {}
    if (userId) {
      supabase.from("user_preferences").upsert(
        { user_id: userId, tenant_id: tenantId || null, key: "dayslip_recurring", value: recurringItems, updated_at: new Date().toISOString() },
        { onConflict: "user_id,tenant_id,key" }
      ).then();
    }
  }, [recurringItems, userId, tenantId]);

  useEffect(() => {
    try { localStorage.setItem(DAY_TEMPLATE_STORAGE_KEY, JSON.stringify(dayTemplates)); } catch {}
    if (userId) {
      supabase.from("user_preferences").upsert(
        { user_id: userId, tenant_id: tenantId || null, key: "dayslip_day_templates", value: dayTemplates, updated_at: new Date().toISOString() },
        { onConflict: "user_id,tenant_id,key" }
      ).then();
    }
  }, [dayTemplates, userId, tenantId]);

  // Flush on unmount
  useEffect(() => () => { flushDirtyDays(); }, [flushDirtyDays]);

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

  const allLineEntries = todayLineEntries;
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
    setStoreAndTrack((prev) => {
      const day = prev[todayKey] ?? { html: "", plainText: "", struckLineIds: [] };
      const struck = day.struckLineIds ?? day.struckLines ?? [];
      const isStruck = struck.includes(lineId);
      const now = new Date().toISOString();
      const lineTimestamps = { ...(day.lineTimestamps ?? {}) };
      if (!lineTimestamps[lineId]) lineTimestamps[lineId] = { addedAt: now };
      if (isStruck) delete lineTimestamps[lineId].checkedAt;
      else lineTimestamps[lineId].checkedAt = now;
      return { ...prev, [todayKey]: { ...day, struckLineIds: isStruck ? struck.filter((l) => l !== lineId) : [...struck, lineId], lineTimestamps } };
    }, todayKey);
  }, [todayKey, setStoreAndTrack]);

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
    setStoreAndTrack((prev) => {
      const day = prev[todayKey] ?? { html: "", plainText: "", nodes: "", struckLineIds: [] };
      const existingLines = day.html === todayData.html ? todayLineEntries : extractLinesFromHtml(day.html);
      const existingTexts = new Set(existingLines.map((l) => normalizeLineText(l.text)));
      const toAppend = normalizedLines.filter((l) => !existingTexts.has(normalizeLineText(l))).map((text) => ({ id: crypto.randomUUID(), text }));
      if (toAppend.length === 0) return prev;
      const merged = [...existingLines, ...toAppend];
      return { ...prev, [todayKey]: { ...day, html: merged.map(toParagraphHtml).join(""), plainText: merged.map((e) => e.text).join("\n"), nodes: undefined } };
    }, todayKey);
  }, [todayData.html, todayKey, todayLineEntries, setStoreAndTrack]);

  const insertStructuredLines = useCallback((lines: string[]) => {
    const editor = editorRef.current;
    const editorMounted = Boolean(editor?.getRootElement());
    if (!editorMounted) {
      setStoreAndTrack((prev) => {
        const day = prev[todayKey] ?? { html: "", plainText: "", struckLineIds: [] };
        const structuredHtml = lines.map((line) => {
          const parsed = parseRuleLine(line);
          if (!parsed.isRule) return toParagraphHtml({ id: crypto.randomUUID(), text: line });
          return toRuleHtml(parsed.label);
        }).join("");
        const existingLines = day.html === todayData.html ? todayLineEntries : extractLinesFromHtml(day.html);
        const extra = lines.map((text) => ({ id: crypto.randomUUID(), text }));
        const merged = [...existingLines, ...extra];
        return { ...prev, [todayKey]: { ...day, html: `${day.html ?? ""}${structuredHtml}`, plainText: merged.map((l) => l.text).join("\n"), nodes: undefined } };
      }, todayKey);
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
  }, [todayData.html, todayKey, todayLineEntries, setStoreAndTrack]);

  const deleteLine = useCallback((lineId: string) => {
    if (editorRef.current) {
      editorRef.current.update(() => {
        const root = $getRoot();
        root.getChildren().forEach((node) => {
          if ((node as { __lineId?: string }).__lineId === lineId) node.remove();
        });
      });
    }
    setStoreAndTrack((prev) => {
      const day = prev[todayKey];
      if (!day) return prev;
      const lines = (day.html === todayData.html ? todayLineEntries : extractLinesFromHtml(day.html)).filter((l) => l.id !== lineId);
      const lineTimestamps = { ...(day.lineTimestamps ?? {}) };
      delete lineTimestamps[lineId];
      return { ...prev, [todayKey]: { ...day, html: lines.map(toParagraphHtml).join(""), plainText: lines.map((l) => l.text).join("\n"), struckLineIds: (day.struckLineIds ?? day.struckLines ?? []).filter((id) => id !== lineId), resolved: (day.resolved ?? []).filter((item) => item.lineId !== lineId), lineTimestamps } };
    }, todayKey);
  }, [todayData.html, todayKey, todayLineEntries, setStoreAndTrack]);

  const syncResolveExport = useCallback((lineId: string, text: string, target: ResolveTarget, isUndo: boolean) => {
    if (target === "archived" || target === "snoozed") return;
    try {
      const raw = localStorage.getItem(RESOLVE_EXPORT_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      const filtered = (existing as ResolveExportItem[]).filter((item) => !(item.sourceDayKey === todayKey && item.lineId === lineId));
      const next = isUndo ? filtered : [...filtered, { sourceDayKey: todayKey, lineId, text, target, createdAt: new Date().toISOString() }];
      localStorage.setItem(RESOLVE_EXPORT_KEY, JSON.stringify(next));
      // Also sync to DB
      if (userId) {
        supabase.from("user_preferences").upsert(
          { user_id: userId, tenant_id: tenantId || null, key: "dayslip_resolve_export", value: next, updated_at: new Date().toISOString() },
          { onConflict: "user_id,tenant_id,key" }
        ).then();
      }
    } catch (error: unknown) { logStoreEvent({ type: "resolve-export-sync-failed", error }); }
  }, [todayKey, userId, tenantId]);

  const toggleResolveLine = useCallback((lineId: string, line: string, target: ResolveTarget) => {
    setStoreAndTrack((prev) => {
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
    }, todayKey);
  }, [todayKey, syncResolveExport, setStoreAndTrack]);

  const createFromLine = useCallback(async (lineText: string, target: "note" | "task") => {
    if (!userId || !lineText.trim()) return;
    if (target === "note") { await supabase.from("quick_notes").insert([{ user_id: userId, title: lineText, content: `Aus Tageszettel (${todayKey})` }]); return; }
    if (!tenantId) return;
    await supabase.from("tasks").insert([{ user_id: userId, tenant_id: tenantId, title: lineText, description: `Aus Tageszettel (${todayKey})`, status: "open", priority: "medium", category: "allgemein" }]);
  }, [userId, tenantId, todayKey]);

  const persistResolvedItems = useCallback(async () => {
    if (!userId) return;
    const resolved = (store[todayKey]?.resolved ?? []) as ResolvedItem[];
    const exportable = resolved.filter((item) => (item.target === "note" || item.target === "task" || item.target === "decision") && !item.persisted);
    if (exportable.length === 0) return;

    const counts = { note: 0, task: 0, decision: 0 };
    const errors: string[] = [];
    const persistedLineIds: string[] = [];

    for (const item of exportable) {
      try {
        const trimmedText = item.text.replace(/^!{1,2}\s*/, "");
        const priority = item.text.startsWith("!!") ? "high" : item.text.startsWith("!") ? "medium" : "medium";

        if (item.target === "note") {
          const { error } = await supabase.from("quick_notes").insert([{ user_id: userId, title: trimmedText, content: `Aus Tageszettel (${todayKey})` }]);
          if (error) throw error;
          counts.note++;
        } else if (item.target === "task") {
          if (!tenantId) { errors.push("Aufgabe: Kein Tenant zugewiesen"); continue; }
          const { error } = await supabase.from("tasks").insert([{ user_id: userId, tenant_id: tenantId, title: trimmedText, description: `Aus Tageszettel (${todayKey})`, status: "open", priority, category: "allgemein" }]);
          if (error) throw error;
          counts.task++;
        } else if (item.target === "decision") {
          const { error } = await supabase.from("task_decisions").insert([{ created_by: userId, tenant_id: tenantId || null, title: trimmedText, description: `Aus Tageszettel (${todayKey})`, status: "open" }]);
          if (error) throw error;
          counts.decision++;
        }
        persistedLineIds.push(item.lineId);
      } catch (error: unknown) {
        logStoreEvent({ type: "resolved-item-persist-failed", target: item.target, error });
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`${item.target}: ${msg}`);
      }
    }

    // Mark persisted items
    if (persistedLineIds.length > 0) {
      const idSet = new Set(persistedLineIds);
      setStoreAndTrack((prev) => {
        const day = prev[todayKey];
        if (!day?.resolved) return prev;
        return {
          ...prev,
          [todayKey]: {
            ...day,
            resolved: day.resolved.map((r) => idSet.has(r.lineId) ? { ...r, persisted: true } : r),
          },
        };
      }, todayKey);
    }

    // Toast feedback
    const { toast } = await import("sonner");
    const parts: string[] = [];
    if (counts.note > 0) parts.push(`${counts.note} Notiz${counts.note > 1 ? "en" : ""}`);
    if (counts.task > 0) parts.push(`${counts.task} Aufgabe${counts.task > 1 ? "n" : ""}`);
    if (counts.decision > 0) parts.push(`${counts.decision} Entscheidung${counts.decision > 1 ? "en" : ""}`);

    if (parts.length > 0) {
      toast.success(`${parts.join(", ")} erstellt`);
    }
    if (errors.length > 0) {
      toast.error(`Fehler beim Erstellen: ${errors.join("; ")}`);
    }
  }, [userId, tenantId, store, todayKey, setStoreAndTrack]);

  const onEditorChange = useCallback((editorState: EditorState, editor: LexicalEditor) => {
    editorState.read(() => {
      const plainText = $getRoot().getTextContent();
      const html = $generateHtmlFromNodes(editor, null);
      let nodes: string | undefined;
      try { nodes = JSON.stringify(editorState.toJSON()); } catch { nodes = undefined; }
      setStoreAndTrack((prev) => {
        const day: DaySlipDayData = prev[todayKey] ?? { html: '', plainText: '', resolved: [], struckLines: [] };
        const currentEntries = extractLinesFromHtml(html);
        const now = new Date().toISOString();
        const lineTimestamps = { ...(day.lineTimestamps ?? {}) };
        currentEntries.forEach((entry) => { if (!lineTimestamps[entry.id]) lineTimestamps[entry.id] = { addedAt: now }; });
        const validLineIds = new Set(currentEntries.map((e) => e.id));
        Object.keys(lineTimestamps).forEach((id) => { if (!validLineIds.has(id)) delete lineTimestamps[id]; });
        return { ...prev, [todayKey]: { ...day, plainText, html, nodes, lineTimestamps } };
      }, todayKey);
    });
  }, [todayKey, setStoreAndTrack]);

  const handleEditorReady = useCallback((editor: LexicalEditor) => {
    if (editorRef.current !== editor) { editorRef.current = editor; setEditorReadyVersion((prev) => prev + 1); }
  }, []);

  // Recurring items injection
  useEffect(() => {
    const todayWeekday = weekdayKey(new Date());
    const recurringForToday = recurringItems.filter((item) => item.weekday === "all" || item.weekday === todayWeekday).map((item) => item.text);
    if (todayData.html.trim() || recurringForToday.length === 0 || todayData.recurringInjected) return;
    setStoreAndTrack((prev) => {
      const day = prev[todayKey] ?? { html: "", plainText: "" };
      if (day.html.trim() || day.recurringInjected) return prev;
      const entries = recurringForToday.map((text) => ({ id: crypto.randomUUID(), text }));
      const html = entries.map(toParagraphHtml).join("");
      return { ...prev, [todayKey]: { ...day, html, plainText: recurringForToday.join("\n"), nodes: undefined, recurringInjected: true } };
    }, todayKey);
  }, [todayData.html, todayData.recurringInjected, recurringItems, todayKey, setStoreAndTrack]);

  // Deadline injection – inject today's deadlines from Supabase
  useEffect(() => {
    if (!userId || todayData.deadlinesInjected) return;
    let cancelled = false;

    const injectDeadlines = async () => {
      const todayStr = todayKey;
      const tomorrowDate = new Date();
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrowStr = toDayKey(tomorrowDate);

      const [tasksRes, notesRes, casesRes, decisionsRes] = await Promise.all([
        supabase.from("tasks").select("id, title, due_date")
          .or(`assigned_to.eq.${userId},assigned_to.ilike.%${userId}%,user_id.eq.${userId}`)
          .neq("status", "completed")
          .gte("due_date", todayStr)
          .lt("due_date", tomorrowStr),
        supabase.from("quick_notes").select("id, title, content, follow_up_date")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .or("is_archived.is.null,is_archived.eq.false")
          .gte("follow_up_date", todayStr)
          .lt("follow_up_date", tomorrowStr),
        tenantId
          ? supabase.from("case_items").select("id, subject, due_at")
              .eq("tenant_id", tenantId)
              .neq("status", "erledigt")
              .gte("due_at", `${todayStr}T00:00:00`)
              .lt("due_at", `${tomorrowStr}T00:00:00`)
          : Promise.resolve({ data: [] as { id: string; subject: string | null; due_at: string | null }[] }),
        supabase.from("task_decisions").select("id, title, response_deadline")
          .neq("status", "resolved")
          .is("archived_at", null)
          .gte("response_deadline", `${todayStr}T00:00:00`)
          .lt("response_deadline", `${tomorrowStr}T00:00:00`),
      ]);

      if (cancelled) return;

      type DeadlineEntry = { id: string; text: string; sourceKey: string };
      const entries: DeadlineEntry[] = [];

      (tasksRes.data || []).forEach(t => {
        if (t.title?.trim()) entries.push({ id: t.id, text: `📋 ${t.title.trim()}`, sourceKey: `task:${t.id}` });
      });
      (notesRes.data || []).forEach(n => {
        const title = (n.title || n.content || "").trim().substring(0, 80);
        if (title) entries.push({ id: n.id, text: `📝 ${title}`, sourceKey: `note:${n.id}` });
      });
      (casesRes.data || []).forEach(c => {
        const subject = (c.subject || "Vorgang").trim();
        entries.push({ id: c.id, text: `📁 ${subject}`, sourceKey: `case:${c.id}` });
      });
      (decisionsRes.data || []).forEach(d => {
        if (d.title?.trim()) entries.push({ id: d.id, text: `⚖️ ${d.title.trim()}`, sourceKey: `decision:${d.id}` });
      });

      if (entries.length === 0) {
        // Mark as injected even with no entries
        setStoreAndTrack(prev => {
          const day = prev[todayKey] ?? { html: "", plainText: "" };
          if (day.deadlinesInjected) return prev;
          return { ...prev, [todayKey]: { ...day, deadlinesInjected: true } };
        }, todayKey);
        return;
      }

      // Build line map: sourceKey → lineId
      const lineMap: Record<string, string> = {};
      const lines = entries.map(entry => {
        const lineId = crypto.randomUUID();
        lineMap[entry.sourceKey] = lineId;
        return entry.text;
      });

      // Set flag + map first, then append lines
      setStoreAndTrack(prev => {
        const day = prev[todayKey] ?? { html: "", plainText: "" };
        if (day.deadlinesInjected) return prev;
        return { ...prev, [todayKey]: { ...day, deadlinesInjected: true, deadlineLineMap: lineMap } };
      }, todayKey);

      appendLinesToToday(["--- 📅 Heutige Fristen ---", ...lines]);
    };

    injectDeadlines();
    return () => { cancelled = true; };
  }, [userId, tenantId, todayData.deadlinesInjected, todayKey, appendLinesToToday, setStoreAndTrack]);

  // Realtime: auto-strike deadlines when completed
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`dayslip-deadline-sync-${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks" }, (payload) => {
        const newRow = payload.new as { id?: string; status?: string };
        if (newRow.status === "completed" && newRow.id) {
          const sourceKey = `task:${newRow.id}`;
          const map = storeRef.current[todayKey]?.deadlineLineMap;
          const lineId = map?.[sourceKey];
          if (lineId) toggleStrike(lineId);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "case_items" }, (payload) => {
        const newRow = payload.new as { id?: string; status?: string };
        if (newRow.status === "erledigt" && newRow.id) {
          const sourceKey = `case:${newRow.id}`;
          const map = storeRef.current[todayKey]?.deadlineLineMap;
          const lineId = map?.[sourceKey];
          if (lineId) toggleStrike(lineId);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "task_decisions" }, (payload) => {
        const newRow = payload.new as { id?: string; status?: string };
        if (newRow.status === "resolved" && newRow.id) {
          const sourceKey = `decision:${newRow.id}`;
          const map = storeRef.current[todayKey]?.deadlineLineMap;
          const lineId = map?.[sourceKey];
          if (lineId) toggleStrike(lineId);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, todayKey, toggleStrike]);

  // Week plan injection
  useEffect(() => {
    if (todayData.weekPlanInjected) return;
    const planned = getWeekPlanForDay(todayKey);
    if (!planned || planned.length === 0) return;
    setStoreAndTrack((prev) => {
      const day = prev[todayKey] ?? { html: "", plainText: "" };
      if (day.weekPlanInjected) return prev;
      return { ...prev, [todayKey]: { ...day, weekPlanInjected: true } };
    }, todayKey);
    appendLinesToToday(planned);
  }, [todayData.weekPlanInjected, todayKey, appendLinesToToday, setStoreAndTrack]);

  const handleApplyWeekPlan = useCallback((days: Record<string, string[]>) => {
    setStoreAndTrack((prev) => {
      const day = prev[todayKey] ?? { html: "", plainText: "" };
      if (day.weekPlanInjected) return prev;
      return { ...prev, [todayKey]: { ...day, weekPlanInjected: true } };
    }, todayKey);

    const todayItems = days[todayKey];
    if (todayItems && todayItems.length > 0) appendLinesToToday(todayItems);
  }, [todayKey, appendLinesToToday, setStoreAndTrack]);

  const editorConfig = useMemo(() => ({
    namespace: "DaySlipEditor",
    theme: {
      paragraph: "day-slip-item group relative mb-1.5 pl-6 before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:content-['–'] before:text-muted-foreground before:opacity-0 before:cursor-pointer before:select-none before:rounded before:px-0.5 before:border before:border-transparent before:transition-colors transition-all duration-200 [&.has-text]:before:opacity-100 hover:before:border-border/70 hover:before:bg-muted/40 hover:before:shadow-sm",
      text: { bold: "font-bold", italic: "italic", underline: "underline", strikethrough: "line-through" },
      horizontalRule: "my-4 border-border/80",
    },
    nodes: [HorizontalRuleNode, LabeledHorizontalRuleNode, DaySlipLineNode, { replace: ParagraphNode, with: () => $createDaySlipLineNode() }],
    onError: (error: Error) => debugConsole.error("DaySlip Lexical error", error),
  }), []);

  return {
    store, setStore, resolveMode, setResolveMode,
    recurringItems, setRecurringItems, dayTemplates, setDayTemplates,
    editorRef, editorReadyVersion, saveTimeoutRef: saveTimeoutRef as any,
    todayKey, todayData, yesterdayKey, yesterdayCarryLines,
    allLineEntries, struckLineIds, resolvedItems, resolvedByLineId,
    openLines, unresolvedCount, triageEntries, archiveDays,
    toggleStrike, appendLinesToToday, insertStructuredLines, deleteLine,
    toggleResolveLine, createFromLine, persistResolvedItems,
    onEditorChange, handleEditorReady, handleApplyWeekPlan,
    editorConfig,
  };
}

// Helper: migrate a localStorage key to user_preferences if not yet in DB
async function migratePreference(userId: string, tenantId: string | undefined, dbKey: string, localKey: string): Promise<boolean> {
  try {
    const { data, error: selectError } = await supabase
      .from("user_preferences")
      .select("id")
      .eq("user_id", userId)
      .eq("key", dbKey)
      .maybeSingle();

    if (selectError) {
      debugConsole.error("useDaySlipStore: preference migration lookup failed", { dbKey, localKey, selectError });
      return false;
    }

    if (data) return true; // already in DB

    const raw = localStorage.getItem(localKey);
    if (!raw) return true;

    const parsed = JSON.parse(raw);
    const { error: upsertError } = await supabase.from("user_preferences").upsert(
      { user_id: userId, tenant_id: tenantId || null, key: dbKey, value: parsed, updated_at: new Date().toISOString() },
      { onConflict: "user_id,tenant_id,key" }
    );

    if (upsertError) {
      debugConsole.error("useDaySlipStore: preference migration upsert failed", { dbKey, localKey, upsertError });
      return false;
    }

    return true;
  } catch (error: unknown) {
    logStoreEvent({ type: "preference-migration-failed", dbKey, localKey, error });
    return false;
  }
}
