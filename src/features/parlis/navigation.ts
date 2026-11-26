export function parlisDeputyUrl(profileKey: string) {
  return `/daten?${new URLSearchParams({ bereich: "parlis", urheber: profileKey })}`;
}
