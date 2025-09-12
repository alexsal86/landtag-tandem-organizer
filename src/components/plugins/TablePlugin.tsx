import React from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createTableNode,
  $createTableCellNode,
  $createTableRowNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  $isTableNode,
  $isTableCellNode,
  $isTableRowNode
} from '@lexical/table';
import { $insertNodes, $getSelection, $isRangeSelection, $createParagraphNode } from 'lexical';

export function TablePlugin() {
  const [editor] = useLexicalComposerContext();

  const insertTable = (rows: number, columns: number) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const tableNode = $createTableNode();
        
        for (let i = 0; i < rows; i++) {
          const rowNode = $createTableRowNode();
          for (let j = 0; j < columns; j++) {
            const cellNode = $createTableCellNode();
            cellNode.append($createParagraphNode());
            rowNode.append(cellNode);
          }
          tableNode.append(rowNode);
        }
        
        $insertNodes([tableNode]);
      }
    });
  };

  return null; // Plugin has no UI, just provides functionality
}

export { TableNode, TableCellNode, TableRowNode };