import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $getNodeByKey } from 'lexical';
import {
  $createPageBreakSpacerNode,
  $isPageBreakSpacerNode,
  PageBreakSpacerNode,
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

  const { editorTopMm, footerTopMm, pageHeightMm, followupTopMarginMm } = config;

  // Available content height on page 1 (mm)
  const page1HeightMm = footerTopMm - editorTopMm;
  // Available content height on page 2+ (mm)
  const followupHeightMm = footerTopMm - followupTopMarginMm;
  // Dead zone height (footer + top margin of next page)
  const deadZoneMm = (pageHeightMm - footerTopMm) + followupTopMarginMm;

  useEffect(() => {
    const recalculate = () => {
      if (isUpdatingRef.current) return;

      const rootElement = editor.getRootElement();
      if (!rootElement) return;

      editor.getEditorState().read(() => {
        const root = $getRoot();
        const children = root.getChildren();

        // Build a list of { nodeKey, topPx, heightPx, isSpacer }
        const nodeInfos: Array<{
          key: string;
          topPx: number;
          heightPx: number;
          isSpacer: boolean;
        }> = [];

        for (const child of children) {
          const dom = editor.getElementByKey(child.getKey());
          if (!dom) continue;
          const rect = dom.getBoundingClientRect();
          const rootRect = rootElement.getBoundingClientRect();
          nodeInfos.push({
            key: child.getKey(),
            topPx: rect.top - rootRect.top,
            heightPx: rect.height,
            isSpacer: $isPageBreakSpacerNode(child),
          });
        }

        // Calculate page boundaries in px (relative to editor top)
        const page1HeightPx = page1HeightMm * PX_PER_MM;
        const followupHeightPx = followupHeightMm * PX_PER_MM;
        const deadZonePx = deadZoneMm * PX_PER_MM;

        // Determine which spacers to add/remove
        const spacersToRemove: string[] = [];
        const spacersToInsertBefore: Array<{ beforeKey: string }> = [];

        // Track cumulative position without spacers
        let cumulativeHeightPx = 0;
        let currentPageBottom = page1HeightPx;

        for (const info of nodeInfos) {
          if (info.isSpacer) {
            // Check if this spacer is still needed:
            // It's needed if the next non-spacer node would cross the page boundary
            // For now, collect all existing spacers for removal; we'll re-add as needed
            spacersToRemove.push(info.key);
            continue;
          }

          const nodeBottom = cumulativeHeightPx + info.heightPx;

          if (nodeBottom > currentPageBottom) {
            // This node crosses the page boundary - need a spacer before it
            spacersToInsertBefore.push({ beforeKey: info.key });
            // The spacer pushes content past the dead zone
            // After the spacer, content resumes at the top of the next page
            cumulativeHeightPx = currentPageBottom + deadZonePx;
            currentPageBottom = cumulativeHeightPx + followupHeightPx;
            // Re-add this node's height after the spacer
            cumulativeHeightPx += info.heightPx;
          } else {
            cumulativeHeightPx = nodeBottom;
          }
        }

        // Now apply changes if needed
        const needsUpdate =
          spacersToRemove.length > 0 || spacersToInsertBefore.length > 0;

        if (!needsUpdate) return;

        isUpdatingRef.current = true;

        editor.update(
          () => {
            // Remove old spacers
            for (const key of spacersToRemove) {
              const node = $getNodeByKey(key);
              if (node && $isPageBreakSpacerNode(node)) {
                node.remove();
              }
            }

            // Re-read children after removal
            const root = $getRoot();
            const freshChildren = root.getChildren();

            // Recalculate positions without spacers
            let cumHeight = 0;
            let pageBottom = page1HeightPx;

            for (const child of freshChildren) {
              if ($isPageBreakSpacerNode(child)) continue;

              const dom = editor.getElementByKey(child.getKey());
              if (!dom) continue;
              const rect = dom.getBoundingClientRect();
              const rootRect = rootElement.getBoundingClientRect();
              const heightPx = rect.height;

              const nodeBottom = cumHeight + heightPx;

              if (nodeBottom > pageBottom) {
                // Insert spacer before this node
                const spacer = $createPageBreakSpacerNode(deadZoneMm);
                child.insertBefore(spacer);
                cumHeight = pageBottom + deadZonePx;
                pageBottom = cumHeight + followupHeightPx;
                cumHeight += heightPx;
              } else {
                cumHeight = nodeBottom;
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
    };

    const debouncedRecalc = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(recalculate, 200);
    };

    // Listen for mutations (content changes)
    const removeMutationListener = editor.registerMutationListener(
      PageBreakSpacerNode,
      () => {
        // Ignore mutations from our own updates
      },
    );

    const removeUpdateListener = editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
      if (isUpdatingRef.current) return;
      if (dirtyElements.size > 0 || dirtyLeaves.size > 0) {
        debouncedRecalc();
      }
    });

    // Initial calculation after a short delay to let the DOM settle
    const initialTimer = setTimeout(recalculate, 500);

    return () => {
      removeMutationListener();
      removeUpdateListener();
      if (timerRef.current) clearTimeout(timerRef.current);
      clearTimeout(initialTimer);
    };
  }, [editor, page1HeightMm, followupHeightMm, deadZoneMm, editorTopMm, footerTopMm, pageHeightMm, followupTopMarginMm]);

  return null;
}
