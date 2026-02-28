import { useMemo } from 'react';

export interface PageInfo {
  pageNumber: number;
  /** mm offset into the editor content for this page */
  contentOffsetMm: number;
  /** mm of editor content visible on this page */
  contentHeightMm: number;
}

export interface PaginationResult {
  totalPages: number;
  page1ContentHeight: number;
  followPageContentHeight: number;
  pages: PageInfo[];
}

/** Height of the reduced header on follow-up pages (mm) */
export const FOLLOW_PAGE_HEADER_HEIGHT_MM = 15;
/** Top margin on follow-up pages where content starts (below reduced header) */
export const FOLLOW_PAGE_CONTENT_TOP_MM = 20; // 15mm header + 5mm gap

/**
 * Calculates how many A4 pages are needed and what slice of editor content
 * each page shows.
 *
 * @param editorTopMm  – where the Lexical editor starts on page 1 (mm from top)
 * @param footerTopMm  – where the footer begins (mm from top, typically 272)
 * @param contentHeightMm – measured total height of the Lexical editor content (mm)
 */
export function useContentPagination(
  editorTopMm: number,
  footerTopMm: number,
  contentHeightMm: number,
): PaginationResult {
  return useMemo(() => {
    const page1Available = Math.max(0, footerTopMm - editorTopMm - 10); // 10mm safety for closing/pagination
    const followAvailable = Math.max(0, footerTopMm - FOLLOW_PAGE_CONTENT_TOP_MM - 10);

    if (contentHeightMm <= page1Available) {
      return {
        totalPages: 1,
        page1ContentHeight: page1Available,
        followPageContentHeight: followAvailable,
        pages: [{ pageNumber: 1, contentOffsetMm: 0, contentHeightMm: page1Available }],
      };
    }

    const remaining = contentHeightMm - page1Available;
    const extraPages = Math.ceil(remaining / followAvailable);
    const totalPages = 1 + extraPages;

    const pages: PageInfo[] = [
      { pageNumber: 1, contentOffsetMm: 0, contentHeightMm: page1Available },
    ];

    for (let i = 1; i <= extraPages; i++) {
      const offset = page1Available + (i - 1) * followAvailable;
      const height = i === extraPages ? remaining - (i - 1) * followAvailable : followAvailable;
      pages.push({ pageNumber: i + 1, contentOffsetMm: offset, contentHeightMm: height });
    }

    return { totalPages, page1ContentHeight: page1Available, followPageContentHeight: followAvailable, pages };
  }, [editorTopMm, footerTopMm, contentHeightMm]);
}
