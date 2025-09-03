import { useEffect, useRef } from 'react';
import { DraggableBlockPlugin } from '../plugins/DraggableBlockPlugin';
import { BlockMenu } from './BlockMenu';
import { DropTargetLine } from './DropTargetLine';

interface DraggableMenuWrapperProps {
  contentEditableRef: React.RefObject<HTMLDivElement>;
}

export function DraggableMenuWrapper({ contentEditableRef }: DraggableMenuWrapperProps) {
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const targetLineRef = useRef<HTMLDivElement>(null);

  const isOnBlockMenu = (element: HTMLElement): boolean => {
    return blockMenuRef.current?.contains(element) || false;
  };

  // Add debug logging
  useEffect(() => {
    console.log('DraggableMenuWrapper: contentEditableRef.current:', contentEditableRef.current);
  }, [contentEditableRef.current]);

  if (!contentEditableRef.current) {
    console.log('DraggableMenuWrapper: No anchor element available yet');
    return null;
  }

  console.log('DraggableMenuWrapper: Rendering plugin with anchor:', contentEditableRef.current);

  return (
    <DraggableBlockPlugin
      anchorElem={contentEditableRef.current}
      menuRef={blockMenuRef}
      targetLineRef={targetLineRef}
      menuComponent={<BlockMenu />}
      targetLineComponent={<DropTargetLine />}
      isOnMenu={isOnBlockMenu}
    />
  );
}