/**
 * Reine Regel für die Import-Spalte "Verteiler": mehrere Listennamen werden
 * durch Semikolon, Komma oder Pipe getrennt. Der Import legt fehlende Listen an
 * und ordnet den Kontakt zu; UI und Selbsttest nutzen dieselbe Zerlegung.
 */
export function parseDistributionListNames(rawValue: string | null | undefined): string[] {
  if (!rawValue) return [];
  return rawValue
    .split(/[;,|]/)
    .map((name) => name.trim())
    .filter(Boolean);
}
