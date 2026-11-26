export function parlisDeputyUrl(profileKey: string, legislature = 18) {
  return `/daten?${new URLSearchParams({ bereich: "parlis", urheber: profileKey, wahlperiode: String(legislature) })}`;
}
