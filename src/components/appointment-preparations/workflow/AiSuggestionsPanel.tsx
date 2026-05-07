import { useState } from "react";
import { Sparkles, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useContactBriefingMemory } from "@/hooks/useContactBriefingMemory";
import type { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import { notify } from "@/lib/notify";

interface AiSuggestionsPanelProps {
  preparation: AppointmentPreparation;
  appointmentTitle?: string;
  phase: "fakten" | "themen";
  onUpdate: (updates: Partial<AppointmentPreparation>) => Promise<void>;
}

interface Suggestions {
  facts?: Array<{ topic: string; background: string }>;
  talking_points?: Array<{ point: string; background: string }>;
  qa?: Array<{ question: string; answer: string }>;
  sensitive?: string[];
}

export function AiSuggestionsPanel({ preparation, appointmentTitle, phase, onUpdate }: AiSuggestionsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);

  const partners = preparation.preparation_data?.conversation_partners ?? [];
  const contactIds = partners.map((p) => p.contact_id).filter(Boolean) as string[];
  const { items: memoryItems } = useContactBriefingMemory(contactIds);

  const generate = async () => {
    setLoading(true);
    try {
      const partnersWithMemory = partners.map((p) => ({
        name: p.name,
        role: p.role,
        organization: p.organization,
        memory_items: memoryItems
          .filter((m) => m.contact_id === p.contact_id)
          .map((m) => ({ kind: m.kind, content: m.content, question: m.question, answer: m.answer })),
      }));

      const { data, error } = await supabase.functions.invoke("generate-preparation-suggestions", {
        body: {
          phase,
          appointment_title: appointmentTitle ?? preparation.title,
          visit_reason: preparation.preparation_data?.visit_reason,
          visit_reason_details: preparation.preparation_data?.visit_reason_details,
          partners: partnersWithMemory,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSuggestions(data as Suggestions);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      notify.error("KI-Vorschläge fehlgeschlagen", { description: msg
});
    } finally {
      setLoading(false);
    }
  };

  const adopt = async (kind: "fact" | "tp" | "qa", payload: { topic?: string; background?: string; point?: string; question?: string; answer?: string }) => {
    const data = preparation.preparation_data ?? {};
    if (kind === "fact") {
      const list = [...(data.key_topic_items ?? []), { id: crypto.randomUUID(), topic: payload.topic ?? "", background: payload.background ?? "" }];
      await onUpdate({ preparation_data: { ...data, key_topic_items: list } });
    } else if (kind === "tp") {
      const list = [...(data.talking_point_items ?? []), { id: crypto.randomUUID(), point: payload.point ?? "", background: payload.background ?? "" }];
      await onUpdate({ preparation_data: { ...data, talking_point_items: list } });
    } else if (kind === "qa") {
      const list = [...(data.qa_pairs ?? []), { id: crypto.randomUUID(), question: payload.question ?? "", answer: payload.answer ?? "" }];
      await onUpdate({ preparation_data: { ...data, qa_pairs: list } });
    }
    notify.success("Übernommen");
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            KI-Vorschläge {phase === "fakten" ? "(Fakten)" : "(Talking Points & Q&A)"}
          </span>
          <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
            {loading ? "Generiere…" : suggestions ? "Neu generieren" : "Vorschläge generieren"}
          </Button>
        </CardTitle>
      </CardHeader>
      {suggestions && (
        <CardContent className="space-y-4 pt-0">
          {phase === "fakten" && (suggestions.facts ?? []).length > 0 && (
            <div className="space-y-2">
              {suggestions.facts!.map((f, i) => (
                <div key={i} className="rounded-md bg-muted/30 p-2.5 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{f.topic}</div>
                      {f.background && <div className="text-xs text-muted-foreground mt-0.5">{f.background}</div>}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => adopt("fact", f)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {phase === "themen" && (suggestions.talking_points ?? []).length > 0 && (
            <div className="space-y-2">
              <p className="section-label text-muted-foreground">Talking Points</p>
              {suggestions.talking_points!.map((t, i) => (
                <div key={i} className="rounded-md bg-muted/30 p-2.5 text-sm flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{t.point}</div>
                    {t.background && <div className="text-xs text-muted-foreground mt-0.5">{t.background}</div>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => adopt("tp", t)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {phase === "themen" && (suggestions.qa ?? []).length > 0 && (
            <div className="space-y-2">
              <p className="section-label text-muted-foreground">Q&A</p>
              {suggestions.qa!.map((q, i) => (
                <div key={i} className="rounded-md bg-muted/30 p-2.5 text-sm flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">F: {q.question}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">A: {q.answer}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => adopt("qa", q)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {(suggestions.sensitive ?? []).length > 0 && (
            <div className="space-y-1.5">
              <p className="section-label text-palette-amber">Sensible Punkte</p>
              <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
                {suggestions.sensitive!.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
