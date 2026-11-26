function authorKey(name: string) {
  const ordered = name.includes(",")
    ? name.split(",").slice(0, 2).reverse().join(" ")
    : name;
  const key = ordered.replace(/\b(?:dr|prof)\.\s*/gi, "")
    .trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
  switch (key) {
    case "uwe freiherr von wangenheim": return "uwe von wangenheim";
    case "med. michael preusch": return "michael preusch";
    case "n hans-peter hörner": return "hans-peter hörner";
    default: return key;
  }
}

export function authorSegments(text: string, deputies?: ReadonlyMap<string, string>) {
  const segments: { text: string; profileKey?: string; party?: string }[] = [];
  let end = 0;
  const authors = /(^|,)(\s*)([^,()]+?)(\s+\()(\s*)([^()]+?)(\s*\))(?=\s*(?:,|u\. a\.|$))/g;
  for (const match of text.matchAll(authors)) {
    const [whole, separator, leading, name, opening, partySpace, party, closing] = match;
    const start = match.index + separator.length + leading.length;
    const candidates = deputies ? [...deputies].filter(([, deputyName]) => authorKey(deputyName) === authorKey(name)) : [];
    segments.push(
      { text: text.slice(end, start) },
      { text: name, profileKey: candidates.length === 1 ? candidates[0][0] : undefined },
      { text: opening + partySpace },
      { text: party, party },
      { text: closing },
    );
    end = match.index + whole.length;
  }
  segments.push({ text: text.slice(end) });
  return segments;
}
