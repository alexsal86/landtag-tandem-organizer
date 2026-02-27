import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $getNodeByKey } from 'lexical';
import {
  $createPageBreakSpacerNode,
  $isPageBreakSpacerNode,
} from '../nodes/PageBreakSpacerNode';

export interface PageBreakConfig {
  editorTopMm: number;
  footerTopMm: number;
  pageHeightMm: number;
  followupTopMarginMm: number;
}

interface PageBreakPluginProps {
  config: PageBreakConfig;
}

const PX_PER_MM = 3.7795;

export function PageBreakPlugin({ config }: PageBreakPluginProps) {
  const [editor] = useLexicalComposerContext();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUpdatingRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const { editorTopMm, footerTopMm, pageHeightMm, followupTopMarginMm } = config;

  const page1HeightMm = footerTopMm - editorTopMm;
  const followupHeightMm = footerTopMm - followupTopMarginMm;
  const deadZoneMm = (pageHeightMm - footerTopMm) + followupTopMarginMm;

  const page1HeightPx = page1HeightMm * PX_PER_MM;
  const followupHeightPx = followupHeightMm * PX_PER_MM;
  const deadZonePx = deadZoneMm * PX_PER_MM;

  useEffect(() => {
    const recalculate = () => {
      if (isUpdatingRef.current) return;

      const rootElement = editor.getRootElement();
      if (!rootElement) return;

      // Check if any spacers exist
      let hasSpacers = false;
      editor.getEditorState().read(() => {
        const root = $getRoot();
        for (const child of root.getChildren()) {
          if ($isPageBreakSpacerNode(child)) {
            hasSpacers = true;
            break;
          }
        }
      });

      isUpdatingRef.current = true;

      // Phase 1: Remove all existing spacers
      editor.update(
        () => {
          const root = $getRoot();
          const spacerKeys: string[] = [];
          for (const child of root.getChildren()) {
            if ($isPageBreakSpacerNode(child)) {
              spacerKeys.push(child.getKey());
            }
          }
          for (const key of spacerKeys) {
            const node = $getNodeByKey(key);
            if (node) node.remove();
          }
        },
        {
          discrete: true,
          onUpdate: () => {
            // Phase 2: After DOM has updated, measure and insert
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
              const rootEl = editor.getRootElement();
              if (!rootEl) {
                isUpdatingRef.current = false;
                return;
              }

              // Read actual DOM positions
              editor.update(
                () => {
                  const root = $getRoot();
                  const children = root.getChildren();

                  let cumHeightPx = 0;
                  let pageBottomPx = page1HeightPx;

                  for (const child of children) {
                    if ($isPageBreakSpacerNode(child)) continue;

                    const dom = editor.getElementByKey(child.getKey());
                    if (!dom) continue;

                    const heightPx = dom.getBoundingClientRect().height;
                    const nodeBottomPx = cumHeightPx + heightPx;

                    if (nodeBottomPx > pageBottomPx) {
                      // Calculate dynamic spacer height
                      const restOfPagePx = pageBottomPx - cumHeightPx;
                      const spacerHeightMm = (restOfPagePx / PX_PER_MM) + deadZoneMm;

                      const spacer = $createPageBreakSpacerNode(spacerHeightMm);
                      child.insertBefore(spacer);

                      // Advance past the dead zone
                      cumHeightPx = pageBottomPx + deadZonePx;
                      pageBottomPx = cumHeightPx + followupHeightPx;
                      cumHeightPx += heightPx;
                    } else {
                      cumHeightPx = nodeBottomPx;
                    }
                  }
                },
                {
                  onUpdate: () => {
                    isUpdatingRef.current = false;
                  },
                },
              );
            });
          },
        },
      );
    };

    const debouncedRecalc = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(recalculate, 200);
    };

    const removeUpdateListener = editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
      if (isUpdatingRef.current) return;
      if (dirtyElements.size > 0 || dirtyLeaves.size > 0) {
        debouncedRecalc();
      }
    });

    const initialTimer = setTimeout(recalculate, 500);

    return () => {
      removeUpdateListener();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTimeout(initialTimer);
    };
  }, [editor, page1HeightPx, followupHeightPx, deadZonePx, deadZoneMm]);

  return null;
}
