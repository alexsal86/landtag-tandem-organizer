import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  documentDetailsUrl,
  parseDocumentDetails,
  signerSummary,
  textParagraphs,
  textSegments,
  type DocumentTable,
} from "./details";

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

function TableFigure({ table }: { table: DocumentTable }) {
  const [first, ...rest] = table.rows;
  // Die Kopfzeile steht im PDF über den Datenzeilen; ohne sie sind die
  // Zahlenspalten nicht zu lesen.
  const head = table.header && rest.length > 0 ? first : null;
  const body = head ? rest : table.rows;
  const columns = Math.max(1, ...table.rows.map(row => row.length));

  return <figure className="parlis-table-figure">
    <div className="parlis-table-scroll">
      <table className="parlis-table">
        {head && <thead>
          <tr>{head.map((cell, index) => <th key={index} scope="col">{cell}</th>)}</tr>
        </thead>}
        <tbody>{body.map((row, rowIndex) => <tr key={rowIndex}>
          {row.length === 1
            ? <th className="parlis-table-group" scope="colgroup" colSpan={columns}>{row[0]}</th>
            : row.map((cell, cellIndex) => cellIndex === 0
              ? <th key={cellIndex} scope="row">{cell}</th>
              : <td key={cellIndex}>{cell}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
    <figcaption>Tabelle{table.page ? ` · Seite ${table.page}` : ""}</figcaption>
  </figure>;
}

function Section({
  title, body, tables, quoteQuestions,
}: { title: string; body: string; tables: DocumentTable[]; quoteQuestions?: boolean }) {
  if (!body) return null;
  const segments = textSegments(body, tables);
  return <section className="parlis-details-section">
    <h4>{title}</h4>
    <div className="parlis-details-body">
      {segments.map((segment, index) => segment.kind === "text"
        ? <div className="parlis-details-text" key={index}>
          {textParagraphs(segment.text).map((paragraph, position) => <p
            key={position}
            className={[
              "parlis-details-paragraph",
              paragraph.question ? "parlis-details-paragraph-question" : "",
              paragraph.question && quoteQuestions ? "parlis-details-paragraph-quoted" : "",
            ].filter(Boolean).join(" ")}
          >{paragraph.text}</p>)}
        </div>
        : <TableFigure key={index} table={segment.table} />)}
    </div>
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
    <Section title="Frage" body={details.questionText} tables={details.tables} />
    <Section title="Begründung" body={details.reasoningText} tables={details.tables} />
    <Section title="Antwort" body={details.answerText} tables={details.tables} quoteQuestions />
  </div>;
}
