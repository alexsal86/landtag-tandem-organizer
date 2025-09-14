import React, { useEffect, useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createTableNode,
  $createTableCellNode,
  $createTableRowNode,
  $isTableNode,
  $isTableCellNode,
  $isTableRowNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $getTableCellNodeFromLexicalNode
} from '@lexical/table';
import { 
  $insertNodes, 
  $getSelection, 
  $isRangeSelection, 
  $createParagraphNode,
  COMMAND_PRIORITY_NORMAL,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_TAB_COMMAND,
  $createRangeSelection,
  $setSelection
} from 'lexical';
import { mergeRegister } from '@lexical/utils';

export function ImprovedTablePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return mergeRegister(
      // Enhanced keyboard navigation
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (event: KeyboardEvent) => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            try {
              const tableNode = $getTableNodeFromLexicalNodeOrThrow(selection.anchor.getNode());
              if ($isTableNode(tableNode)) {
                event.preventDefault();
                navigateTableCells(event.shiftKey ? 'previous' : 'next');
                return true;
              }
            } catch (e) {
              // Not in table
            }
          }
          return false;
        },
        COMMAND_PRIORITY_NORMAL
      ),

      // Arrow key navigation within tables
      editor.registerCommand(
        KEY_ARROW_RIGHT_COMMAND,
        (event: KeyboardEvent) => {
          if (event.ctrlKey || event.metaKey) {
            return handleArrowNavigation('right');
          }
          return false;
        },
        COMMAND_PRIORITY_NORMAL
      ),

      editor.registerCommand(
        KEY_ARROW_LEFT_COMMAND,
        (event: KeyboardEvent) => {
          if (event.ctrlKey || event.metaKey) {
            return handleArrowNavigation('left');
          }
          return false;
        },
        COMMAND_PRIORITY_NORMAL
      ),

      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event: KeyboardEvent) => {
          if (event.ctrlKey || event.metaKey) {
            return handleArrowNavigation('down');
          }
          return false;
        },
        COMMAND_PRIORITY_NORMAL
      ),

      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event: KeyboardEvent) => {
          if (event.ctrlKey || event.metaKey) {
            return handleArrowNavigation('up');
          }
          return false;
        },
        COMMAND_PRIORITY_NORMAL
      )
    );
  }, [editor]);

  const navigateTableCells = useCallback((direction: 'next' | 'previous') => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const node = selection.anchor.getNode();
        let cellNode = $getTableCellNodeFromLexicalNode(node);
        
        if (!cellNode) {
          cellNode = $getTableCellNodeFromLexicalNode(node.getParent());
        }
        
        if ($isTableCellNode(cellNode)) {
          const rowNode = cellNode.getParent();
          if (!$isTableRowNode(rowNode)) return;
          
          const tableNode = rowNode.getParent();
          if (!$isTableNode(tableNode)) return;
          
          if (direction === 'next') {
            const nextCell = cellNode.getNextSibling();
            if (nextCell && $isTableCellNode(nextCell)) {
              focusCell(nextCell);
            } else {
              // Move to first cell of next row or create new row
              const nextRow = rowNode.getNextSibling();
              if (nextRow && $isTableRowNode(nextRow)) {
                const firstCell = nextRow.getFirstChild();
                if ($isTableCellNode(firstCell)) {
                  focusCell(firstCell);
                }
              } else {
                // Create new row
                createNewRow(tableNode, rowNode, 'after');
              }
            }
          } else {
            // Previous direction
            const prevCell = cellNode.getPreviousSibling();
            if (prevCell && $isTableCellNode(prevCell)) {
              focusCell(prevCell);
            } else {
              // Move to last cell of previous row
              const prevRow = rowNode.getPreviousSibling();
              if (prevRow && $isTableRowNode(prevRow)) {
                const lastCell = prevRow.getLastChild();
                if ($isTableCellNode(lastCell)) {
                  focusCell(lastCell);
                }
              }
            }
          }
        }
      }
    });
  }, [editor]);

  const handleArrowNavigation = useCallback((direction: 'up' | 'down' | 'left' | 'right'): boolean => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const node = selection.anchor.getNode();
        let cellNode = $getTableCellNodeFromLexicalNode(node);
        
        if (!cellNode) {
          cellNode = $getTableCellNodeFromLexicalNode(node.getParent());
        }
        
        if ($isTableCellNode(cellNode)) {
          const rowNode = cellNode.getParent();
          if (!$isTableRowNode(rowNode)) return false;
          
          const tableNode = rowNode.getParent();
          if (!$isTableNode(tableNode)) return false;
          
          let targetCell: TableCellNode | null = null;
          
          switch (direction) {
            case 'left':
              targetCell = cellNode.getPreviousSibling() as TableCellNode;
              break;
            case 'right':
              targetCell = cellNode.getNextSibling() as TableCellNode;
              break;
            case 'up': {
              const prevRow = rowNode.getPreviousSibling() as TableRowNode;
              if (prevRow) {
                const children = prevRow.getChildren();
                const currentIndex = rowNode.getChildren().indexOf(cellNode);
                targetCell = (children[currentIndex] || children[children.length - 1]) as TableCellNode;
              }
              break;
            }
            case 'down': {
              const nextRow = rowNode.getNextSibling() as TableRowNode;
              if (nextRow) {
                const children = nextRow.getChildren();
                const currentIndex = rowNode.getChildren().indexOf(cellNode);
                targetCell = (children[currentIndex] || children[0]) as TableCellNode;
              }
              break;
            }
          }
          
          if (targetCell && $isTableCellNode(targetCell)) {
            focusCell(targetCell);
            return true;
          }
        }
      }
      return false;
    });
  }, [editor]);

  const focusCell = useCallback((cell: TableCellNode) => {
    const firstChild = cell.getFirstChild();
    if (firstChild) {
      const selection = $createRangeSelection();
      selection.anchor.set(firstChild.getKey(), 0, 'element');
      selection.focus.set(firstChild.getKey(), 0, 'element');
      $setSelection(selection);
    }
  }, []);

  const createNewRow = useCallback((table: TableNode, currentRow: TableRowNode, position: 'before' | 'after') => {
    const newRow = $createTableRowNode();
    const cellCount = currentRow.getChildren().length;
    
    for (let i = 0; i < cellCount; i++) {
      const newCell = $createTableCellNode();
      newCell.append($createParagraphNode());
      newRow.append(newCell);
    }
    
    if (position === 'after') {
      currentRow.insertAfter(newRow);
    } else {
      currentRow.insertBefore(newRow);
    }
    
    // Focus first cell of new row
    const firstCell = newRow.getFirstChild();
    if ($isTableCellNode(firstCell)) {
      setTimeout(() => focusCell(firstCell), 0);
    }
  }, [focusCell]);

  const insertTable = useCallback((rows: number, columns: number) => {
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
        
        // Focus first cell after insertion
        setTimeout(() => {
          const firstRow = tableNode.getFirstChild();
          if ($isTableRowNode(firstRow)) {
            const firstCell = firstRow.getFirstChild();
            if ($isTableCellNode(firstCell)) {
              focusCell(firstCell);
            }
          }
        }, 0);
      }
    });
  }, [editor, focusCell]);

  return null; // This plugin provides functionality without UI
}

export { TableNode, TableCellNode, TableRowNode };