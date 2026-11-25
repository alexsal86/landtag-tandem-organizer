import { useMemo } from "react";
import { ArrowRight, Map as MapIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildFeatureMap } from "./map";
import type { ResolvedArea, ResolvedFeature } from "./types";

interface FeatureMapProps {
  features: ResolvedFeature[];
  areas: ResolvedArea[];
  onOpenArea: (id: string) => void;
  onOpenFeature: (id: string) => void;
}

const featureById = (features: ResolvedFeature[]) => new Map(features.map((feature) => [feature.id, feature]));

/**
 * Funktionslandkarte: Bereiche, deklarierte Abhängigkeiten und Wirkungsketten.
 *
 * Alle Angaben werden bei jedem Rendern aus dem Funktionsbestand abgeleitet. Die Karte
 * zeigt keine erfundenen Übergänge: Kanten sind ausschließlich `dependsOn`-Beziehungen
 * und stehen direkt an den Bereichskacheln, aus denen sie stammen.
 */
export function FeatureMap({ features, areas, onOpenArea, onOpenFeature }: FeatureMapProps) {
  const model = useMemo(() => buildFeatureMap(features, areas), [features, areas]);
  const byId = useMemo(() => featureById(features), [features]);
  const areaTitle = useMemo(() => new Map(areas.map((area) => [area.id, area.title])), [areas]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MapIcon aria-hidden="true" className="h-4 w-4" /> Funktionslandkarte
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Automatisch aus Bereich, Unterbereich und deklarierten Abhängigkeiten abgeleitet. Es gibt keine zweite
            Kartendatei; jede Katalogänderung verändert die Darstellung. Kanten sind Abhängigkeiten, keine
            Laufzeitaufrufe.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Kacheln zeigen ihre Kopplungen direkt: <span aria-hidden="true">→</span> hängt ab von,{" "}
            <span aria-hidden="true">←</span> wird vorausgesetzt von (Anzahl der Funktionen).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{model.nodes.length} Bereiche</Badge>
          <Badge variant="outline">{model.declaredDependencies} deklarierte Abhängigkeiten</Badge>
          <Badge variant="outline">{model.featuresWithoutDependency} ohne Abhängigkeitsbezug</Badge>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {model.nodes.map((node) => {
          const total = node.features || 1;
          const coupled = node.outgoing.length + node.incoming.length > 0;
          return (
            <div key={node.id} className="min-w-0 rounded-lg border p-3 transition-colors hover:bg-muted/60">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onOpenArea(node.id)}
                  className="min-w-0 text-left font-medium underline-offset-2 [overflow-wrap:anywhere] hover:underline"
                >
                  {node.title}
                </button>
                <Badge variant="outline">{node.features}</Badge>
              </div>
              <div className="mt-2 flex h-1.5 overflow-hidden rounded bg-muted" aria-hidden="true">
                <span className="bg-primary" style={{ width: `${(node.implemented / total) * 100}%` }} />
                <span className="bg-primary/40" style={{ width: `${(node.partial / total) * 100}%` }} />
                <span className="bg-destructive/70" style={{ width: `${(node.inactive / total) * 100}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {node.subareas.map((subarea) => (
                  <span
                    key={subarea.name}
                    className="rounded bg-muted px-1.5 py-0.5 text-[0.7rem] text-muted-foreground"
                  >
                    {subarea.name} · {subarea.features}
                  </span>
                ))}
              </div>

              <div className="mt-2 space-y-0.5 text-[0.7rem]">
                {node.outgoing.map((coupling) => (
                  <div key={`out-${coupling.area}`} className="flex items-center gap-1 text-foreground">
                    <ArrowRight aria-hidden="true" className="h-3 w-3 text-muted-foreground" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">hängt ab von {areaTitle.get(coupling.area) ?? coupling.area}</span>
                    <Badge variant="outline">{coupling.weight}</Badge>
                  </div>
                ))}
                {node.incoming.map((coupling) => (
                  <div key={`in-${coupling.area}`} className="flex items-center gap-1 text-muted-foreground">
                    <ArrowRight aria-hidden="true" className="h-3 w-3 rotate-180" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">wird vorausgesetzt von {areaTitle.get(coupling.area) ?? coupling.area}</span>
                    <Badge variant="outline">{coupling.weight}</Badge>
                  </div>
                ))}
                {!coupled ? <span className="text-muted-foreground">keine deklarierte Kopplung</span> : null}
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                implementiert {node.implemented} · teilweise {node.partial} · inaktiv {node.inactive} · ohne Test{" "}
                {node.withoutTest}
              </p>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Wirkungsketten</CardTitle>
          <CardDescription>
            Nur Ketten mit mindestens drei Funktionen. Kürzere Paare wiederholen die Kopplungen der Karte und werden
            nicht erneut aufgeführt. Die Ketten zeigen Reihenfolgen im Katalog, keine Zustandsautomaten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {model.chains.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine Kette mit mindestens drei Funktionen deklariert. Die vorhandenen Abhängigkeiten sind Paare und
              stehen direkt in den Bereichskacheln.
            </p>
          ) : (
            <ol className="space-y-3">
              {model.chains.map((chain) => (
                <li key={chain.ids.join(">")} className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {chain.ids.map((id, index) => (
                    <span key={id} className="flex items-center gap-1.5">
                      {index > 0 ? <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" /> : null}
                      <button
                        type="button"
                        onClick={() => onOpenFeature(id)}
                        className="max-w-full min-w-0 rounded border px-2 py-1 text-left text-xs transition-colors hover:bg-muted"
                      >
                        <span className="block font-medium [overflow-wrap:anywhere]">{byId.get(id)?.name ?? id}</span>
                        <span className="block font-mono text-[0.65rem] text-muted-foreground [overflow-wrap:anywhere]">{id}</span>
                      </button>
                    </span>
                  ))}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
