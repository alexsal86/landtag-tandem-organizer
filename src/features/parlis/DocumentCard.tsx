import { Fragment, type ReactNode } from "react";
import { ExternalLink, FileText, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { deputyProfileUrl } from "@/features/election-analysis/navigation";
import { getPartyColor } from "@/features/election-districts/partyColors";
import { authorSegments } from "./authors";
import { documentCount, keywords, type Proceeding } from "./documents";

const dayFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeZone: "UTC" });

function PartyLabel({ party }: { party: string }) {
  const color = getPartyColor(party);
  return <span className="parlis-party">
    {color !== getPartyColor() && <span aria-hidden="true" style={{ backgroundColor: color }} />}
    {party}
  </span>;
}

function KeywordChips({ value }: { value: string }) {
  const topics = keywords(value);
  return topics.length > 0 && <ul className="parlis-keywords" aria-label="Schlagwörter">
    {topics.map(topic => <li key={topic}>{topic}</li>)}
  </ul>;
}

export function DocumentCard({ row, deputies }: { row: Proceeding; deputies?: ReadonlyMap<string, string> }) {
  const url = [row.pdf_url, row.dokument_url].find(value => /^https:\/\/www\.landtag-bw\.de\//i.test(value));
  return <article className="parlis-card">
    <div className="parlis-meta">
      {row.vorgangstyp && <span className="parlis-kind">{row.vorgangstyp}</span>}
      {row.drucksache && <span>{row.drucksache}</span>}
    </div>
    <h4>{row.titel || row.vorgangs_id}</h4>
    {row.urheber && <div className="parlis-authors">
      <UserRound size={16} aria-hidden="true" />
      <p>{authorSegments(row.urheber, deputies).map((segment, index) => {
        if (segment.profileKey) return <Link key={index} to={deputyProfileUrl(segment.profileKey)}>{segment.text}</Link>;
        if (segment.party) return <PartyLabel key={index} party={segment.party} />;
        return <Fragment key={index}>{segment.text}</Fragment>;
      })}</p>
    </div>}
    {row.ressort && <p className="parlis-department">{row.ressort}</p>}
    <KeywordChips value={row.deskriptoren} />
    {url && <footer>
      <a className="parlis-original" href={url} target="_blank" rel="noreferrer">
        <FileText size={16} aria-hidden="true" />
        Originaldokument öffnen
        <ExternalLink size={13} aria-hidden="true" />
        <span className="sr-only"> (öffnet in neuem Tab)</span>
      </a>
    </footer>}
  </article>;
}

export function DocumentDateGroup({ date, count, children }: { date: string; count: number; children: ReactNode }) {
  return <section className="parlis-day" aria-labelledby={`parlis-day-${date}`}>
    <header>
      <h3 id={`parlis-day-${date}`}><time dateTime={date}>{dayFormat.format(new Date(date))}</time></h3>
      <span>{documentCount(count)}</span>
    </header>
    <ul>{children}</ul>
  </section>;
}
