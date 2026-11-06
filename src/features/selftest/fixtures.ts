/** Gültige, pro Lauf getrennte Tage. Kollisionen scheitern am UNIQUE-Constraint;
 * bestehende Tageszettel werden niemals vorab gelöscht oder überschrieben. */
export function testDay(runId: string, offset = 0): string {
  const hash = Number.parseInt(runId.replace(/-/g, "").slice(0, 12), 16);
  if (!Number.isFinite(hash)) throw new Error("Ungültige Selbsttest-Laufnummer.");
  const date = new Date(Date.UTC(3000, 0, 1));
  date.setUTCDate(date.getUTCDate() + hash % (6000 * 365) + offset);
  return date.toISOString().slice(0, 10);
}
