import { useState } from "react";
import { useUpdateDossier } from "../hooks/useDossiers";
import type { Dossier } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HelpCircle, Users, AlertTriangle, Save, Loader2 } from "lucide-react";

interface DossierQualityFieldsProps {
  dossier: Dossier;
}

const FIELDS = [
  {
    key: "open_questions" as const,
    label: "Offene Fragen",
    icon: HelpCircle,
    placeholder: "Welche Fragen sind noch ungeklärt?",
    color: "text-amber-600",
  },
  {
    key: "positions" as const,
    label: "Positionen",
    icon: Users,
    placeholder: "Welche Positionen/Standpunkte gibt es?",
    color: "text-blue-600",
  },
  {
    key: "risks_opportunities" as const,
    label: "Risiken & Chancen",
    icon: AlertTriangle,
    placeholder: "Welche Risiken und Chancen sind zu beachten?",
    color: "text-red-600",
  },
] as const;

export function DossierQualityFields({ dossier }: DossierQualityFieldsProps) {
  const updateDossier = useUpdateDossier();

  const [values, setValues] = useState({
    open_questions: dossier.open_questions ?? "",
    positions: dossier.positions ?? "",
    risks_opportunities: dossier.risks_opportunities ?? "",
  });
  const [dirty, setDirty] = useState(false);

  const handleChange = (key: keyof typeof values, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    updateDossier.mutate(
      { id: dossier.id, ...values },
      { onSuccess: () => setDirty(false) }
    );
  };

  return (
    <div className="space-y-4">
      {FIELDS.map((field) => {
        const Icon = field.icon;
        return (
          <Card key={field.key} className="border-border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Icon className={`h-4 w-4 ${field.color}`} />
                {field.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <Textarea
                placeholder={field.placeholder}
                value={values[field.key]}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className="min-h-[80px] text-sm"
              />
            </CardContent>
          </Card>
        );
      })}

      {dirty && (
        <Button onClick={handleSave} disabled={updateDossier.isPending} className="w-full">
          {updateDossier.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Qualitätsfelder speichern
        </Button>
      )}
    </div>
  );
}
