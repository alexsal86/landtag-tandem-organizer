import Papa from "papaparse";
export interface StructureRow {
  number: number;
  values: Record<string, number | null>;
}
export function parseStructureCsv(text: string, year: number) {
  if (text.length > 2_000_000)
    throw new Error("CSV auf höchstens 2 MB begrenzen.");
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transform: (v) => v.trim(),
    transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
  });
  if (
    parsed.meta.renamedHeaders &&
    Object.keys(parsed.meta.renamedHeaders).length
  )
    throw new Error("Doppelte Spaltennamen sind nicht erlaubt.");
  if (parsed.errors.length)
    throw new Error(`CSV-Format: ${parsed.errors[0].message}`);
  const headers = parsed.meta.fields || [],
    fields = headers.filter(
      (h) => !["district_number", "district_name", "year"].includes(h),
    );
  if (
    !headers.includes("district_number") ||
    !headers.includes("year") ||
    fields.length < 1 ||
    fields.length > 6 ||
    fields.some(
      (h) =>
        !h ||
        h.length > 80 ||
        ["__proto__", "prototype", "constructor"].includes(h),
    )
  )
    throw new Error(
      "Benötigt: district_number, year und ein bis sechs numerische Merkmale.",
    );
  if (parsed.data.length > 70 || !parsed.data.length)
    throw new Error("Ein bis 70 Wahlkreiszeilen erforderlich.");
  const seen = new Set<number>();
  const rows: StructureRow[] = parsed.data.map((r) => {
    if (!/^\d+$/.test(r.district_number || "") || !/^\d{4}$/.test(r.year || ""))
      throw new Error("Wahlkreisnummer und Jahr müssen ganze Zahlen sein.");
    const n = Number(r.district_number);
    if (n < 1 || n > 70 || seen.has(n) || Number(r.year) !== year)
      throw new Error(
        "Wahlkreis doppelt/ungültig oder Bezugsjahr passt nicht zur gewählten Wahl.",
      );
    seen.add(n);
    const values = Object.fromEntries(
      fields.map((field) => {
        const value = (r[field] || "").trim();
        if (!value) return [field, null];
        if (!/^-?\d+(?:[.,]\d+)?$/.test(value))
          throw new Error(
            `Merkmal ${field}: reine Zahl ohne Tausendertrennzeichen erforderlich.`,
          );
        const number = Number(value.replace(",", "."));
        if (!Number.isFinite(number)) throw new Error("Ungültiger Zahlenwert.");
        return [field, number];
      }),
    );
    return { number: n, values };
  });
  return { rows, fields };
}
