export function isValidFunFacts(facts: readonly string[], lieIndex: number): boolean {
  const trimmed = facts.map(fact => fact.trim());
  return trimmed.length === 3 && trimmed.every(fact => Array.from(fact).length > 0 && Array.from(fact).length <= 160)
    && new Set(trimmed.map(fact => fact.toLowerCase())).size === 3
    && Number.isInteger(lieIndex) && lieIndex >= 0 && lieIndex < 3;
}
