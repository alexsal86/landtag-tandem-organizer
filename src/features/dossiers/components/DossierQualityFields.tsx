import { useState } from "react";
import { useUpdateDossier } from "../hooks/useDossiers";
import { usePositionVersions, useCreatePositionVersion } from "../hooks/usePositionVersions";
import type { Dossier } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { HelpCircle, Users, AlertTriangle, Save, Loader2, History } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

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
  const { data: versions } = usePositionVersions(dossier.id);
  const createVersion = useCreatePositionVersion();

  const [values, setValues] = useState({
    open_questions: dossier.open_questions ?? "",
    positions: dossier.positions ?? "",
    risks_opportunities: dossier.risks_opportunities ?? "",
  });
  const [dirty, setDirty] = useState(false);
  const [changeReason, setChangeReason] = useState("");

  const handleChange = (key: keyof typeof values, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    const positionsChanged = values.positions !== (dossier.positions ?? "");
    if (positionsChanged && (dossier.positions ?? "").trim()) {
      // archive previous position
      createVersion.mutate({
        dossier_id: dossier.id,
        content_html: dossier.positions ?? "",
        change_reason: changeReason || undefined,
      });
    }
    updateDossier.mutate(
      { id: dossier.id, ...values },
      { onSuccess: () => { setDirty(false); setChangeReason(""); } }
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

      {dirty && values.positions !== (dossier.positions ?? "") && (dossier.positions ?? "").trim() && (
        <Input
          placeholder="Änderungsgrund (z. B. „Fraktionsbeschluss 12.03.")"
          value={changeReason}
          onChange={(e) => setChangeReason(e.target.value)}
        />
      )}

      {dirty && (
        <Button onClick={handleSave} disabled={updateDossier.isPending} className="w-full">
          {updateDossier.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Qualitätsfelder speichern
        </Button>
      )}

      {versions && versions.length > 0 && (
        <Card className="border-border">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" /> Positions-Verlauf
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {versions.map((v) => (
              <div key={v.id} className="text-xs border-l-2 border-muted pl-2">
                <p className="text-muted-foreground">
                  Stand {format(new Date(v.valid_from), "dd.MM.yyyy", { locale: de })}
                  {v.change_reason ? ` · ${v.change_reason}` : ""}
                </p>
                {v.content_html && (
                  <p className="text-foreground whitespace-pre-wrap line-clamp-3 mt-0.5">{v.content_html}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
