/** A name match is only a suggestion. Only explicitly selected, unlinked rows may be confirmed. */
export function canConfirmDeputySelection(rows: readonly { id: string; person_id: string | null }[], selected: readonly string[]) {
  return selected.length > 0 && new Set(selected).size === selected.length
    && selected.every(id => rows.some(row => row.id === id && row.person_id === null));
}
