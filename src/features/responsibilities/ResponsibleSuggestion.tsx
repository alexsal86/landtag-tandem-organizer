import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "./berlinDay";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useResponsibilities } from "./useResponsibilities";
import { suggestResponsible, type ResponsibilityContext } from "./suggest";

export function ResponsibleSuggestion({
  context,
  onAccept,
}: {
  context: ResponsibilityContext;
  onAccept: (userId: string) => void;
}) {
  const model = useResponsibilities();
  const ids = model.data?.people.map((p) => p.id) ?? [];
  const today = formatInTimeZone(new Date());
  const leaves = useQuery({
    queryKey: ["responsibility-absences", model.tenantId, ids, today],
    enabled: !!model.data && ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      // leave_requests has neither tenant_id nor a profile FK. Never load reasons.
      const r = await supabase
        .from("leave_requests")
        .select("user_id")
        .in("user_id", ids)
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today);
      if (r.error) throw r.error;
      return r.data.map((l) => l.user_id);
    },
  });
  if (model.error || leaves.error)
    return (
      <p className="text-sm text-muted-foreground">
        Zuständigkeitsvorschlag derzeit nicht verfügbar.
      </p>
    );
  if (!model.data || leaves.isLoading) return null;
  const suggestion = suggestResponsible(
    context,
    model.data.responsibilities,
    leaves.data ?? [],
  )[0];
  if (!suggestion) return null;
  const nameOf = (id: string) =>
    model.data?.people.find((p) => p.id === id)?.name ?? "Unbekannt";
  return (
    <div className="rounded-md border p-3 text-sm text-muted-foreground">
      <p>
        Zuständig laut Matrix: {nameOf(suggestion.userId)}. {suggestion.reason}
      </p>
      {suggestion.absentUserIds.length > 0 && (
        <p>{suggestion.absentUserIds.map(nameOf).join(", ")} abwesend.</p>
      )}
      <Button
        type="button"
        variant="link"
        size="sm"
        onClick={() => onAccept(suggestion.userId)}
      >
        Ball übergeben?
      </Button>
    </div>
  );
}
