import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { INSERT_EQUATION_COMMAND } from '../plugins/EquationPlugin';
import { INSERT_IMAGE_COMMAND } from '../plugins/ImagePlugin';
import { INSERT_COLLAPSIBLE_COMMAND } from '../plugins/CollapsiblePlugin';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { 
  Plus, 
  Table, 
  Minus, 
  Image, 
  Calculator,
  ChevronDown,
  FileImage,
  Folder,
  PlayCircle,
  Music,
  FileText,
  StickyNote
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
    const src = prompt('Enter image URL:');
    const alt = prompt('Enter image description:');
    if (src && alt) {
      editor.dispatchCommand(INSERT_IMAGE_COMMAND, { src, alt });
    }
  };

  const insertEquation = () => {
    const equation = prompt('Enter equation (LaTeX syntax):');
    if (equation) {
      editor.dispatchCommand(INSERT_EQUATION_COMMAND, { equation, inline: false });
    }
  };

  const insertInlineEquation = () => {
    const equation = prompt('Enter inline equation (LaTeX syntax):');
    if (equation) {
      editor.dispatchCommand(INSERT_EQUATION_COMMAND, { equation, inline: true });
    }
  };

  const insertCollapsible = () => {
    const title = prompt('Enter section title:') || 'Collapsible Section';
    editor.dispatchCommand(INSERT_COLLAPSIBLE_COMMAND, { title, isOpen: false });
  };

  const insertVideo = () => {
    const url = prompt('Enter YouTube/Vimeo URL:');
    if (url) {
      // TODO: Implement video embed
      console.log('Video embed will be implemented', url);
    }
  };

  const insertAudio = () => {
    const url = prompt('Enter audio URL:');
    if (url) {
      // TODO: Implement audio embed
      console.log('Audio embed will be implemented', url);
    }
  };

  const insertDocument = () => {
    // TODO: Implement document upload
    console.log('Document upload will be implemented');
  };

  const insertStickyNote = () => {
    const text = prompt('Enter sticky note text:') || 'Sticky Note';
    // TODO: Implement sticky note
    console.log('Sticky note will be implemented', text);
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
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={insertTable} className="flex items-center gap-2">
          <Table className="h-4 w-4" />
          <span>Table</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={insertHorizontalRule} className="flex items-center gap-2">
          <Minus className="h-4 w-4" />
          <span>Horizontal Rule</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={insertImage} className="flex items-center gap-2">
          <Image className="h-4 w-4" />
          <span>Image</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={insertVideo} className="flex items-center gap-2">
          <PlayCircle className="h-4 w-4" />
          <span>Video (YouTube/Vimeo)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={insertAudio} className="flex items-center gap-2">
          <Music className="h-4 w-4" />
          <span>Audio</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={insertDocument} className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span>Document</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={insertEquation} className="flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          <span>Math Equation</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={insertInlineEquation} className="flex items-center gap-2">
          <Calculator className="h-3 w-3" />
          <span>Inline Equation</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={insertCollapsible} className="flex items-center gap-2">
          <Folder className="h-4 w-4" />
          <span>Collapsible Section</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={insertStickyNote} className="flex items-center gap-2">
          <StickyNote className="h-4 w-4" />
          <span>Sticky Note</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}