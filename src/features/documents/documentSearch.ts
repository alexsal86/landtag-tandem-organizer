// Quote the operand for PostgREST and treat the search text as a literal regex pattern.
export function documentSearchFilter(search: string): string {
  const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = JSON.stringify(escaped);
  return ["title", "description", "file_name"].map(column => `${column}.imatch.${pattern}`).join(",");
}
