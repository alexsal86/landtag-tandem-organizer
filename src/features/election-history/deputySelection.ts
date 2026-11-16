type DeputyIdentity = { id: string; person_id: string | null; connection_id?: string | null };

/** Explicit selection can extend one connection, never overwrite existing identities or groups. */
export function canConfirmDeputySelection(rows: readonly DeputyIdentity[], selected: readonly string[]) {
  if (selected.length < 2 || new Set(selected).size !== selected.length) return false;
  const chosen = selected.map(id => rows.find(row => row.id === id));
  if (chosen.some(row => !row)) return false;
  const identities = new Set(chosen.flatMap(row => row?.person_id ? [row.person_id] : []));
  const connections = new Set(chosen.flatMap(row => row?.connection_id ? [row.connection_id] : []));
  return identities.size <= 1 && connections.size <= 1 && chosen.some(row => !row?.connection_id);
}

/** Derive current mandate rows, including gaps and individual dates, without snapshots. */
export function connectedDeputyMandates<T extends DeputyIdentity>(rows: readonly T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = row.connection_id ? `connection:${row.connection_id}` : row.person_id ? `person:${row.person_id}` : null;
    if (key) groups.set(key, [...(groups.get(key) || []), row]);
  }
  return [...groups.values()].filter(group => group.length > 1);
}
