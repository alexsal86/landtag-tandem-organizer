export type CaseScale = "small" | "large";

const LARGE_CASE_KEYWORDS = [
  "petition",
  "petitions",
  "fallakte",
  "akte",
  "verfahren",
  "investigation",
  "untersuchung",
  "komplex",
  "complex",
  "mehrstufig",
];

const SMALL_CASE_KEYWORDS = [
  "anfrage",
  "kleine_anfrage",
  "small_inquiry",
  "buergeranliegen",
  "citizen_concern",
  "hinweis",
  "kurz",
];

const normalize = (value?: string | null) => (value || "").trim().toLowerCase();

const matchesKeywords = (haystack: string, keywords: string[]) => keywords.some((keyword) => haystack.includes(keyword));

export const classifyCaseScale = (input: {
  caseType?: string | null;
  title?: string | null;
  tags?: string[] | null;
}): CaseScale => {
  const caseType = normalize(input.caseType);
  const title = normalize(input.title);
  const tagBlob = (input.tags || []).map(normalize).join(" ");
  const haystack = `${caseType} ${title} ${tagBlob}`.trim();

  if (!haystack) return "small";

  if (matchesKeywords(haystack, LARGE_CASE_KEYWORDS)) {
    return "large";
  }

  if (matchesKeywords(haystack, SMALL_CASE_KEYWORDS)) {
    return "small";
  }

  // Conservative fallback: unknown types are treated as larger dossiers
  // in Akten-Kontext to avoid underestimating coordination effort.
  return "large";
};
