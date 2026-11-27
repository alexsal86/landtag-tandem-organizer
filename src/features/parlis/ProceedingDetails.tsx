import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { documentDetailsUrl, parseDocumentDetails, signerSummary } from "./details";

async function loadDetails(vorgangsId: string, signal: AbortSignal) {
  const response = await fetch(documentDetailsUrl(vorgangsId), { signal });
  if (!response.ok) throw new Error(`Detaildaten nicht verfügbar (${response.status})`);
  const details = parseDocumentDetails(await response.json());
  if (!details) throw new Error("Detaildaten sind unlesbar");
  return details;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <>
    <dt>{label}</dt>
    <dd>{children}</dd>
  </>;
}

function Section({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return <section className="parlis-details-section">
    <h4>{title}</h4>
    <p>{body}</p>
  </section>;
}

export default function ProceedingDetails({ vorgangsId }: { vorgangsId: string }) {
  const query = useQuery({
    queryKey: ["parlis-details", vorgangsId],
    queryFn: ({ signal }) => loadDetails(vorgangsId, signal),
    staleTime: Infinity,
    retry: false,
  });

  if (query.isPending) return <p className="parlis-details-state" role="status">Dokumenttext wird geladen …</p>;
  if (query.isError || !query.data)
    return <p className="parlis-details-state">Für diesen Vorgang liegt noch kein ausgelesener Text vor.</p>;

  const details = query.data;
  const signers = signerSummary(details);
  const answer = details.answer;

  return <div className="parlis-details">
    <dl className="parlis-details-grid">
      <Row label="Eingegangen / Ausgegeben">
        {[details.eingegangen, details.ausgegeben].filter(Boolean).join(" · ") || "–"}
      </Row>
      <Row label="Fragen">{details.questionCount || "–"}</Row>
      <Row label="Unterzeichner">
        {signers || "Keine Angabe"}
        {details.signerResolution.includes("mehrdeutig") && <span className="parlis-details-note">
          Namensdoppelung – nicht automatisch zugeordnet
        </span>}
      </Row>
      {answer.signatory && <Row label="Antwort">
        {[answer.signatory, answer.role].filter(Boolean).join(", ")}
        {answer.letterDate && ` · Schreiben vom ${answer.letterDate}`}
        {answer.fileReference && ` · ${answer.fileReference}`}
      </Row>}
      {answer.coMinistries.length > 0 && <Row label="Im Einvernehmen mit">{answer.coMinistries.join(" · ")}</Row>}
      {answer.references.length > 0 && <Row label="Verweist auf">Drucksache {answer.references.join(", ")}</Row>}
      {details.rotatedPages.length > 0 && <Row label="Quer gedruckte Seiten">
        {details.rotatedPages.join(", ")}
      </Row>}
    </dl>
    <Section title="Frage" body={details.questionText} />
    <Section title="Begründung" body={details.reasoningText} />
    <Section title="Antwort" body={details.answerText} />
  </div>;
}
