import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";

export type ChecklistItem = {
  key: string;
  label: string;
  description: string;
  icon: string;
  cta_route?: string;
  required_role?: string | null;
  source: "default" | "tenant";
};

const DEFAULT_ITEMS: ChecklistItem[] = [
  {
    key: "profile.complete",
    label: "Profil vervollständigen",
    description: "Foto, Anzeigename und Telefon hinterlegen.",
    icon: "UserCircle2",
    cta_route: "/einstellungen/profil",
    source: "default",
  },
  {
    key: "contact.first",
    label: "Ersten Kontakt anlegen",
    description: "Bürger*in oder Stakeholder erfassen.",
    icon: "Users",
    cta_route: "/kontakte",
    source: "default",
  },
  {
    key: "appointment.first",
    label: "Ersten Termin planen",
    description: "Termin im Kalender anlegen oder importieren.",
    icon: "CalendarPlus",
    cta_route: "/kalender",
    source: "default",
  },
  {
    key: "letter.first",
    label: "Ersten Brief entwerfen",
    description: "DIN-5008 Brief im Designer öffnen.",
    icon: "Mail",
    cta_route: "/briefe",
    source: "default",
  },
  {
    key: "team.invite",
    label: "Team einladen",
    description: "Mitarbeiter*innen zum Büro hinzufügen.",
    icon: "UserPlus",
    cta_route: "/administration/team",
    required_role: "abgeordneter,bueroleitung",
    source: "default",
  },
  {
    key: "tour.complete",
    label: "Einführungstour abgeschlossen",
    description: "Die Welcome-Tour einmal durchlaufen.",
    icon: "Sparkles",
    source: "default",
  },
];

type DbRow = {
  item_key: string;
  label: string;
  description: string | null;
  icon: string | null;
  cta_route: string | null;
  position: number;
  required_role: string | null;
  active: boolean;
};

export interface OnboardingChecklist {
  loading: boolean;
  items: ChecklistItem[];
  progress: Record<string, boolean>;
  completedCount: number;
  totalCount: number;
  dismissed: boolean;
  setItemDone: (key: string, done: boolean) => Promise<void>;
  dismiss: () => Promise<void>;
  restore: () => Promise<void>;
  detectAndSync: () => Promise<void>;
}

function roleAllowed(item: ChecklistItem, role: string | null): boolean {
  if (!item.required_role) return true;
  const allowed = item.required_role.split(",").map((r) => r.trim());
  return !!role && allowed.includes(role);
}

export function useOnboardingChecklist(): OnboardingChecklist {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { role } = useResolvedUserRole();
  const userId = user?.id ?? null;
  const tenantId = currentTenant?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [dismissed, setDismissed] = useState(false);
  const [tenantItems, setTenantItems] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    if (!userId || !tenantId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [stateRes, itemsRes] = await Promise.all([
        supabase
          .from("user_onboarding_state")
          .select("checklist_progress, checklist_dismissed_at")
          .eq("user_id", userId)
          .eq("tenant_id", tenantId)
          .maybeSingle(),
        supabase
          .from("tenant_onboarding_checklist_items")
          .select("item_key,label,description,icon,cta_route,position,required_role,active")
          .eq("tenant_id", tenantId)
          .eq("active", true)
          .order("position", { ascending: true }),
      ]);
      if (cancelled) return;
      const progressMap = (stateRes.data?.checklist_progress ?? {}) as Record<string, boolean>;
      setProgress(progressMap);
      setDismissed(!!stateRes.data?.checklist_dismissed_at);
      const rows = (itemsRes.data ?? []) as DbRow[];
      setTenantItems(
        rows.map((r) => ({
          key: r.item_key,
          label: r.label,
          description: r.description ?? "",
          icon: r.icon || "Circle",
          cta_route: r.cta_route ?? undefined,
          required_role: r.required_role,
          source: "tenant",
        })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, tenantId]);

  const items = useMemo(() => {
    const all: ChecklistItem[] = [...DEFAULT_ITEMS, ...tenantItems];
    return all.filter((i) => roleAllowed(i, role));
  }, [tenantItems, role]);

  const completedCount = items.filter((i) => progress[i.key]).length;

  const persistProgress = useCallback(
    async (next: Record<string, boolean>) => {
      if (!userId || !tenantId) return;
      await supabase
        .from("user_onboarding_state")
        .upsert(
          { user_id: userId, tenant_id: tenantId, checklist_progress: next },
          { onConflict: "user_id,tenant_id" },
        );
    },
    [userId, tenantId],
  );

  const setItemDone = useCallback(
    async (key: string, done: boolean) => {
      const next = { ...progress, [key]: done };
      setProgress(next);
      await persistProgress(next);
    },
    [progress, persistProgress],
  );

  const dismiss = useCallback(async () => {
    if (!userId || !tenantId) return;
    setDismissed(true);
    await supabase
      .from("user_onboarding_state")
      .upsert(
        { user_id: userId, tenant_id: tenantId, checklist_dismissed_at: new Date().toISOString() },
        { onConflict: "user_id,tenant_id" },
      );
  }, [userId, tenantId]);

  const restore = useCallback(async () => {
    if (!userId || !tenantId) return;
    setDismissed(false);
    await supabase
      .from("user_onboarding_state")
      .upsert(
        { user_id: userId, tenant_id: tenantId, checklist_dismissed_at: null },
        { onConflict: "user_id,tenant_id" },
      );
  }, [userId, tenantId]);

  // Auto-Erkennung: wenn z.B. ein Kontakt existiert, Item automatisch erledigen.
  const detectAndSync = useCallback(async () => {
    if (!userId || !tenantId) return;
    const next: Record<string, boolean> = { ...progress };
    let changed = false;

    const set = (k: string, v: boolean) => {
      if (v && !next[k]) {
        next[k] = true;
        changed = true;
      }
    };

    const [profileRes, contactsRes, apptsRes, lettersRes, teamRes] = await Promise.all([
      supabase.from("profiles").select("display_name, avatar_url").eq("id", userId).maybeSingle(),
      supabase.from("contacts").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).limit(1),
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).limit(1),
      supabase.from("letters").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).limit(1),
      supabase.from("user_roles").select("id", { count: "exact", head: true }).limit(2),
    ]);

    if (profileRes.data?.display_name) set("profile.complete", true);
    if ((contactsRes.count ?? 0) > 0) set("contact.first", true);
    if ((apptsRes.count ?? 0) > 0) set("appointment.first", true);
    if ((lettersRes.count ?? 0) > 0) set("letter.first", true);
    if ((teamRes.count ?? 0) > 1) set("team.invite", true);

    if (changed) {
      setProgress(next);
      await persistProgress(next);
    }
  }, [userId, tenantId, progress, persistProgress]);

  return {
    loading,
    items,
    progress,
    completedCount,
    totalCount: items.length,
    dismissed,
    setItemDone,
    dismiss,
    restore,
    detectAndSync,
  };
}
