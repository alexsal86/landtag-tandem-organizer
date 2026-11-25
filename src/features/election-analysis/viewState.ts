/** URL-bound view state shared by the election views, so a copied link reopens the same view. */

export function readPartySelection(params: URLSearchParams, key: string, known: readonly string[]): string[] {
  return (params.get(key) || '')
    .split(',')
    .filter(party => known.includes(party));
}

export function toggleParty(hidden: readonly string[], party: string): string[] {
  return hidden.includes(party) ? hidden.filter(value => value !== party) : [...hidden, party];
}

/** Unknown codes are dropped and an empty selection removes the parameter instead of writing it empty. */
export function setPartySelection(
  params: URLSearchParams,
  key: string,
  hidden: readonly string[],
  known: readonly string[],
): URLSearchParams {
  const next = new URLSearchParams(params);
  const values = [...new Set(hidden.filter(party => known.includes(party)))];
  if (values.length) next.set(key, values.join(','));
  else next.delete(key);
  return next;
}

export function readFlag(params: URLSearchParams, key: string): boolean {
  return params.get(key) === '1';
}

export function setFlag(params: URLSearchParams, key: string, active: boolean): URLSearchParams {
  const next = new URLSearchParams(params);
  if (active) next.set(key, '1');
  else next.delete(key);
  return next;
}
