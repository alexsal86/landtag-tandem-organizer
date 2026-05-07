import { useMemo, useState } from "react";
import { Hash, PlusIcon, TrashIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import { splitPreparationTextToList } from "@/hooks/useAppointmentPreparation";

type StructuredFact = NonNullable<AppointmentPreparation['preparation_data']['structured_facts']>[number];
type LinkType = StructuredFact['link_type'];

interface Props {
  preparation: AppointmentPreparation;
  onUpdate: (updates: Partial<AppointmentPreparation>) => Promise<void>;
}

type FilterValue = 'all' | 'general' | 'partner' | 'topic';

export function StructuredFactsPanel({ preparation, onUpdate }: Props) {
  const data = preparation.preparation_data;
  const facts: StructuredFact[] = data.structured_facts ?? [];
  const partners = data.conversation_partners ?? [];
  const topics = data.key_topic_items ?? [];
  const legacyFacts = data.facts_figures?.trim() ?? "";

  const [filter, setFilter] = useState<FilterValue>('all');

  const save = async (next: StructuredFact[]) => {
    await onUpdate({
      preparation_data: { ...data, structured_facts: next },
    });
  };

  const addFact = async () => {
    const next: StructuredFact[] = [
      ...facts,
      { id: crypto.randomUUID(), text: '', link_type: 'general' },
    ];
    await save(next);
  };

  const updateFact = async (id: string, patch: Partial<StructuredFact>) => {
    const next = facts.map((f) => (f.id === id ? { ...f, ...patch } : f));
    await save(next);
  };

  const removeFact = async (id: string) => {
    await save(facts.filter((f) => f.id !== id));
  };

  const importLegacy = async () => {
    const lines = splitPreparationTextToList(legacyFacts);
    if (!lines.length) return;
    const imported: StructuredFact[] = lines.map((text) => ({
      id: crypto.randomUUID(),
      text,
      link_type: 'general',
    }));
    await onUpdate({
      preparation_data: {
        ...data,
        structured_facts: [...facts, ...imported],
        facts_figures: '',
      },
    });
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return facts;
    return facts.filter((f) => f.link_type === filter);
  }, [facts, filter]);

  const grouped = useMemo(() => {
    const groups: Array<{ label: string; items: StructuredFact[] }> = [];
    const general = filtered.filter((f) => f.link_type === 'general');
    if (general.length) groups.push({ label: 'Allgemein', items: general });

    partners.forEach((p) => {
      const items = filtered.filter((f) => f.link_type === 'partner' && f.link_id === p.id);
      if (items.length) groups.push({ label: p.name || 'Gesprächspartner', items });
    });
    topics.forEach((t) => {
      const items = filtered.filter((f) => f.link_type === 'topic' && f.link_id === t.id);
      if (items.length) groups.push({ label: t.topic || 'Thema', items });
    });
    // orphaned (linked id no longer exists)
    const orphaned = filtered.filter((f) => {
      if (f.link_type === 'partner') return !partners.some((p) => p.id === f.link_id);
      if (f.link_type === 'topic') return !topics.some((t) => t.id === f.link_id);
      return false;
    });
    if (orphaned.length) groups.push({ label: 'Ohne Zuordnung', items: orphaned });
    return groups;
  }, [filtered, partners, topics]);

  const filters: Array<{ value: FilterValue; label: string; count: number }> = [
    { value: 'all', label: 'Alle', count: facts.length },
    { value: 'general', label: 'Allgemein', count: facts.filter((f) => f.link_type === 'general').length },
    { value: 'partner', label: 'Partner', count: facts.filter((f) => f.link_type === 'partner').length },
    { value: 'topic', label: 'Themen', count: facts.filter((f) => f.link_type === 'topic').length },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Hash className="h-4 w-4" />
          Fakten
          <span className="text-xs text-muted-foreground font-normal">
            ({facts.length})
          </span>
        </CardTitle>
        <div className="flex flex-wrap gap-1.5 pt-2">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                filter === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {f.label} · {f.count}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {legacyFacts && (
          <div className="rounded-md border border-dashed bg-muted/30 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground flex-1">
                Alte Fakten als Freitext gefunden. Als strukturierte Liste übernehmen?
                <div className="mt-1 line-clamp-2 italic">{legacyFacts}</div>
              </div>
              <Button size="sm" variant="outline" onClick={importLegacy}>
                Übernehmen
              </Button>
            </div>
          </div>
        )}

        {facts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">Noch keine Fakten erfasst.</p>
            <p className="text-xs">Kompakte Datenpunkte, optional Quelle, Partner oder Thema.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map((group) => (
              <div key={group.label} className="space-y-0">
                <div className="section-label text-muted-foreground mb-1.5">{group.label}</div>
                <div className="rounded-md border bg-card divide-y">
                  {group.items.map((fact) => (
                    <FactRow
                      key={fact.id}
                      fact={fact}
                      partners={partners}
                      topics={topics}
                      onChange={(patch) => updateFact(fact.id, patch)}
                      onRemove={() => removeFact(fact.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <Button variant="outline" size="sm" onClick={addFact}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Fakt hinzufügen
        </Button>
      </CardContent>
    </Card>
  );
}

interface FactRowProps {
  fact: StructuredFact;
  partners: NonNullable<AppointmentPreparation['preparation_data']['conversation_partners']>;
  topics: NonNullable<AppointmentPreparation['preparation_data']['key_topic_items']>;
  onChange: (patch: Partial<StructuredFact>) => void;
  onRemove: () => void;
}

function FactRow({ fact, partners, topics, onChange, onRemove }: FactRowProps) {
  const linkValue = fact.link_type === 'general' ? 'general' : `${fact.link_type}:${fact.link_id ?? ''}`;

  const onLinkChange = (value: string) => {
    if (value === 'general') {
      onChange({ link_type: 'general', link_id: undefined });
      return;
    }
    const [type, id] = value.split(':') as [LinkType, string];
    onChange({ link_type: type, link_id: id });
  };

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-start gap-2">
        <Input
          value={fact.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="z. B. Investitionsstau: 2,3 Mrd. EUR · KHG-Quote BW 7,1 %"
          className="flex-1 border-0 px-0 shadow-none focus-visible:ring-0 text-sm"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label="Fakt löschen"
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={fact.source ?? ''}
          onChange={(e) => onChange({ source: e.target.value })}
          placeholder="Quelle (optional)"
          className="h-7 w-44 text-xs"
        />
        <Select value={linkValue} onValueChange={onLinkChange}>
          <SelectTrigger className="h-7 w-auto min-w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general">Allgemein</SelectItem>
            {partners.length > 0 && (
              <>
                <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Gesprächspartner
                </div>
                {partners.map((p) => (
                  <SelectItem key={p.id} value={`partner:${p.id}`}>
                    {p.name || 'Unbenannter Partner'}
                  </SelectItem>
                ))}
              </>
            )}
            {topics.length > 0 && (
              <>
                <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Themen
                </div>
                {topics.map((t) => (
                  <SelectItem key={t.id} value={`topic:${t.id}`}>
                    {t.topic || 'Unbenanntes Thema'}
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
        {fact.link_type !== 'general' && (
          <Badge variant="secondary" className="text-[10px]">
            {fact.link_type === 'partner' ? 'Partner' : 'Thema'}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function getFactsForLink(
  preparation: AppointmentPreparation,
  linkType: 'partner' | 'topic',
  linkId: string,
): StructuredFact[] {
  return (preparation.preparation_data.structured_facts ?? []).filter(
    (f) => f.link_type === linkType && f.link_id === linkId,
  );
}
