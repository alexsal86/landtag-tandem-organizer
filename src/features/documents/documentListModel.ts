export type DocumentSort = { key: "title" | "created_at"; direction: "asc" | "desc" };
interface ListDocument {
  id: string; title: string; description?: string | null; file_name: string;
  category?: string | null; folder_id?: string | null; created_at: string;
}

/** Category chips combine with OR; folder and text search narrow that result. */
export function visibleDocuments<T extends ListDocument>(documents: readonly T[], options: {
  search: string; categories: readonly string[]; folderId: string | null; sort: DocumentSort;
}): T[] {
  const query = options.search.trim().toLocaleLowerCase("de");
  const collator = new Intl.Collator("de", { numeric: true, sensitivity: "base" });
  return documents.filter(doc =>
    (doc.folder_id ?? null) === options.folderId
    && (!options.categories.length || options.categories.includes(doc.category ?? ""))
    && [doc.title, doc.description ?? "", doc.file_name].some(text => text.toLocaleLowerCase("de").includes(query))
  ).sort((a, b) => {
    const value = options.sort.key === "title" ? collator.compare(a.title, b.title)
      : (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0);
    return (options.sort.direction === "asc" ? value : -value) || a.id.localeCompare(b.id);
  });
}

export function nextDocumentSort(current: DocumentSort, key: DocumentSort["key"]): DocumentSort {
  return { key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" };
}

/** Select-all only acts on the current visible list, never unseen folders or filtered documents. */
export function selectVisibleDocuments(selected: ReadonlySet<string>, visibleIds: readonly string[], checked: boolean): Set<string> {
  const next = new Set(selected);
  for (const id of visibleIds) { if (checked) next.add(id); else next.delete(id); }
  return next;
}
