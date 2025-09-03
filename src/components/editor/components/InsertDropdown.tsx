import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Plus, 
  Table, 
  Minus, 
  Image, 
  Calculator,
  ChevronDown 
} from 'lucide-react';

export function InsertDropdown() {
  const [editor] = useLexicalComposerContext();

  const insertTable = () => {
    editor.dispatchCommand(INSERT_TABLE_COMMAND, {
      columns: '3',
      rows: '3',
      includeHeaders: true,
    });
  };

  const insertHorizontalRule = () => {
    editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
  };

  const insertImage = () => {
    // TODO: Implement image upload
    console.log('Image upload will be implemented');
  };

  const insertEquation = () => {
    // TODO: Implement equation editor
    console.log('Equation editor will be implemented');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          <span className="text-sm">Insert</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={insertTable} className="flex items-center gap-2">
          <Table className="h-4 w-4" />
          <span>Table</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={insertHorizontalRule} className="flex items-center gap-2">
          <Minus className="h-4 w-4" />
          <span>Horizontal Rule</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={insertImage} className="flex items-center gap-2">
          <Image className="h-4 w-4" />
          <span>Image</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={insertEquation} className="flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          <span>Equation</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}