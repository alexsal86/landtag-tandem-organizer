import { getPartyColor } from "@/features/election-districts/partyColors";

function authorKey(name: string) {
  const ordered = name.includes(",")
    ? name.split(",").slice(0, 2).reverse().join(" ")
    : name;
  const key = ordered.replace(/\b(?:dr|prof)\.\s*/gi, "")
    .trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
  switch (key) {
    case "gabriele rolland": return "gabi rolland";
    case "josef frey": return "josha frey";
    case "nikolai reith": return "niko reith";
    case "alena fink-trauschel": return "alena trauschel";
    case "klaus martin burger": return "klaus burger";
    case "christine neumann-martin": return "christine neumann";
    case "michael joukov-schwelling": return "michael joukov";
    case "hans-ulrich sckerl": return "uli sckerl";
    case "n stefan fulst-blei": return "stefan fulst-blei";
    case "uwe freiherr von wangenheim": return "uwe von wangenheim";
    case "med. michael preusch": return "michael preusch";
    case "n hans-peter hörner": return "hans-peter hörner";
    default: return key;
  }
}

type AuthorSegment = { text: string; profileKey?: string; party?: string; person?: boolean };

function factionSegments(text: string): AuthorSegment[] {
  const result: AuthorSegment[] = [];
  let end = 0;
  for (const match of text.matchAll(/\bFraktion\s+(?:(?:der|des)\s+)?([^,()]+)(?=,|$)/g)) {
    const party = match[1].trimEnd();
    const start = match.index + match[0].length - match[1].length;
    result.push({ text: text.slice(end, start) }, { text: party, party });
    end = start + party.length;
  }
  result.push({ text: text.slice(end) });
  return result;
}

export function authorSegments(text: string, deputies?: ReadonlyMap<string, string>, omitPartyParentheses = false) {
  const segments: AuthorSegment[] = [];
  let end = 0;
  const authors = /(^|,)(\s*)([^,()]+?)(\s+\()(\s*)([^()]+?)(\s*\))(?=\s*(?:,|u\.\s*a\.|$))/g;
  for (const match of text.matchAll(authors)) {
    const [whole, separator, leading, name, opening, partySpace, party, closing] = match;
    const start = match.index + separator.length + leading.length;
    const candidates = deputies ? [...deputies].filter(([, deputyName]) => authorKey(deputyName) === authorKey(name)) : [];
    const isParty = getPartyColor(party) !== getPartyColor();
    const omitParentheses = omitPartyParentheses && isParty;
    segments.push(
      ...factionSegments(text.slice(end, start)),
      { text: name, person: isParty, profileKey: candidates.length === 1 ? candidates[0][0] : undefined },
      { text: omitParentheses ? " " : opening + partySpace },
      { text: party, party },
      { text: omitParentheses ? "" : closing },
    );
    end = match.index + whole.length;
  }
  segments.push(...factionSegments(text.slice(end)));
  return segments;
}

export function hasMultipleAuthors(text: string, segments: AuthorSegment[]) {
  return /\bu\.\s*a\./i.test(text) || segments.filter(segment => segment.person).length > 1;
}
