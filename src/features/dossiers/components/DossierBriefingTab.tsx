import type { Dossier, DossierEntry, EntryType } from "../types";
import { ENTRY_TYPE_CONFIG, PARLIAMENTARY_ENTRY_TYPES } from "../types";
import { useDossierLinks } from "../hooks/useDossierLinks";
import { Button } from "@/components/ui/button";
import { Copy, Printer } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useUpdateDossier } from "../hooks/useDossiers";
import { supabase } from "@/integrations/supabase/client";

interface DossierBriefingTabProps {
  dossier: Dossier;
  entries?: DossierEntry[];
}

export function DossierBriefingTab({ dossier, entries }: DossierBriefingTabProps) {
  const { data: links } = useDossierLinks(dossier.id);
  const updateDossier = useUpdateDossier();
  const contactLinks = links?.filter((l) => l.linked_type === "contact") ?? [];

  // Resolve contact names
  const { data: contactNames } = useQuery({
    queryKey: ["briefing-contacts", contactLinks.map((l) => l.linked_id).join(",")],
    enabled: contactLinks.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const ids = contactLinks.map((l) => l.linked_id);
      const { data } = await supabase
        .from("contacts")
        .select("id, name, organization")
        .in("id", ids);
      return data ?? [];
    },
  });

  const latest5 = entries?.slice(0, 5) ?? [];
  const newSinceLastBriefing = entries?.filter((entry) => !dossier.last_briefing_at || new Date(entry.created_at) > new Date(dossier.last_briefing_at)) ?? [];
  const parliamentaryEntries = (entries ?? [])
    .filter((e) => PARLIAMENTARY_ENTRY_TYPES.includes(e.entry_type as EntryType))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  const buildTextBriefing = () => {
    const lines: string[] = [];
    lines.push(`DOSSIER-BRIEFING: ${dossier.title}`);
    lines.push(`Stand: ${format(new Date(), "dd.MM.yyyy", { locale: de })}`);
    lines.push("═".repeat(50));
    lines.push("");

    if (dossier.summary) {
      lines.push("KURZLAGE");
      lines.push(dossier.summary);
      lines.push("");
    }

    if (dossier.open_questions?.trim()) {
      lines.push("OFFENE FRAGEN");
      lines.push(dossier.open_questions);
      lines.push("");
    }

    if (dossier.positions?.trim()) {
      lines.push("POSITIONEN");
      lines.push(dossier.positions);
      lines.push("");
    }

    if (dossier.risks_opportunities?.trim()) {
      lines.push("RISIKEN & CHANCEN");
      lines.push(dossier.risks_opportunities);
      lines.push("");
    }

    if (parliamentaryEntries.length > 0) {
      lines.push("PARLAMENTARISCHER STAND");
      for (const entry of parliamentaryEntries) {
        const date = format(new Date(entry.created_at), "dd.MM.yyyy", { locale: de });
        const config = ENTRY_TYPE_CONFIG[entry.entry_type as EntryType] ?? { icon: "·", label: entry.entry_type };
        lines.push(`  ${config.icon} [${date}] ${config.label}: ${entry.title || "Ohne Titel"}`);
        if (entry.content) lines.push(`    ${entry.content.slice(0, 120)}${entry.content.length > 120 ? "…" : ""}`);
      }
      lines.push("");
    }

    if (latest5.length > 0) {
      lines.push("LETZTE EINTRÄGE");
      for (const entry of latest5) {
        const date = format(new Date(entry.created_at), "dd.MM.yyyy", { locale: de });
        const config = ENTRY_TYPE_CONFIG[entry.entry_type as EntryType] ?? { icon: "·", label: entry.entry_type };
        lines.push(`  ${config.icon} [${date}] ${entry.title || "Ohne Titel"}`);
        if (entry.content) lines.push(`    ${entry.content.slice(0, 120)}${entry.content.length > 120 ? "…" : ""}`);
      }
      lines.push("");
    }

    if (contactNames && contactNames.length > 0) {
      lines.push("VERKNÜPFTE KONTAKTE");
      for (const c of contactNames) {
        lines.push(`  • ${c.name}${c.organization ? ` (${c.organization})` : ""}`);
      }
    }

    return lines.join("\n");
  };

  const handleCopy = async () => {
    const text = buildTextBriefing();
    await navigator.clipboard.writeText(text);
    toast.success("Briefing in Zwischenablage kopiert");
  };

  const handlePrint = () => {
    const text = buildTextBriefing();
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`<html><head><title>Briefing: ${dossier.title}</title>
        <style>body{font-family:system-ui,sans-serif;padding:40px;line-height:1.6;max-width:700px;white-space:pre-wrap;font-size:13px}
        </style></head><body>${text}</body></html>`);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-5">
      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          <Copy className="h-3.5 w-3.5" /> In Zwischenablage
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-3.5 w-3.5" /> Drucken
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => updateDossier.mutate({ id: dossier.id, last_briefing_at: new Date().toISOString() })}
          disabled={updateDossier.isPending}
        >
          Als gelesen markieren
        </Button>
      </div>

      {/* Rendered Briefing */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4 print:border-0 print:p-0">
        <div>
          <h2 className="text-lg font-bold">{dossier.title}</h2>
          <p className="text-xs text-muted-foreground">
            Stand: {format(new Date(), "dd. MMMM yyyy", { locale: de })}
          </p>
        </div>

        {dossier.summary && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Kurzlage</h3>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{dossier.summary}</p>
          </section>
        )}

        {dossier.open_questions?.trim() && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Offene Fragen</h3>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{dossier.open_questions}</p>
          </section>
        )}

        {dossier.positions?.trim() && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Positionen</h3>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{dossier.positions}</p>
          </section>
        )}

        {dossier.risks_opportunities?.trim() && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Risiken &amp; Chancen</h3>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{dossier.risks_opportunities}</p>
          </section>
        )}

        {newSinceLastBriefing.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Neu seit letztem Briefing</h3>
            <p className="text-sm"><span className="font-medium">{newSinceLastBriefing.length}</span> neue Einträge seit {dossier.last_briefing_at ? format(new Date(dossier.last_briefing_at), "dd.MM.yyyy", { locale: de }) : "Beginn"}.</p>
          </section>
        )}

        {latest5.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Letzte Einträge</h3>
            <div className="space-y-1.5">
              {latest5.map((entry) => {
                const config = ENTRY_TYPE_CONFIG[entry.entry_type as EntryType] ?? { icon: "📄", label: entry.entry_type };
                return (
                  <div key={entry.id} className="text-sm flex items-start gap-2">
                    <span className="shrink-0 text-xs mt-0.5">{config.icon}</span>
                    <div className="min-w-0">
                      <span className="font-medium">{entry.title || "Ohne Titel"}</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        {format(new Date(entry.created_at), "dd.MM.yyyy", { locale: de })}
                      </span>
                      {entry.content && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{entry.content}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {contactNames && contactNames.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Verknüpfte Kontakte</h3>
            <div className="space-y-1">
              {contactNames.map((c) => (
                <p key={c.id} className="text-sm">
                  <span className="font-medium">{c.name}</span>
                  {c.organization && <span className="text-muted-foreground ml-1">({c.organization})</span>}
                </p>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
