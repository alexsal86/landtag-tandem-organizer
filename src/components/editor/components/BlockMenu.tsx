import { Plus, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { InsertDropdown } from './InsertDropdown';
import './BlockMenu.css';

interface BlockMenuProps {
  onAddClick?: () => void;
}

export function BlockMenu({ onAddClick }: BlockMenuProps) {
  return (
    <div className="block-menu">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-accent"
            onClick={onAddClick}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <InsertDropdown />
        </PopoverContent>
      </Popover>
      
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 hover:bg-accent cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </Button>
    </div>
  );
}