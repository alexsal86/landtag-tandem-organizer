/** Neutralize spreadsheet formula triggers and quote a CSV cell. */
export function neutralizeCsvFormula(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export function csvCell(value: unknown): string {
  return `"${neutralizeCsvFormula(value).replace(/"/g, '""')}"`;
}
