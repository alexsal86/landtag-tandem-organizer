import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, MessageSquare, AlertTriangle, Target, Lightbulb, User } from "lucide-react";
import { useContactBriefingMemory, type MemoryKind, type ContactBriefingMemoryItem } from "@/hooks/useContactBriefingMemory";

interface Props {
  contactId: string;
}

const KIND_META: Record<MemoryKind, { label: string; icon: typeof User; description: string }> = {
  position: { label: "Dauerhafte Positionen", icon: Target, description: "Was vertritt diese Person/Organisation grundsätzlich?" },
  talking_point: { label: "Standard-Talking-Points", icon: Lightbulb, description: "Punkte, die wir in Gesprächen mit dieser Seite immer wieder machen." },
  qa: { label: "Häufige Fragen & Antworten", icon: MessageSquare, description: "Wiederkehrende Fragen aus dieser Richtung samt vorbereiteter Antwort." },
  sensitive: { label: "Sensible Punkte / Red Flags", icon: AlertTriangle, description: "Themen, an denen wir vorsichtig sein müssen." },
  role_note: { label: "Rollennotizen", icon: User, description: "Funktion, Hierarchie, persönliche Eigenheiten." },
};

const KIND_ORDER: MemoryKind[] = ["role_note", "position", "talking_point", "qa", "sensitive"];

export function ContactBriefingMemoryTab({ contactId }: Props) {
  const { items, loading, add, remove } = useContactBriefingMemory(contactId);
  const [drafts, setDrafts] = useState<Record<MemoryKind, { content?: string; question?: string; answer?: string }>>({
    position: {}, talking_point: {}, qa: {}, sensitive: {}, role_note: {},
  });

  const grouped = KIND_ORDER.reduce<Record<MemoryKind, ContactBriefingMemoryItem[]>>((acc, k) => {
    acc[k] = items.filter((i) => i.kind === k);
    return acc;
  }, { position: [], talking_point: [], qa: [], sensitive: [], role_note: [] });

  const handleAdd = async (kind: MemoryKind) => {
    const draft = drafts[kind];
    if (kind === "qa") {
      if (!draft.question?.trim()) return;
      await add({ contact_id: contactId, kind, question: draft.question, answer: draft.answer });
    } else {
      if (!draft.content?.trim()) return;
      await add({ contact_id: contactId, kind, content: draft.content });
    }
    setDrafts((p) => ({ ...p, [kind]: {} }));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Briefing-Gedächtnis: Punkte, die für jedes Gespräch mit diesem Kontakt wichtig bleiben. Werden bei neuen Terminvorbereitungen automatisch als Vorschläge angeboten.
      </p>

      {loading && <p className="text-sm text-muted-foreground">Wird geladen…</p>}

      {KIND_ORDER.map((kind) => {
        const Icon = KIND_META[kind].icon;
        const list = grouped[kind];
        const draft = drafts[kind];
        return (
          <Card key={kind} className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="h-4 w-4 text-primary" />
                {KIND_META[kind].label}
                {list.length > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">({list.length})</span>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{KIND_META[kind].description}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {list.map((item) => (
                <div key={item.id} className="flex items-start gap-2 rounded-md border bg-muted/20 p-2">
                  <div className="flex-1 text-sm">
                    {kind === "qa" ? (
                      <>
                        <div className="font-medium">F: {item.question}</div>
                        {item.answer && <div className="text-muted-foreground mt-0.5">A: {item.answer}</div>}
                      </>
                    ) : (
                      <span>{item.content}</span>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => void remove(item.id)} title="Entfernen">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}

              {kind === "qa" ? (
                <div className="space-y-2 rounded-md border border-dashed p-2">
                  <Input
                    value={draft.question ?? ""}
                    onChange={(e) => setDrafts((p) => ({ ...p, qa: { ...p.qa, question: e.target.value } }))}
                    placeholder="Frage…"
                  />
                  <Textarea
                    value={draft.answer ?? ""}
                    onChange={(e) => setDrafts((p) => ({ ...p, qa: { ...p.qa, answer: e.target.value } }))}
                    placeholder="Vorbereitete Antwort (optional)…"
                    rows={2}
                  />
                  <Button size="sm" variant="outline" onClick={() => void handleAdd(kind)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Hinzufügen
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-dashed p-2">
                  <Input
                    value={draft.content ?? ""}
                    onChange={(e) => setDrafts((p) => ({ ...p, [kind]: { content: e.target.value } }))}
                    placeholder="Neuen Eintrag hinzufügen…"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAdd(kind); } }}
                  />
                  <Button size="sm" variant="outline" onClick={() => void handleAdd(kind)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Hinzufügen
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
