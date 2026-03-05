export type CaseScale = "small" | "large";

const LARGE_CASE_TYPES = new Set([
  "petition",
  "petitions",
  "investigation",
  "untersuchung",
  "fallakte",
  "verfahren",
]);

const SMALL_CASE_TYPES = new Set([
  "small_inquiry",
  "kleine_anfrage",
  "citizen_concern",
  "buergeranliegen",
  "anfrage",
  "hinweis",
]);

const normalize = (value?: string | null) => (value || "").trim().toLowerCase();

export const classifyCaseScale = (input: {
  explicitScale?: string | null;
  caseType?: string | null;
}): CaseScale => {
  // Explicit scale always wins; case type classification is fallback for legacy records.
  const explicitScale = normalize(input.explicitScale);
  if (explicitScale === "small" || explicitScale === "large") {
    return explicitScale;
  }

  const caseType = normalize(input.caseType);

  if (SMALL_CASE_TYPES.has(caseType)) return "small";
  if (LARGE_CASE_TYPES.has(caseType)) return "large";

  // Default to small to avoid flooding the "large" bucket with unknown values.
  return "small";
};
