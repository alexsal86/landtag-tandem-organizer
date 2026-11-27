import { Fragment, useId, useState } from "react";
import { ChevronDown, ExternalLink, FileText, UserRound, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { deputyProfileUrl } from "@/features/election-analysis/navigation";
import { getPartyColor } from "@/features/election-districts/partyColors";
import { authorSegments, hasMultipleAuthors } from "./authors";
import { keywords, parlisDateFormat, type Proceeding } from "./documents";
import ProceedingDetails from "./ProceedingDetails";

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

export function DocumentCard({ row }: { row: Proceeding }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const authors = authorSegments(row.urheber, new Map(row.deputies), true);
  const AuthorIcon = hasMultipleAuthors(row.urheber, authors) ? UsersRound : UserRound;
  return <article className="parlis-card">
    <div className="parlis-meta">
      {row.vorgangstyp && <span className="parlis-kind">{row.vorgangstyp}</span>}
      {row.datum && <time className="parlis-date" dateTime={row.datum}>{parlisDateFormat.format(new Date(row.datum))}</time>}
      {row.drucksache && <span>{row.drucksache}</span>}
    </div>
    <h3>{row.titel || row.vorgangs_id}</h3>
    {row.urheber && <div className="parlis-authors">
      <AuthorIcon size={16} aria-hidden="true" />
      <p>{authors.map((segment, index) => {
        if (segment.profileKey) return <Link key={index} to={deputyProfileUrl(segment.profileKey)}>{segment.text}</Link>;
        if (segment.party) return <PartyLabel key={index} party={segment.party} />;
        return <Fragment key={index}>{segment.text}</Fragment>;
      })}</p>
    </div>}
    {row.ressort && <p className="parlis-department">{row.ressort}</p>}
    <KeywordChips value={row.deskriptoren} />
    <footer className="parlis-card-footer">
      {row.url && <a className="parlis-original" href={row.url} target="_blank" rel="noreferrer">
        <FileText size={16} aria-hidden="true" />
        Originaldokument öffnen
        <ExternalLink size={13} aria-hidden="true" />
        <span className="sr-only"> (öffnet in neuem Tab)</span>
      </a>}
      <button type="button" className="parlis-details-toggle" aria-expanded={open} aria-controls={detailsId}
        onClick={() => setOpen(value => !value)}>
        {open ? "Text ausblenden" : "Text und Unterzeichner"}
        <ChevronDown size={14} aria-hidden="true" className={open ? "is-open" : undefined} />
      </button>
    </footer>
    {open && <div id={detailsId}><ProceedingDetails vorgangsId={row.vorgangs_id} /></div>}
  </article>;
}
