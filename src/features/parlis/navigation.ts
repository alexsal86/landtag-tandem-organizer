export function parlisDeputyUrl(profileKey: string, legislature = 18, documentKind?: string) {
  const params = new URLSearchParams({ bereich: "parlis", urheber: profileKey, wahlperiode: String(legislature) });
  if (documentKind) params.set("vorgangstyp", documentKind);
  return `/daten?${params}`;
}
