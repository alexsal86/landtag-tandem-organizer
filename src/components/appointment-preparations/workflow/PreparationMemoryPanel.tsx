import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus, Pin } from "lucide-react";
import { useContactBriefingMemory, type MemoryKind } from "@/hooks/useContactBriefingMemory";
import type { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import { getConversationPartnersFromPreparationData } from "@/hooks/useAppointmentPreparation";
import { toast } from "@/hooks/use-toast";

interface Props {
  preparation: AppointmentPreparation;
  onUpdate: (updates: Partial<AppointmentPreparation>) => Promise<void>;
}

const KIND_LABELS: Record<MemoryKind, string> = {
  position: "Position",
  talking_point: "Talking Point",
  qa: "Q&A",
  sensitive: "Sensibel",
  role_note: "Rolle",
};

export function PreparationMemoryPanel({ preparation, onUpdate }: Props) {
  const partners = useMemo(
    () => getConversationPartnersFromPreparationData(preparation.preparation_data),
    [preparation.preparation_data],
  );
  const linkedContactIds = useMemo(
    () => partners.map((p) => p.contact_id).filter((v): v is string => Boolean(v)),
    [partners],
  );
  const { items, loading, add } = useContactBriefingMemory(linkedContactIds);

  if (linkedContactIds.length === 0) return null;

  const partnerLabelById = new Map(partners.filter((p) => p.contact_id).map((p) => [p.contact_id!, p.name || "Kontakt"]));

  const adoptItem = async (item: typeof items[number]) => {
    const data = (preparation.preparation_data ?? {}) as Record<string, unknown>;
    let updated: Record<string, unknown> = data;

    if (item.kind === "talking_point") {
      const list = ((data.talking_point_items as Array<{ id: string; point: string; background: string }>) ?? []).slice();
      list.push({ id: crypto.randomUUID(), point: item.content ?? "", background: "" });
      updated = { ...data, talking_point_items: list };
    } else if (item.kind === "qa") {
      const list = ((data.qa_pairs as Array<{ id: string; question: string; answer: string }>) ?? []).slice();
      list.push({ id: crypto.randomUUID(), question: item.question ?? "", answer: item.answer ?? "" });
      updated = { ...data, qa_pairs: list };
    } else if (item.kind === "position" || item.kind === "sensitive" || item.kind === "role_note") {
      const list = ((data.key_topic_items as Array<{ id: string; topic: string; background: string }>) ?? []).slice();
      list.push({ id: crypto.randomUUID(), topic: item.content ?? "", background: KIND_LABELS[item.kind] });
      updated = { ...data, key_topic_items: list };
    }

    await onUpdate({ preparation_data: updated as AppointmentPreparation["preparation_data"] });
    toast({ title: "Übernommen", description: "Eintrag aus dem Briefing-Gedächtnis übernommen." });
  };

  const pinNewKeyTopic = async (topicText: string, contactId: string) => {
    if (!topicText.trim()) return;
    await add({ contact_id: contactId, kind: "talking_point", content: topicText, source_preparation_id: preparation.id });
    toast({ title: "Gemerkt", description: "Eintrag im Briefing-Gedächtnis gespeichert." });
  };

  const currentTopics = ((preparation.preparation_data?.key_topic_items ?? []) as Array<{ topic: string }>).filter((t) => t.topic?.trim());

  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          Briefing-Gedächtnis ({linkedContactIds.length} verknüpfter Kontakt{linkedContactIds.length === 1 ? "" : "e"})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <p className="text-xs text-muted-foreground">Lade Vorschläge…</p>}

        {items.length > 0 && (
          <div className="space-y-1.5">
            <p className="section-label text-muted-foreground">Vorschläge aus früheren Gesprächen</p>
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-2 rounded-md bg-background/60 p-2 text-sm">
                <span className="mt-0.5 inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                  {KIND_LABELS[item.kind]}
                </span>
                <div className="flex-1 min-w-0">
                  {item.kind === "qa" ? (
                    <>
                      <div className="font-medium">F: {item.question}</div>
                      {item.answer && <div className="text-muted-foreground text-xs">A: {item.answer}</div>}
                    </>
                  ) : (
                    <span>{item.content}</span>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {partnerLabelById.get(item.contact_id) ?? "Kontakt"}
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => void adoptItem(item)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Übernehmen
                </Button>
              </div>
            ))}
          </div>
        )}

        {currentTopics.length > 0 && linkedContactIds.length === 1 && (
          <div className="space-y-1.5">
            <p className="section-label text-muted-foreground">Aktuelle Themen merken für nächste Gespräche</p>
            {currentTopics.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{t.topic}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => void pinNewKeyTopic(t.topic, linkedContactIds[0])}
                >
                  <Pin className="h-3.5 w-3.5 mr-1" /> Merken
                </Button>
              </div>
            ))}
          </div>
        )}

        {items.length === 0 && currentTopics.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Noch keine gemerkten Punkte. Nutze den „Briefing-Gedächtnis"-Tab am Kontakt, um Standardpositionen anzulegen.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
