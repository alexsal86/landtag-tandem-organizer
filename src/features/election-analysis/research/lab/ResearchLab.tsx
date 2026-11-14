import { lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { StatusNote } from "../../shared";
import type { Ballot } from "../../types";
import { useLabParams } from "./shared";
const Typology = lazy(() => import("./TypologyPanel"));
const Structure = lazy(() => import("./StructurePanel"));
const Flow = lazy(() => import("./FlowResearchPanel"));
const Scenario = lazy(() => import("./ScenarioPanel"));
const Seats = lazy(() => import("../simulator/SeatSimulator"));
const Saved = lazy(() => import("../SavedScenariosPanel"));
const Municipal = lazy(() => import("../MunicipalPanel"));
const labels = {
  typology: "Wahlkreisgruppen",
  structure: "Strukturmodelle",
  flows: "Wanderungsannahmen",
  scenario: "Szenariolabor",
  seats: "Sitze & Mandate 2026",
  saved: "Gespeicherte Szenarien",
  municipal: "Gemeinden & Wahlbezirke",
};
export default function ResearchLab(props: {
  year: number;
  ballot: Ballot;
  party: string;
  years: number[];
  onOpenDistrict: (n: number) => void;
}) {
  const { params, set } = useLabParams();
  const requested = params.get("researchTool") || "typology",
    tool = Object.prototype.hasOwnProperty.call(labels, requested)
      ? (requested as keyof typeof labels)
      : "typology";
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">
        Wahlforschung · exploratives Labor
      </h2>
      <StatusNote>
        Die Berechnungen sind methodisch begrenzte, explorative Werkzeuge. Sie
        ersetzen weder amtliche Quellenprüfung noch wissenschaftliche
        Validierung. Quellenlücken und vorläufige Daten bleiben sichtbar.
        Wahlkreisanteile werden aus absoluten und gültigen Stimmen berechnet.
        Modelle dürfen keine individuellen Wahlentscheidungen ableiten.
      </StatusNote>
      {props.year === 2006 && (
        <StatusNote>
          Waldshut 2006 enthält einen rekonstruierten Vergleichswert auf dem
          Zuschnitt 2011. Dies ist kein unverändert gemessener historischer
          Wahlkreiswert.
        </StatusNote>
      )}
      <nav
        aria-label="Forschungswerkzeug auswählen"
        className="flex flex-wrap gap-2"
      >
        {Object.entries(labels).map(([key, label]) => (
          <Button
            key={key}
            variant={tool === key ? "default" : "outline"}
            aria-pressed={tool === key}
            onClick={() => set("researchTool", key)}
          >
            {label}
          </Button>
        ))}
      </nav>
      <Suspense fallback={<p role="status">Forschungswerkzeug lädt …</p>}>
        {tool === "typology" ? (
          <Typology {...props} />
        ) : tool === "structure" ? (
          <Structure {...props} />
        ) : tool === "flows" ? (
          <Flow {...props} />
        ) : tool === "seats" ? (
          <Seats year={props.year} />
        ) : tool === "saved" ? (
          <Saved />
        ) : tool === "municipal" ? (
          <Municipal {...props} />
        ) : (
          <Scenario {...props} />
        )}
      </Suspense>
    </div>
  );
}
