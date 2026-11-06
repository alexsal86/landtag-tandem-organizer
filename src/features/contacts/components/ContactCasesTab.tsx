import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Briefcase, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { EmptyState, LoadingState } from "@/components/ui-patterns";
import { BALL_LABELS, type BallOwner } from "@/features/cases/items/ball";

type CaseRow = { id: string; subject: string | null; status: string; ball_owner: string; next_action_label: string | null; updated_at: string };
type LetterRow = { id: string; title: string; subject: string | null; status: string; letter_date: string | null; created_at: string };

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("de-DE") : "");

export function useContactCases(contactId: string | null) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: ["contact-cases", tenantId, contactId],
    enabled: !!tenantId && !!contactId,
    staleTime: 60_000,
    queryFn: async () => {
      const [cases, letters] = await Promise.all([
        supabase.from("case_items").select("id, subject, status, ball_owner, next_action_label, updated_at")
          .eq("tenant_id", tenantId!).eq("contact_id", contactId!).order("updated_at", { ascending: false }).limit(100),
        supabase.from("letters").select("id, title, subject, status, letter_date, created_at")
          .eq("tenant_id", tenantId!).eq("contact_id", contactId!).order("created_at", { ascending: false }).limit(100),
      ]);
      if (cases.error) throw cases.error;
      if (letters.error) throw letters.error;
      return { cases: (cases.data ?? []) as CaseRow[], letters: (letters.data ?? []) as LetterRow[] };
    },
  });
}

export function ContactCasesTab({ contactId }: { contactId: string | null }) {
  const navigate = useNavigate();
  const { data, isLoading } = useContactCases(contactId);
  if (isLoading) return <LoadingState />;
  const cases = data?.cases ?? [];
  const letters = data?.letters ?? [];
  if (!cases.length && !letters.length) {
    return <EmptyState icon={Briefcase} title="Noch keine Vorgänge oder Briefe" description="Sobald ein Vorgang oder Brief mit dieser Person verknüpft ist, erscheint er hier." />;
  }
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <div className="section-label">Vorgänge ({cases.length})</div>
        {cases.map((c) => (
          <button key={c.id} type="button" onClick={() => navigate(`/mywork?tab=cases&caseItemId=${c.id}`)}
            className="w-full rounded-md border bg-card p-3 text-left transition-colors hover:bg-muted">
            <div className="flex items-center gap-2">
              <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-sm font-medium">{c.subject || "Ohne Titel"}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{fmt(c.updated_at)}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Am Zug: {BALL_LABELS[c.ball_owner as BallOwner] ?? c.ball_owner}
              {c.next_action_label ? ` · Nächster Schritt: ${c.next_action_label}` : ""}
            </div>
          </button>
        ))}
      </section>
      <section className="space-y-2">
        <div className="section-label">Briefe ({letters.length})</div>
        {letters.map((l) => (
          <button key={l.id} type="button" onClick={() => navigate(`/letters/${l.id}`)}
            className="flex w-full items-center gap-2 rounded-md border bg-card p-3 text-left transition-colors hover:bg-muted">
            <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-sm font-medium">{l.subject || l.title || "Ohne Betreff"}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{fmt(l.letter_date || l.created_at)}</span>
          </button>
        ))}
      </section>
    </div>
  );
}
