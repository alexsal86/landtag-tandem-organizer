import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { debugConsole } from "@/utils/debugConsole";
import { useTenant } from "@/hooks/useTenant";

const DEBOUNCE_MS = 500;

/**
 * Generic hook for user preferences persisted in the `user_preferences` table.
 * Falls back to localStorage when unauthenticated. On first authenticated load,
 * migrates any existing localStorage value into the database.
 */
export function useUserPreference<T>(key: string, defaultValue: T) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const localStorageKey = `pref_${key}`;

  // Read initial value from localStorage (fast, synchronous)
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(localStorageKey);
      if (saved !== null) return JSON.parse(saved) as T;
    } catch {
      // ignore
    }
    return defaultValue;
  });

  const dbSynced = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount + auth change: load from DB, migrate localStorage if needed
  useEffect(() => {
    if (!user?.id || !tenantId) {
      dbSynced.current = false;
      return;
    }

    let cancelled = false;

    const loadFromDb = async () => {
      try {
        const { data, error } = await supabase
          .from("user_preferences")
          .select("value")
          .eq("user_id", user.id)
          .eq("tenant_id", tenantId)
          .eq("key", key)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          debugConsole.error("useUserPreference: load error", error);
          return;
        }

        if (data) {
          // DB has value → use it and update local cache
          const dbValue = data.value as T;
          setValue(dbValue);
          try {
            localStorage.setItem(localStorageKey, JSON.stringify(dbValue));
          } catch {
            // ignore
          }
        } else {
          // No DB record yet → migrate current localStorage value
          const currentLocal = localStorage.getItem(localStorageKey);
          if (currentLocal !== null) {
            try {
              const parsed = JSON.parse(currentLocal);
              await supabase.from("user_preferences").upsert(
                {
                  user_id: user.id,
                  tenant_id: tenantId,
                  key,
                  value: parsed,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id,tenant_id,key" }
              );
            } catch {
              // migration is best-effort
            }
          }
        }

        dbSynced.current = true;
      } catch (e) {
        debugConsole.error("useUserPreference: unexpected error", e);
      }
    };

    loadFromDb();

    return () => {
      cancelled = true;
    };
  }, [user?.id, tenantId, key, localStorageKey]);

  // Debounced DB write
  const persistToDb = useCallback(
    (newValue: T) => {
      if (!user?.id || !tenantId) return;

      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      debounceTimer.current = setTimeout(async () => {
        try {
          await supabase.from("user_preferences").upsert(
            {
              user_id: user.id,
              tenant_id: tenantId,
              key,
              value: newValue as unknown,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,tenant_id,key" }
          );
        } catch (e) {
          debugConsole.error("useUserPreference: save error", e);
        }
      }, DEBOUNCE_MS);
    },
    [user?.id, tenantId, key]
  );

  // Wrapped setter: optimistic local + debounced DB
  const setPreference = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof newValue === "function"
            ? (newValue as (prev: T) => T)(prev)
            : newValue;

        // Update localStorage immediately
        try {
          localStorage.setItem(localStorageKey, JSON.stringify(resolved));
        } catch {
          // ignore
        }

        // Debounced DB persist
        persistToDb(resolved);

        return resolved;
      });
    },
    [localStorageKey, persistToDb]
  );

  return [value, setPreference] as const;
}
