import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select-simple";
import { useResponsibilities } from "./useResponsibilities";

export function ResponsibilityContextFields({
  regionIds,
  committeeIds,
  onChange,
}: {
  regionIds: string[];
  committeeIds: string[];
  onChange: (patch: { regionIds?: string[]; committeeIds?: string[] }) => void;
}) {
  const { data } = useResponsibilities();
  if (!data) return null;
  return (
    <div className="space-y-2">
      <Label>Regionen für Zuständigkeitsvorschlag</Label>
      <MultiSelect
        options={data.regions
          .filter((r) => r.is_active)
          .map((r) => ({ value: r.id, label: r.name }))}
        selected={regionIds}
        onChange={(regionIds) => onChange({ regionIds })}
        placeholder="Regionen auswählen …"
      />
      <Label>Ausschüsse für Zuständigkeitsvorschlag</Label>
      <MultiSelect
        options={data.committees
          .filter((r) => r.is_active)
          .map((r) => ({ value: r.id, label: r.name }))}
        selected={committeeIds}
        onChange={(committeeIds) => onChange({ committeeIds })}
        placeholder="Ausschüsse auswählen …"
      />
    </div>
  );
}
