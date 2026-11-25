/**
 * Bindet die generierten Katalogdateien zur Build-Zeit ein (`?raw`).
 * Quelle bleibt `docs/features/*.md` und `docs/entity-map.md`; hier wird nichts gepflegt.
 */
const areaFiles = import.meta.glob('/docs/features/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const entityMapFiles = import.meta.glob('/docs/entity-map.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export interface CatalogPage {
  id: string;
  title: string;
  markdown: string;
}

const idFromPath = (path: string) => path.split('/').pop()?.replace(/\.md$/, '') ?? path;

function titleFrom(markdown: string, fallback: string) {
  return /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim() || fallback;
}

export const catalogPages: CatalogPage[] = Object.entries(areaFiles)
  .map(([path, markdown]) => {
    const id = idFromPath(path);
    return { id, title: titleFrom(markdown, id), markdown };
  })
  .sort((a, b) => {
    if (a.id === 'README') return -1;
    if (b.id === 'README') return 1;
    return a.title.localeCompare(b.title, 'de');
  });

export const entityMapMarkdown = Object.values(entityMapFiles)[0] ?? '';
