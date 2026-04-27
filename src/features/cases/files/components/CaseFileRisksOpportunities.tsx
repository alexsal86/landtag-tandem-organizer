import { useState } from "react";
import { CaseFile } from "@/features/cases/files/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShieldAlert, Sparkles, Edit2, Check, X } from "lucide-react";

interface CaseFileRisksOpportunitiesProps {
  caseFile: CaseFile;
  onUpdate: (data: { risks: string[]; opportunities: string[] }) => Promise<boolean>;
}

function parseRisksOpportunities(data: unknown): { risks: string[]; opportunities: string[] } {
  if (!data) return { risks: [], opportunities: [] };
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return { risks: [], opportunities: [] };
    }
  }
  if (typeof data !== "object" || data === null) {
    return { risks: [], opportunities: [] };
  }
  const candidate = data as { risks?: unknown; opportunities?: unknown };
  return {
    risks: Array.isArray(candidate.risks) ? candidate.risks.filter((item): item is string => typeof item === "string") : [],
    opportunities: Array.isArray(candidate.opportunities) ? candidate.opportunities.filter((item): item is string => typeof item === "string") : [],
  };
}

export function CaseFileRisksOpportunities({ caseFile, onUpdate }: CaseFileRisksOpportunitiesProps) {
  const parsed = parseRisksOpportunities(caseFile.risks_and_opportunities);
  const [isEditing, setIsEditing] = useState(false);
  const [risksText, setRisksText] = useState(parsed.risks.join("\n"));
  const [oppsText, setOppsText] = useState(parsed.opportunities.join("\n"));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const risks = risksText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const opportunities = oppsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const success = await onUpdate({ risks, opportunities });
    setSaving(false);
    if (success) setIsEditing(false);
  };

  const handleCancel = () => {
    setRisksText(parsed.risks.join("\n"));
    setOppsText(parsed.opportunities.join("\n"));
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    const freshParsed = parseRisksOpportunities(caseFile.risks_and_opportunities);
    setRisksText(freshParsed.risks.join("\n"));
    setOppsText(freshParsed.opportunities.join("\n"));
    setIsEditing(true);
  };

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground flex items-center justify-between">
          <span>Risiken &amp; Chancen</span>
          {!isEditing && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleStartEdit}>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        {isEditing ? (
          <>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs font-medium">Risiken</span>
              </div>
              <Textarea
                value={risksText}
                onChange={(e) => setRisksText(e.target.value)}
                placeholder="Ein Risiko pro Zeile..."
                rows={3}
                className="text-sm"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">Chancen</span>
              </div>
              <Textarea
                value={oppsText}
                onChange={(e) => setOppsText(e.target.value)}
                placeholder="Eine Chance pro Zeile..."
                rows={3}
                className="text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Check className="mr-1 h-3.5 w-3.5" />
                {saving ? "Speichern..." : "Speichern"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                <X className="mr-1 h-3.5 w-3.5" />
                Abbrechen
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Risks */}
            {parsed.risks.length > 0 ? (
              parsed.risks.map((r, i) => (
                <div key={`r-${i}`} className="border-l-2 border-destructive pl-3">
                  <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-destructive mb-0.5">
                    Risiko
                  </div>
                  <p className="text-sm text-foreground leading-snug">{r}</p>
                </div>
              ))
            ) : (
              <div className="border-l-2 border-destructive/40 pl-3">
                <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-destructive/70 mb-0.5">
                  Risiko
                </div>
                <p className="text-xs text-muted-foreground italic">Keine Risiken eingetragen</p>
              </div>
            )}

            {/* Opportunities */}
            {parsed.opportunities.length > 0 ? (
              parsed.opportunities.map((o, i) => (
                <div key={`o-${i}`} className="border-l-2 border-primary pl-3">
                  <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-primary mb-0.5">
                    Chance
                  </div>
                  <p className="text-sm text-foreground leading-snug">{o}</p>
                </div>
              ))
            ) : (
              <div className="border-l-2 border-primary/40 pl-3">
                <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-primary/70 mb-0.5">
                  Chance
                </div>
                <p className="text-xs text-muted-foreground italic">Keine Chancen eingetragen</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
