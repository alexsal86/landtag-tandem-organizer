/**
 * PageLayoutPlugin
 *
 * Simuliert echten Seitenumbruch in Lexical:
 * 1. Misst die tatsächliche Höhe des Editors via ResizeObserver
 * 2. Berechnet wo Seitengrenzen liegen (pageHeightPx - margins)
 * 3. Fügt PageBreakNodes an den richtigen Stellen ein
 * 4. Scrollt smooth zum Cursor wenn dieser eine Seitengrenze überquert
 * 5. Bei Enter am Seitenende: Cursor springt auf Seite 2
 */

import { useEffect, useRef, useCallback } from 'react';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isElementNode,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  KEY_ENTER_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  $createParagraphNode,
  LexicalEditor,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createPageBreakNode,
  $isPageBreakNode,
  PageBreakNode,
} from '../nodes/PageBreakNode';

// ── Konstanten ──────────────────────────────────────────────────────────────

/** A4 bei 96 DPI: 297mm = 1122.52px → 1123 */
const A4_HEIGHT_PX = 1122.52;

/** DIN 5008 Ränder in px bei 96 DPI (25mm oben/unten, 20mm rechts) */
const MARGIN_TOP_PX = 94.49;   // 25mm
const MARGIN_BOTTOM_PX = 94.49; // 25mm

/** Nutzbarer Bereich pro Seite in px */
export const PAGE_CONTENT_HEIGHT_PX = A4_HEIGHT_PX - MARGIN_TOP_PX - MARGIN_BOTTOM_PX;

/** Puffer bevor Seitengrenze */
const PAGE_BOUNDARY_BUFFER_PX = 4;

/** Debounce-Zeit für ResizeObserver in ms */
const RESIZE_DEBOUNCE_MS = 120;

/** Minimale Inhaltshöhe ab der Pagination aktiviert wird */
const MIN_HEIGHT_FOR_PAGINATION_PX = PAGE_CONTENT_HEIGHT_PX * 0.8;

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────

function mmToPx(mm: number): number {
  return (mm / 25.4) * 96;
}

/**
 * Berechnet welche Nodes über eine Seitengrenze hinausgehen.
 * Returns:
 *  - breakPositions: where to insert PageBreakNodes (between elements only)
 *  - totalPages: total page count (includes pages spanned by single tall elements)
 */
function findPageBreakPositions(
  editor: LexicalEditor,
  editorRoot: HTMLElement,
  contentHeightPx: number,
): { breakPositions: Array<{ afterKey: string; pageNumber: number }>; totalPages: number } {
  const breakPositions: Array<{ afterKey: string; pageNumber: number }> = [];

  const nodeMap = new Map<string, Element>();
  editorRoot.querySelectorAll<Element>('[data-lexical-key]').forEach((el) => {
    const key = el.getAttribute('data-lexical-key');
    if (key) nodeMap.set(key, el);
  });

  let totalPages = 1;

  editor.getEditorState().read(() => {
    const root = $getRoot();
    const children = root.getChildren();

    let currentPageHeight = 0;
    let currentPage = 1;
    let prevNonBreakKey: string | null = null;

    for (const child of children) {
      if ($isPageBreakNode(child)) {
        continue;
      }

      const domEl = nodeMap.get(child.getKey());
      if (!domEl) continue;

      const elHeight = domEl.getBoundingClientRect().height;

      // Element exceeds page boundary → insert break BEFORE this element
      if (
        currentPageHeight + elHeight > contentHeightPx - PAGE_BOUNDARY_BUFFER_PX &&
        currentPageHeight > 0 &&
        prevNonBreakKey
      ) {
        breakPositions.push({ afterKey: prevNonBreakKey, pageNumber: currentPage + 1 });
        currentPage++;
        currentPageHeight = elHeight;
      } else {
        currentPageHeight += elHeight;
      }

      // Track pages spanned by single tall elements (no visual break possible)
      while (currentPageHeight > contentHeightPx) {
        currentPage++;
        currentPageHeight -= contentHeightPx;
      }

      prevNonBreakKey = child.getKey();
    }

    totalPages = currentPage;
  });

  return { breakPositions, totalPages };
}

// ── Hauptplugin ─────────────────────────────────────────────────────────────

export interface PageLayoutPluginProps {
  enabled: boolean;
  contentHeightMm?: number;
  onPageCountChange?: (pageCount: number) => void;
}

export function PageLayoutPlugin({
  enabled,
  contentHeightMm,
  onPageCountChange,
}: PageLayoutPluginProps) {
  const [editor] = useLexicalComposerContext();

  const contentHeightPx = contentHeightMm
    ? mmToPx(contentHeightMm)
    : PAGE_CONTENT_HEIGHT_PX;

  const lastPageCountRef = useRef(1);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUpdatingRef = useRef(false);

  const updatePageBreaks = useCallback(() => {
    if (!enabled || isUpdatingRef.current) return;

    const editorRoot = editor.getRootElement();
    if (!editorRoot) return;

    const totalHeight = editorRoot.scrollHeight;

    // Below threshold: remove all PageBreaks
    if (totalHeight < MIN_HEIGHT_FOR_PAGINATION_PX) {
      editor.update(() => {
        const root = $getRoot();
        root.getChildren().forEach((child) => {
          if ($isPageBreakNode(child)) child.remove();
        });
      });
      if (lastPageCountRef.current !== 1) {
        lastPageCountRef.current = 1;
        onPageCountChange?.(1);
      }
      return;
    }

    const { breakPositions, totalPages } = findPageBreakPositions(editor, editorRoot, contentHeightPx);

    isUpdatingRef.current = true;

    editor.update(
      () => {
        const root = $getRoot();

        // Step 1: Remove all existing PageBreakNodes
        root.getChildren().forEach((child) => {
          if ($isPageBreakNode(child)) child.remove();
        });

        // Step 2: Insert new ones at calculated positions
        breakPositions.forEach(({ afterKey, pageNumber }) => {
          const root2 = $getRoot();
          const targetNode = root2.getChildren().find((n) => n.getKey() === afterKey);
          if (targetNode) {
            const pageBreak = $createPageBreakNode(pageNumber);
            targetNode.insertAfter(pageBreak);
          }
        });

        if (lastPageCountRef.current !== totalPages) {
          lastPageCountRef.current = totalPages;
          Promise.resolve().then(() => onPageCountChange?.(totalPages));
        }
      },
      { onUpdate: () => { isUpdatingRef.current = false; } },
    );
  }, [editor, enabled, contentHeightPx, onPageCountChange]);

  // ── ResizeObserver ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return;

    const editorRoot = editor.getRootElement();
    if (!editorRoot) return;

    const observer = new ResizeObserver(() => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(updatePageBreaks, RESIZE_DEBOUNCE_MS);
    });

    observer.observe(editorRoot);
    updatePageBreaks();

    return () => {
      observer.disconnect();
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    };
  }, [editor, enabled, updatePageBreaks]);

  // ── Editor-Update-Listener (skip if only PageBreak changes) ──────────────

  useEffect(() => {
    if (!enabled) return;

    return editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
      if (isUpdatingRef.current) return;
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;

      // Check if all dirty nodes are PageBreakNodes → skip to prevent loop
      let allPageBreaks = true;
      editor.getEditorState().read(() => {
        const root = $getRoot();
        for (const [key] of dirtyElements) {
          const node = root.getChildrenKeys().includes(key)
            ? root.getChildren().find((c) => c.getKey() === key)
            : null;
          if (node && !$isPageBreakNode(node)) {
            allPageBreaks = false;
          }
        }
        if (dirtyLeaves.size > 0) allPageBreaks = false;
      });
      if (allPageBreaks && dirtyLeaves.size === 0) return;

      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(updatePageBreaks, RESIZE_DEBOUNCE_MS);
    });
  }, [editor, enabled, updatePageBreaks]);

  // ── Cleanup when disabled ─────────────────────────────────────────────────

  useEffect(() => {
    if (enabled) return;

    editor.update(() => {
      const root = $getRoot();
      root.getChildren().forEach((child) => {
        if ($isPageBreakNode(child)) child.remove();
      });
    });
  }, [editor, enabled]);

  // ── Cursor scroll near page boundary ──────────────────────────────────────

  useEffect(() => {
    if (!enabled) return;

    const scrollToCursor = () => {
      requestAnimationFrame(() => {
        const editorRoot = editor.getRootElement();
        if (!editorRoot) return;

        const nativeSelection = window.getSelection();
        if (!nativeSelection || nativeSelection.rangeCount === 0) return;

        const range = nativeSelection.getRangeAt(0);
        const cursorRect = range.getBoundingClientRect();
        const editorRect = editorRoot.getBoundingClientRect();

        const cursorRelativeY = cursorRect.top - editorRect.top + editorRoot.scrollTop;
        const currentPage = Math.floor(cursorRelativeY / contentHeightPx);
        const pageBottom = (currentPage + 1) * contentHeightPx;
        const nearBottom = cursorRelativeY > pageBottom - contentHeightPx * 0.1;

        if (nearBottom) {
          const scrollContainer = editorRoot.closest('[data-scroll-container]') as HTMLElement
            ?? editorRoot.parentElement?.parentElement as HTMLElement;

          if (scrollContainer) {
            scrollContainer.scrollTo({
              top: scrollContainer.scrollTop + (cursorRect.bottom - editorRect.top - scrollContainer.clientHeight + 40),
              behavior: 'smooth',
            });
          }
        }
      });
    };

    const unregisterEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      () => { scrollToCursor(); return false; },
      COMMAND_PRIORITY_LOW,
    );

    const unregisterDown = editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      () => { scrollToCursor(); return false; },
      COMMAND_PRIORITY_LOW,
    );

    return () => {
      unregisterEnter();
      unregisterDown();
    };
  }, [editor, enabled, contentHeightPx]);

  // ── Skip cursor past PageBreakNode ────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return;

    return editor.registerUpdateListener(() => {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const anchor = selection.anchor.getNode();
        if (!$isPageBreakNode(anchor)) return;

        editor.update(() => {
          const sel = $getSelection();
          if (!$isRangeSelection(sel)) return;

          const anchorNode = sel.anchor.getNode();
          if (!$isPageBreakNode(anchorNode)) return;

          const next = anchorNode.getNextSibling();
          if (next && $isElementNode(next)) {
            next.selectStart();
          } else if (next && $isTextNode(next)) {
            next.select(0, 0);
          } else {
            const p = $createParagraphNode();
            anchorNode.insertAfter(p);
            p.selectStart();
          }
        });
      });
    });
  }, [editor, enabled]);

  return null;
}
