import { useState } from "react";
import { RoutineStepsEditor } from "@/components/administration/automationRule/RoutineStepsEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useHrData } from "./useHrData";
import {
  HR_DEFAULT_TEMPLATES,
  hrEditorFields,
  hrStepsFromEditor,
  type HrTemplateStep,
} from "./templates";
import type { Json } from "@/integrations/supabase/types";
export function HrTemplateEditor() {
  const model = useHrData();
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    id: "",
    name: HR_DEFAULT_TEMPLATES[0].name,
    type: "praktikum",
    direction: "onboarding",
    ...hrEditorFields(HR_DEFAULT_TEMPLATES[0].steps),
  });
  const perform = async (
    input: Parameters<typeof model.mutation.mutateAsync>[0],
  ) => {
    setError("");
    try {
      await model.mutation.mutateAsync(input);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  };
  if (!model.isAdmin)
    return <p>Nur Büroleitung und Abgeordnete bearbeiten HR-Vorlagen.</p>;
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">HR-Rollenvorlagen</h2>
      <p className="text-sm text-muted-foreground">
        Der bestehende Routinen-Editor steuert Aufgaben oder Checklistenpunkte.
        Laufende Pakete behalten ihren Stand. Termine zählen Kalendertage ab
        Eintritt oder Austritt.
      </p>
      {model.error && <p role="alert">{model.error.message}</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <Button
        variant="outline"
        disabled={!model.tenantId || model.mutation.isPending}
        onClick={() => {
          if (model.tenantId)
            void perform({
              name: "seed_employee_hr_templates",
              args: { p_tenant: model.tenantId },
            });
        }}
      >
        Fehlende Standardvorlagen bereitstellen
      </Button>
      <div className="flex gap-2 flex-wrap">
        {model.data?.templates.map((t) => (
          <Button
            variant={draft.id === t.id ? "default" : "outline"}
            key={t.id}
            onClick={() =>
              setDraft({
                id: t.id,
                name: t.name,
                type: t.employment_type,
                direction: t.direction,
                ...hrEditorFields(t.steps as unknown as HrTemplateStep[]),
              })
            }
          >
            {t.name}
          </Button>
        ))}
        <Button
          variant="ghost"
          onClick={() =>
            setDraft({
              id: "",
              name: "Neue HR-Vorlage",
              type: "sonstige",
              direction: "onboarding",
              ...hrEditorFields(HR_DEFAULT_TEMPLATES[0].steps),
            })
          }
        >
          Neue Vorlage
        </Button>
      </div>
      <Label>
        Name
        <Input
          value={draft.name}
          maxLength={120}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </Label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label>
          Beschäftigungsart (all = alle)
          <Input
            value={draft.type}
            maxLength={40}
            onChange={(e) => setDraft({ ...draft, type: e.target.value })}
          />
        </Label>
        <Label>
          Ablauf
          <Select
            value={draft.direction}
            onValueChange={(direction) => setDraft({ ...draft, direction })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="onboarding">Onboarding</SelectItem>
              <SelectItem value="offboarding">Offboarding</SelectItem>
            </SelectContent>
          </Select>
        </Label>
      </div>
      <RoutineStepsEditor
        prefix="hr"
        value={draft.value}
        kinds={draft.kinds}
        settings={draft.settings}
        hrMetadata={draft.metadata}
        onChange={(value, kinds, settings) =>
          setDraft((previous) => ({ ...previous, value, kinds, settings }))
        }
        onHrMetadataChange={(metadata) =>
          setDraft((previous) => ({ ...previous, metadata }))
        }
      />
      <Button
        disabled={
          model.mutation.isPending ||
          !model.tenantId ||
          !draft.name.trim() ||
          !draft.type.trim()
        }
        onClick={() => {
          if (!model.tenantId) return;
          try {
            void perform({
              name: "save_employee_hr_template",
              args: {
                p_tenant: model.tenantId,
                p_id: draft.id || undefined,
                p_name: draft.name,
                p_type: draft.type,
                p_direction: draft.direction,
                p_steps: hrStepsFromEditor(
                  draft.value,
                  draft.kinds,
                  draft.settings,
                  draft.metadata,
                ) as unknown as Json,
              },
            });
          } catch (e) {
            setError(e instanceof Error ? e.message : "Vorlage ungültig.");
          }
        }}
      >
        Vorlage speichern
      </Button>
    </section>
  );
}
export default HrTemplateEditor;
