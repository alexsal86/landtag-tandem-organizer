import { Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { ProtocolDecision } from "./types";
export function ProtocolDecisions({
  decisions,
}: {
  decisions: ProtocolDecision[];
}) {
  return (
    <>
      {decisions.length > 0 && (
        <section
          id="protocol-decisions"
          className="scroll-mt-6 space-y-3 mt-8 border-t pt-6 print:break-inside-auto"
        >
          <h2 className="text-lg font-semibold flex items-center gap-2 print:break-after-avoid">
            <Scale className="h-5 w-5 text-palette-violet" />
            Entscheidungen
          </h2>
          <div className="space-y-3">
            {decisions.map((d) => (
              <div
                key={d.id}
                className="py-3 border-b border-border/60 last:border-0 break-inside-avoid"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-medium">{d.title}</p>
                    {d.response_deadline && (
                      <p className="text-xs text-muted-foreground">
                        Frist:{" "}
                        {format(new Date(d.response_deadline), "dd.MM.yyyy", {
                          locale: de,
                        })}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {d.status === "decided" ? "Entschieden" : "Offen"}
                  </Badge>
                </div>
                {d.result_text?.trim() && (
                  <div className="mt-2 border-l-2 border-palette-violet/50 pl-3 break-inside-avoid">
                    <p className="text-sm font-medium text-palette-violet mb-1">
                      Ergebnis:
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {d.result_text}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
