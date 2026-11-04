import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { DEFAULT_DAY_TEMPLATES, STORAGE_KEY, normalizeDayTemplates, type DaySlipSettings, type DaySlipStore } from "../dayslipTypes";
import { normalizeStore } from "../daySlipState";

export type SaveStatus = "loading" | "saving" | "saved" | "error";
interface Cache {
  store: DaySlipStore;
  settings: DaySlipSettings;
  dirtyDays: string[];
  settingsDirty: boolean;
}
const defaultSettings = (): DaySlipSettings => ({ recurringItems: [], dayTemplates: DEFAULT_DAY_TEMPLATES, weekPlan: null });
export const daySlipCacheKey = (userId: string, tenantId: string) => `${STORAGE_KEY}:${userId}:${tenantId}`;

function readCache(key: string): Cache {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Cache;
      return { store: normalizeStore(parsed.store), settings: { ...defaultSettings(), ...parsed.settings }, dirtyDays: Array.isArray(parsed.dirtyDays) ? parsed.dirtyDays : [], settingsDirty: !!parsed.settingsDirty };
    }
  } catch { /* A broken cache must never be uploaded. */ }
  return { store: {}, settings: defaultSettings(), dirtyDays: [], settingsDirty: false };
}

/** Mount under a user/tenant key. All writes, including metadata, go through this queue. */
export function useDaySlipPersistence(userId: string, tenantId: string) {
  const cacheKey = daySlipCacheKey(userId, tenantId);
  const [initial] = useState(() => readCache(cacheKey));
  const [store, renderStore] = useState(initial.store);
  const [settings, renderSettings] = useState(initial.settings);
  const storeRef = useRef(store);
  const settingsRef = useRef(settings);
  const dirty = useRef(new Map(initial.dirtyDays.map(key => [key, 1])));
  const settingsVersion = useRef(initial.settingsDirty ? 1 : 0);
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [saveError, setSaveError] = useState<string | null>(null);
  const active = useRef(true);
  const loading = useRef<Promise<void> | null>(null);
  const saving = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);

  const cache = useCallback(() => {
    localStorage.setItem(cacheKey, JSON.stringify({ store: storeRef.current, settings: settingsRef.current, dirtyDays: [...dirty.current.keys()], settingsDirty: settingsVersion.current > 0 } satisfies Cache));
  }, [cacheKey]);
  const reportError = useCallback((error: unknown) => {
    if (!active.current) return;
    setSaveStatus("error");
    setSaveError(error && typeof error === "object" && "message" in error ? String(error.message) : String(error));
  }, []);

  const flush = useCallback((): Promise<boolean> => {
    if (saving.current) return saving.current;
    if (!readyRef.current) return Promise.resolve(false);
    if (timer.current) clearTimeout(timer.current);
    if (!dirty.current.size && !settingsVersion.current) {
      if (active.current) { setSaveStatus("saved"); setSaveError(null); }
      return Promise.resolve(true);
    }
    const run = async () => {
      try {
        if (active.current) { setSaveStatus("saving"); setSaveError(null); }
        // Versions prevent a response from clearing edits made while the request was in flight.
        while (dirty.current.size || settingsVersion.current) {
          const versions = new Map(dirty.current);
          const rows = [...versions.keys()].filter(key => storeRef.current[key]).map(key => ({ user_id: userId, tenant_id: tenantId, day_key: key, data: storeRef.current[key] as unknown as Json, updated_at: new Date().toISOString() }));
          if (rows.length) {
            const { error } = await supabase.from("day_slips").upsert(rows, { onConflict: "user_id,day_key" });
            if (error) throw error;
          }
          versions.forEach((version, key) => { if (dirty.current.get(key) === version) dirty.current.delete(key); });
          const preferenceVersion = settingsVersion.current;
          if (preferenceVersion) {
            const { error } = await supabase.from("user_preferences").upsert({ user_id: userId, tenant_id: tenantId, key: "dayslip_settings_v3", value: settingsRef.current as unknown as Json, updated_at: new Date().toISOString() }, { onConflict: "user_id,tenant_id,key" });
            if (error) throw error;
            if (settingsVersion.current === preferenceVersion) settingsVersion.current = 0;
          }
          // Once the server acknowledged everything, a full browser cache must not turn
          // a successful remote save into a failed completion.
          try { cache(); } catch (error) { if (dirty.current.size || settingsVersion.current) throw error; }
        }
        retryCount.current = 0;
        if (active.current) { setSaveStatus("saved"); setSaveError(null); }
        return true;
      } catch (error) {
        reportError(error);
        // The local queue is retained for manual retry, reconnect and the next session.
        return false;
      } finally { saving.current = null; }
    };
    saving.current = run();
    return saving.current;
  }, [cache, reportError, userId, tenantId]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setSaveStatus("saving");
    timer.current = setTimeout(() => { void flush(); }, 700);
  }, [flush]);

  const setStore = useCallback((action: SetStateAction<DaySlipStore>) => {
    const prev = storeRef.current;
    const next = typeof action === "function" ? action(prev) : action;
    if (next === prev) return;
    for (const key of Object.keys(next)) {
      if (next[key] !== prev[key]) dirty.current.set(key, (dirty.current.get(key) ?? 0) + 1);
    }
    storeRef.current = next;
    renderStore(next);
    schedule();
    try { cache(); } catch (error) { reportError(error); }
  }, [cache, schedule, reportError]);

  const setSettings = useCallback((action: SetStateAction<DaySlipSettings>) => {
    const prev = settingsRef.current;
    const next = typeof action === "function" ? action(prev) : action;
    if (next === prev) return;
    settingsRef.current = next;
    settingsVersion.current++;
    renderSettings(next);
    schedule();
    try { cache(); } catch (error) { reportError(error); }
  }, [cache, schedule, reportError]);

  const load = useCallback((): Promise<void> => {
    if (loading.current) return loading.current;
    const run = async () => {
      try {
        setSaveStatus("loading"); setSaveError(null);
        const [days, preferences] = await Promise.all([
          supabase.from("day_slips").select("day_key, data").eq("user_id", userId),
          supabase.from("user_preferences").select("key, value").eq("user_id", userId).eq("tenant_id", tenantId).in("key", ["dayslip_settings_v3", "dayslip_recurring", "dayslip_day_templates", "dayslip_week_plan"]),
        ]);
        if (!active.current) return;
        if (days.error) throw days.error;
        if (preferences.error) throw preferences.error;
        const db = normalizeStore(Object.fromEntries((days.data ?? []).map(row => [row.day_key, row.data])));
        // A dirty local day is newer than the last acknowledged DB write. Never replace it on reload.
        const merged = { ...storeRef.current, ...db };
        dirty.current.forEach((_, key) => { if (storeRef.current[key]) merged[key] = storeRef.current[key]; });
        storeRef.current = merged;
        renderStore(merged);
        if (!settingsVersion.current) {
          const prefs = new Map((preferences.data ?? []).map(row => [row.key, row.value]));
          const v3 = prefs.get("dayslip_settings_v3") as unknown as DaySlipSettings | undefined;
          const next: DaySlipSettings = v3 ? { ...defaultSettings(), ...v3, dayTemplates: normalizeDayTemplates(v3.dayTemplates) } : {
            recurringItems: Array.isArray(prefs.get("dayslip_recurring")) ? prefs.get("dayslip_recurring") as unknown as DaySlipSettings["recurringItems"] : [],
            dayTemplates: normalizeDayTemplates(prefs.get("dayslip_day_templates")),
            weekPlan: (prefs.get("dayslip_week_plan") as unknown as DaySlipSettings["weekPlan"]) ?? null,
          };
          settingsRef.current = next; renderSettings(next);
        }
        readyRef.current = true;
        setReady(true);
        cache();
        setSaveStatus(dirty.current.size || settingsVersion.current ? "saving" : "saved");
      } catch (error) { reportError(error); }
      finally { loading.current = null; }
    };
    loading.current = run();
    return loading.current;
  }, [userId, tenantId, cache, reportError]);

  useEffect(() => {
    active.current = true;
    void load();
    return () => {
      active.current = false;
      if (timer.current) clearTimeout(timer.current);
      // Queue has already been written synchronously to this account's local cache.
      void flush();
    };
  }, [load, flush]);

  useEffect(() => {
    if (ready && (dirty.current.size || settingsVersion.current)) schedule();
  }, [ready, schedule]);

  useEffect(() => {
    if (saveStatus !== "error" || !ready || retryCount.current >= 3) return;
    const retry = setTimeout(() => { retryCount.current++; void flush(); }, 2000 * 2 ** retryCount.current);
    return () => clearTimeout(retry);
  }, [saveStatus, ready, flush]);

  useEffect(() => {
    const retry = () => { retryCount.current = 0; if (readyRef.current) void flush(); else void load(); };
    const leave = () => { try { cache(); } catch { /* Reported on the preceding write. */ } void flush(); };
    const visibility = () => { if (document.visibilityState === "hidden") leave(); };
    window.addEventListener("online", retry);
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("online", retry); window.removeEventListener("pagehide", leave); document.removeEventListener("visibilitychange", visibility); };
  }, [cache, flush, load]);

  const retrySave = useCallback(async () => { retryCount.current = 0; if (!readyRef.current) await load(); return flush(); }, [load, flush]);
  return { store, storeRef, setStore, settings, setSettings, ready, saveStatus, saveError, flush, retrySave };
}
