import { useQuery } from "@tanstack/react-query";
import { documentDetailsUrl, parseDocumentDetails, signerSummary } from "./details";

async function loadDetails(vorgangsId: string, signal: AbortSignal) {
  const response = await fetch(documentDetailsUrl(vorgangsId), { signal });
  if (!response.ok) throw new Error(`Detaildaten nicht verfügbar (${response.status})`);
  const details = parseDocumentDetails(await response.json());
  if (!details) throw new Error("Detaildaten sind unlesbar");
  return details;
}

function Section({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <section className="space-y-1">
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="whitespace-pre-line text-sm text-muted-foreground">{body}</p>
    </section>
  );
}

export default function ProceedingDetails({ vorgangsId }: { vorgangsId: string }) {
  const query = useQuery({
    queryKey: ["parlis-details", vorgangsId],
    queryFn: ({ signal }) => loadDetails(vorgangsId, signal),
    staleTime: Infinity,
    retry: false,
  });

  if (query.isPending) return <p className="text-sm" role="status">Dokumenttext wird geladen …</p>;
  if (query.isError || !query.data)
    return (
      <p className="text-sm text-muted-foreground">
        Für diesen Vorgang liegt noch kein ausgelesener Text vor.
      </p>
    );

  const details = query.data;
  const signers = signerSummary(details);
  const answer = details.answer;

  return (
    <div className="space-y-3 border-l-2 pl-4">
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Eingegangen / Ausgegeben</dt>
          <dd>{[details.eingegangen, details.ausgegeben].filter(Boolean).join(" · ") || "–"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Fragen</dt>
          <dd>{details.questionCount || "–"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Unterzeichner</dt>
          <dd>
            {signers || "Keine Angabe"}
            {details.signerResolution.includes("mehrdeutig") && (
              <span className="ml-2 text-xs text-muted-foreground">
                (Namensdoppelung – nicht automatisch zugeordnet)
              </span>
            )}
          </dd>
        </div>
        {answer.signatory && (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Antwort</dt>
            <dd>
              {[answer.signatory, answer.role].filter(Boolean).join(", ")}
              {answer.letterDate && ` · Schreiben vom ${answer.letterDate}`}
              {answer.fileReference && ` · ${answer.fileReference}`}
            </dd>
          </div>
        )}
        {answer.coMinistries.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Im Einvernehmen mit</dt>
            <dd>{answer.coMinistries.join(" · ")}</dd>
          </div>
        )}
        {answer.references.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Verweist auf</dt>
            <dd>Drucksache {answer.references.join(", ")}</dd>
          </div>
        )}
        {details.rotatedPages.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Quer gedruckte Seiten</dt>
            <dd>{details.rotatedPages.join(", ")}</dd>
          </div>
        )}
      </dl>
      <Section title="Frage" body={details.questionText} />
      <Section title="Begründung" body={details.reasoningText} />
      <Section title="Antwort" body={details.answerText} />
    </div>
  );
}
