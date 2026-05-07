import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

export type OnboardingSlide = {
  id: string;
  title: string;
  body: string;
  icon: string;
  accent: string;
  source: "default" | "tenant";
  tenantName?: string;
};

const DEFAULT_SLIDES: OnboardingSlide[] = [
  {
    id: "welcome",
    title: "Willkommen im Abgeordnetenbüro-Workspace",
    body: "Dein zentraler Ort für Termine, Vorgänge, Briefe, Aufgaben und Wissen. Alles, was im Büro passiert – an einem Platz.",
    icon: "Sparkles",
    accent: "#6366F1",
    source: "default",
  },
  {
    id: "capture",
    title: "Schnell erfassen",
    body: "Vorgänge, Termine, Briefe oder Aufgaben legst du in Sekunden an. Mit Cmd+K kommst du überallhin – auch direkt in die Suche.",
    icon: "Zap",
    accent: "#8B5CF6",
    source: "default",
  },
  {
    id: "secure",
    title: "Sicher arbeiten",
    body: "Dein Büro ist ein eigener Mandant: Daten und Berechtigungen sind sauber getrennt. Wer was sieht, regeln Rollen.",
    icon: "ShieldCheck",
    accent: "#10B981",
    source: "default",
  },
  {
    id: "hubs",
    title: "Kalender, MyWork & Briefings",
    body: "Drei zentrale Hubs strukturieren den Tag: der Kalender plant, MyWork bündelt deine Aufgaben, Briefings bereiten Termine vor.",
    icon: "LayoutDashboard",
    accent: "#F59E0B",
    source: "default",
  },
];

type TenantSlideRow = {
  id: string;
  title: string;
  body: string;
  icon: string | null;
  accent: string | null;
  position: number;
  active: boolean;
};

export interface OnboardingGate {
  loading: boolean;
  needsOnboarding: boolean;
  slides: OnboardingSlide[];
  markComplete: () => Promise<void>;
  reopen: () => Promise<void>;
}

export function useOnboardingGate(): OnboardingGate {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [tenantSlides, setTenantSlides] = useState<OnboardingSlide[]>([]);

  const tenantId = currentTenant?.id ?? null;
  const tenantName = currentTenant?.name ?? "";
  const userId = user?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      if (!userId || !tenantId) {
        setLoading(false);
        setNeedsOnboarding(false);
        return;
      }
      setLoading(true);
      const [stateRes, slidesRes] = await Promise.all([
        supabase
          .from("user_onboarding_state")
          .select("completed_at")
          .eq("user_id", userId)
          .eq("tenant_id", tenantId)
          .maybeSingle(),
        supabase
          .from("tenant_onboarding_slides")
          .select("id,title,body,icon,accent,position,active")
          .eq("tenant_id", tenantId)
          .eq("active", true)
          .order("position", { ascending: true }),
      ]);
      if (cancelled) return;
      const rows = (slidesRes.data ?? []) as TenantSlideRow[];
      const mapped: OnboardingSlide[] = rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        icon: r.icon || "Building2",
        accent: r.accent || "#155EEF",
        source: "tenant",
        tenantName,
      }));
      setTenantSlides(mapped);
      setNeedsOnboarding(!stateRes.data?.completed_at);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, tenantId, tenantName]);

  const markComplete = useCallback(async () => {
    if (!userId || !tenantId) return;
    await supabase
      .from("user_onboarding_state")
      .upsert(
        { user_id: userId, tenant_id: tenantId, completed_at: new Date().toISOString() },
        { onConflict: "user_id,tenant_id" },
      );
    setNeedsOnboarding(false);
  }, [userId, tenantId]);

  const reopen = useCallback(async () => {
    if (!userId || !tenantId) return;
    await supabase
      .from("user_onboarding_state")
      .upsert(
        { user_id: userId, tenant_id: tenantId, completed_at: null },
        { onConflict: "user_id,tenant_id" },
      );
    setNeedsOnboarding(true);
  }, [userId, tenantId]);

  const slides: OnboardingSlide[] = [...DEFAULT_SLIDES, ...tenantSlides];

  return { loading, needsOnboarding, slides, markComplete, reopen };
}

export { DEFAULT_SLIDES };
