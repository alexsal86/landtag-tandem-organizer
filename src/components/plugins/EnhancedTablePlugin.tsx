import React, { useState, useCallback, useEffect } from 'react';
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
  $getNodeByKey,
  COMMAND_PRIORITY_NORMAL,
  CLICK_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_TAB_COMMAND,
  KEY_ESCAPE_COMMAND
} from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Table, 
  Plus, 
  Minus, 
  Merge, 
  SplitSquareHorizontal,
  MoreHorizontal,
  MoreVertical,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TableContextMenuProps {
  x: number;
  y: number;
  tableNode: TableNode;
  onClose: () => void;
  onAction: (action: string, data?: any) => void;
}

const TableContextMenu: React.FC<TableContextMenuProps> = ({
  x,
  y,
  tableNode,
  onClose,
  onAction
}) => {
  return (
    <Card 
      className="absolute z-50 w-64 shadow-lg border"
      style={{ left: x, top: y }}
    >
      <CardContent className="p-2">
        <div className="space-y-1">
          <div className="text-sm font-medium text-muted-foreground mb-2">Tabelle bearbeiten</div>
          
          <div className="grid grid-cols-2 gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAction('addRowAbove')}
              className="justify-start"
            >
              <Plus className="h-4 w-4 mr-2" />
              Zeile oben
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAction('addRowBelow')}
              className="justify-start"
            >
              <Plus className="h-4 w-4 mr-2" />
              Zeile unten
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAction('addColumnLeft')}
              className="justify-start"
            >
              <Plus className="h-4 w-4 mr-2" />
              Spalte links
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAction('addColumnRight')}
              className="justify-start"
            >
              <Plus className="h-4 w-4 mr-2" />
              Spalte rechts
            </Button>
          </div>
          
          <div className="border-t pt-2 mt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAction('deleteRow')}
              className="w-full justify-start text-destructive"
            >
              <Minus className="h-4 w-4 mr-2" />
              Zeile löschen
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAction('deleteColumn')}
              className="w-full justify-start text-destructive"
            >
              <Minus className="h-4 w-4 mr-2" />
              Spalte löschen
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAction('deleteTable')}
              className="w-full justify-start text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Tabelle löschen
            </Button>
          </div>
          
          <div className="border-t pt-2 mt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAction('toggleHeader')}
              className="w-full justify-start"
            >
              <Table className="h-4 w-4 mr-2" />
              Header umschalten
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface TableToolbarProps {
  tableNode: TableNode;
  onAction: (action: string, data?: any) => void;
}

const TableToolbar: React.FC<TableToolbarProps> = ({ tableNode, onAction }) => {
  return (
    <div className="flex items-center gap-1 p-2 bg-muted/50 rounded-t border-b">
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction('addRowAbove')}
          title="Zeile oben hinzufügen"
        >
          <Plus className="h-4 w-4" />
          <MoreHorizontal className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction('addColumnLeft')}
          title="Spalte links hinzufügen"
        >
          <Plus className="h-4 w-4" />
          <MoreVertical className="h-3 w-3" />
        </Button>
      </div>
      
      <div className="mx-2 h-4 w-px bg-border" />
      
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction('alignLeft')}
          title="Links ausrichten"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction('alignCenter')}
          title="Zentrieren"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction('alignRight')}
          title="Rechts ausrichten"
        >
          <AlignRight className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="mx-2 h-4 w-px bg-border" />
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => onAction('toggleHeader')}>
            Header umschalten
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onAction('deleteRow')} className="text-destructive">
            Zeile löschen
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction('deleteColumn')} className="text-destructive">
            Spalte löschen
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction('deleteTable')} className="text-destructive">
            Tabelle löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export function EnhancedTablePlugin() {
  const [editor] = useLexicalComposerContext();
  const [selectedTable, setSelectedTable] = useState<TableNode | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tableNode: TableNode;
  } | null>(null);
  const [tableToolbar, setTableToolbar] = useState<TableNode | null>(null);

  useEffect(() => {
    return mergeRegister(
      // Handle table selection and context menu
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          const target = event.target as HTMLElement;
          const tableElement = target.closest('table');
          
          if (tableElement && event.button === 2) { // Right click
            event.preventDefault();
            editor.getEditorState().read(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                const node = selection.anchor.getNode();
                const tableNode = $getTableNodeFromLexicalNodeOrThrow(node);
                if ($isTableNode(tableNode)) {
                  setContextMenu({
                    x: event.clientX,
                    y: event.clientY,
                    tableNode
                  });
                }
              }
            });
            return true;
          }
          
          // Show toolbar when clicking inside table
          if (tableElement) {
            editor.getEditorState().read(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                const node = selection.anchor.getNode();
                try {
                  const tableNode = $getTableNodeFromLexicalNodeOrThrow(node);
                  if ($isTableNode(tableNode)) {
                    setTableToolbar(tableNode);
                    setSelectedTable(tableNode);
                  }
                } catch (e) {
                  // Not in a table
                  setTableToolbar(null);
                  setSelectedTable(null);
                }
              }
            });
          } else {
            setTableToolbar(null);
            setSelectedTable(null);
          }
          
          return false;
        },
        COMMAND_PRIORITY_NORMAL
      ),
      
      // Handle keyboard navigation in tables
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (event: KeyboardEvent) => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            try {
              const tableNode = $getTableNodeFromLexicalNodeOrThrow(selection.anchor.getNode());
              if ($isTableNode(tableNode)) {
                event.preventDefault();
                // Move to next cell or create new row
                navigateTable(event.shiftKey ? 'previous' : 'next');
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
      
      // Close context menu on escape or outside click
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          if (contextMenu) {
            setContextMenu(null);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_NORMAL
      )
    );
  }, [editor, contextMenu]);

  const navigateTable = useCallback((direction: 'next' | 'previous') => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const node = selection.anchor.getNode();
        let cellNode = $getTableCellNodeFromLexicalNode(node);
        
        if (!cellNode) {
          // Try parent if direct lookup fails
          cellNode = $getTableCellNodeFromLexicalNode(node.getParent());
        }
        
        if ($isTableCellNode(cellNode)) {
          const rowNode = cellNode.getParent();
          if (!$isTableRowNode(rowNode)) return;
          
          const tableNode = rowNode.getParent();
          if (!$isTableNode(tableNode)) return;
          
          if (direction === 'next') {
            // Move to next cell or create new row
            const nextCell = cellNode.getNextSibling();
            if (nextCell && $isTableCellNode(nextCell)) {
              nextCell.selectStart();
            } else {
              // End of row, go to next row or create new one
              const nextRow = rowNode.getNextSibling();
              if (nextRow && $isTableRowNode(nextRow)) {
                const firstCell = nextRow.getFirstChild();
                if ($isTableCellNode(firstCell)) {
                  firstCell.selectStart();
                }
              } else {
                // Create new row
                addTableRow(tableNode, 'below');
                // Navigate to first cell of new row
                setTimeout(() => {
                  const newNextRow = rowNode.getNextSibling();
                  if (newNextRow && $isTableRowNode(newNextRow)) {
                    const firstCell = newNextRow.getFirstChild();
                    if ($isTableCellNode(firstCell)) {
                      firstCell.selectStart();
                    }
                  }
                }, 0);
              }
            }
          } else {
            // Move to previous cell
            const prevCell = cellNode.getPreviousSibling();
            if (prevCell && $isTableCellNode(prevCell)) {
              prevCell.selectStart();
            } else {
              // Beginning of row, go to previous row
              const prevRow = rowNode.getPreviousSibling();
              if (prevRow && $isTableRowNode(prevRow)) {
                const lastCell = prevRow.getLastChild();
                if ($isTableCellNode(lastCell)) {
                  lastCell.selectStart();
                }
              }
            }
          }
        }
      }
    });
  }, [editor]);

  const addTableRow = useCallback((tableNode: TableNode, position: 'above' | 'below') => {
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
          if ($isTableRowNode(rowNode)) {
            const newRow = $createTableRowNode();
            const cells = rowNode.getChildren();
            const cellsCount = cells.length;
            
            for (let i = 0; i < cellsCount; i++) {
              const newCell = $createTableCellNode();
              newCell.append($createParagraphNode());
              newRow.append(newCell);
            }
            
            if (position === 'below') {
              rowNode.insertAfter(newRow);
            } else {
              rowNode.insertBefore(newRow);
            }
          }
        }
      }
    });
  }, [editor]);

  const addTableColumn = useCallback((tableNode: TableNode, position: 'left' | 'right') => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const node = selection.anchor.getNode();
        const cellNode = $getTableCellNodeFromLexicalNode(node);
        if ($isTableCellNode(cellNode)) {
          const rowNode = cellNode.getParent();
          if ($isTableRowNode(rowNode)) {
            const cells = rowNode.getChildren();
            const cellIndex = cells.indexOf(cellNode);
            
            const rows = tableNode.getChildren();
            rows.forEach((row) => {
              if ($isTableRowNode(row)) {
                const newCell = $createTableCellNode();
                newCell.append($createParagraphNode());
                
                const children = row.getChildren();
                if (position === 'right') {
                  const targetCell = children[cellIndex] || children[children.length - 1];
                  targetCell.insertAfter(newCell);
                } else {
                  const targetCell = children[cellIndex] || children[0];
                  targetCell.insertBefore(newCell);
                }
              }
            });
          }
        }
      }
    });
  }, [editor]);

  const deleteTableRow = useCallback((tableNode: TableNode) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const node = selection.anchor.getNode();
        const cellNode = $getTableCellNodeFromLexicalNode(node);
        if ($isTableCellNode(cellNode)) {
          const rowNode = cellNode.getParent();
          if ($isTableRowNode(rowNode)) {
            rowNode.remove();
          }
        }
      }
    });
  }, [editor]);

  const deleteTableColumn = useCallback((tableNode: TableNode) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const node = selection.anchor.getNode();
        const cellNode = $getTableCellNodeFromLexicalNode(node);
        if ($isTableCellNode(cellNode)) {
          const rowNode = cellNode.getParent();
          if ($isTableRowNode(rowNode)) {
            const cells = rowNode.getChildren();
            const cellIndex = cells.indexOf(cellNode);
            
            const rows = tableNode.getChildren();
            rows.forEach((row) => {
              if ($isTableRowNode(row)) {
                const children = row.getChildren();
                const targetCell = children[cellIndex];
                if ($isTableCellNode(targetCell)) {
                  targetCell.remove();
                }
              }
            });
          }
        }
      }
    });
  }, [editor]);

  const deleteTable = useCallback((tableNode: TableNode) => {
    editor.update(() => {
      tableNode.remove();
      setSelectedTable(null);
      setTableToolbar(null);
    });
  }, [editor]);

  const handleTableAction = useCallback((action: string, data?: any) => {
    if (!selectedTable) return;

    switch (action) {
      case 'addRowAbove':
        addTableRow(selectedTable, 'above');
        break;
      case 'addRowBelow':
        addTableRow(selectedTable, 'below');
        break;
      case 'addColumnLeft':
        addTableColumn(selectedTable, 'left');
        break;
      case 'addColumnRight':
        addTableColumn(selectedTable, 'right');
        break;
      case 'deleteRow':
        deleteTableRow(selectedTable);
        break;
      case 'deleteColumn':
        deleteTableColumn(selectedTable);
        break;
      case 'deleteTable':
        deleteTable(selectedTable);
        break;
      case 'toggleHeader':
        // Toggle header functionality
        break;
    }
    
    setContextMenu(null);
  }, [selectedTable, addTableRow, addTableColumn, deleteTableRow, deleteTableColumn, deleteTable]);

  const insertTable = useCallback((rows: number = 3, columns: number = 3) => {
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
  }, [editor]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu]);

  return (
    <>
      {/* Context Menu */}
      {contextMenu && (
        <TableContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tableNode={contextMenu.tableNode}
          onClose={() => setContextMenu(null)}
          onAction={handleTableAction}
        />
      )}
      
      {/* Table Toolbar - could be positioned relative to table */}
      {tableToolbar && (
        <div className="fixed top-20 right-4 z-40">
          <TableToolbar
            tableNode={tableToolbar}
            onAction={handleTableAction}
          />
        </div>
      )}
    </>
  );
}

export { TableNode, TableCellNode, TableRowNode };