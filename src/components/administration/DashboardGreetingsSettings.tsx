import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { dashboardGreetingsQueryKey, useDashboardGreetings } from "@/hooks/useDashboardGreetings";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { DASHBOARD_GREETINGS_KEY, type DashboardGreeting } from "@/utils/dashboard/greetings";
import { TIME_SLOTS, type TimeSlot } from "@/utils/dashboard/timeUtils";

const slotLabels: Record<TimeSlot, string> = {
  morning: "Morgens",
  midday: "Mittags",
  afternoon: "Nachmittags",
  evening: "Abends",
  night: "Nachts",
};
const days = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const monthFormat = new Intl.DateTimeFormat("de-DE", { month: "long", timeZone: "UTC" });
const months = Array.from({ length: 12 }, (_, index) => monthFormat.format(Date.UTC(2026, index, 1)));
const selectClassName = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export function DashboardGreetingsSettings() {
  const { currentTenant } = useTenant();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dashboard-Begrüßungen</CardTitle>
        <p className="text-sm text-muted-foreground">
          Begrüßungen für „Meine Arbeit“. Mit {"{name}"} fügst du den Namen ein.
          Alle gewählten Bedingungen müssen zutreffen. Passen mehrere Begrüßungen, wechseln sie tageweise.
          Ist keine passend, erscheint die Standardbegrüßung zur Tageszeit.
        </p>
      </CardHeader>
      <CardContent>
        {currentTenant
          ? <GreetingsEditor key={currentTenant.id} tenantId={currentTenant.id} />
          : <p className="text-sm text-muted-foreground">Wähle einen Mandanten aus.</p>}
      </CardContent>
    </Card>
  );
}

function GreetingsEditor({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const greetings = useDashboardGreetings(tenantId);
  const [draft, setDraft] = useState<DashboardGreeting[] | null>(null);
  const rules = draft ?? greetings.data ?? [];
  const save = useMutation({
    mutationFn: async (updatedRules: DashboardGreeting[]) => {
      const { error } = await supabase.from("app_settings").upsert({
        tenant_id: tenantId,
        setting_key: DASHBOARD_GREETINGS_KEY,
        setting_value: JSON.stringify(updatedRules),
      }, { onConflict: "tenant_id,setting_key" });
      if (error) throw error;
      return updatedRules;
    },
    onSuccess: async (updatedRules) => {
      const queryKey = dashboardGreetingsQueryKey(tenantId);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, updatedRules);
      setDraft(null);
      notify.success("Dashboard-Begrüßungen gespeichert");
    },
    onError: () => notify.error("Dashboard-Begrüßungen konnten nicht gespeichert werden"),
  });

  const update = (id: string, changes: Partial<DashboardGreeting>) => {
    setDraft(rules.map(rule => rule.id === id ? { ...rule, ...changes } : rule));
  };

  if (greetings.isPending) return <p className="text-sm text-muted-foreground">Begrüßungen werden geladen…</p>;
  if (greetings.isError && !greetings.data) {
    return (
      <div className="space-y-2">
        <p className="text-sm">Begrüßungen konnten nicht geladen werden.</p>
        <Button variant="outline" onClick={() => void greetings.refetch()}>Erneut laden</Button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={event => {
      event.preventDefault();
      if (save.isPending || draft === null || rules.some(rule => !rule.text.trim())) return;
      save.mutate(rules.map(rule => ({ ...rule, text: rule.text.trim() })));
    }}>
      <fieldset disabled={save.isPending} className="space-y-4">
        {rules.map((rule, index) => (
          <fieldset key={rule.id} className="space-y-3 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Begrüßung {index + 1}</legend>
            <div className="flex items-end gap-2">
              <label className="grid flex-1 gap-1 text-sm">
                Text
                <Input value={rule.text} required placeholder="Guten Morgen, {name}!"
                  onChange={event => update(rule.id, { text: event.target.value })} />
              </label>
              <Button type="button" variant="ghost" size="icon" aria-label={`Begrüßung ${index + 1} entfernen`}
                onClick={() => setDraft(rules.filter(item => item.id !== rule.id))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-sm">
                Tageszeit
                <select className={selectClassName} value={rule.timeSlot ?? ""}
                  onChange={event => update(rule.id, { timeSlot: (event.target.value || undefined) as TimeSlot | undefined })}>
                  <option value="">Jede Tageszeit</option>
                  {Object.entries(TIME_SLOTS).map(([slot, { start, end }]) => (
                    <option key={slot} value={slot}>{slotLabels[slot as TimeSlot]} ({start}–{end} Uhr)</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Wochentag
                <select className={selectClassName} value={rule.dayOfWeek ?? ""}
                  onChange={event => update(rule.id, { dayOfWeek: event.target.value === "" ? undefined : Number(event.target.value) })}>
                  <option value="">Jeder Wochentag</option>
                  {days.map((day, dayIndex) => <option key={day} value={dayIndex}>{day}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Monat
                <select className={selectClassName} value={rule.month ?? ""}
                  onChange={event => update(rule.id, { month: event.target.value === "" ? undefined : Number(event.target.value) })}>
                  <option value="">Jeder Monat</option>
                  {months.map((month, monthIndex) => <option key={month} value={monthIndex + 1}>{month}</option>)}
                </select>
              </label>
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setDraft([...rules, { id: crypto.randomUUID(), text: "" }])}>
            <Plus className="mr-2 h-4 w-4" /> Begrüßung hinzufügen
          </Button>
          <Button type="submit" disabled={draft === null || rules.some(rule => !rule.text.trim())}>
            {save.isPending ? "Speichert…" : "Speichern"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
