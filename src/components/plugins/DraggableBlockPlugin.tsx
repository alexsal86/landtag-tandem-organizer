import { useRef } from 'react';
import { DraggableBlockPlugin_EXPERIMENTAL } from '@lexical/react/LexicalDraggableBlockPlugin';
import { GripVertical } from 'lucide-react';

interface DraggableBlockPluginProps {
  anchorElem?: HTMLElement;
}

function isOnMenu(element: HTMLElement): boolean {
  return !!element.closest('.draggable-block-menu');
}

export default function DraggableBlockPlugin({
  anchorElem = document.body,
}: DraggableBlockPluginProps): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null);
  const targetLineRef = useRef<HTMLDivElement>(null);

  return (
    <DraggableBlockPlugin_EXPERIMENTAL
      anchorElem={anchorElem}
      menuRef={menuRef}
      targetLineRef={targetLineRef}
      isOnMenu={isOnMenu}
      menuComponent={
        <div ref={menuRef} className="draggable-block-menu">
          <button
            type="button"
            className="draggable-block-menu-icon"
            tabIndex={-1}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      }
      targetLineComponent={
        <div ref={targetLineRef} className="draggable-block-target-line" />
      }
    />
  );
}
