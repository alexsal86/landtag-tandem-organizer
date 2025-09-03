import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Palette } from 'lucide-react';

const COLORS = [
  '#000000', '#ffffff', '#888888', '#ff0000', '#ff8c00', '#ffd700',
  '#90ee90', '#00ced1', '#1e90ff', '#c71585', '#8b4513', '#2f4f4f',
  '#800080', '#ff69b4', '#40e0d0', '#ee82ee', '#87ceeb', '#98fb98',
  '#f0e68c', '#dda0dd', '#87cefa', '#ffb6c1', '#32cd32', '#ffa07a',
];

interface ColorPickerProps {
  color: string;
  onColorChange: (color: string) => void;
  icon?: React.ReactNode;
  label?: string;
}

export function ColorPicker({ color, onColorChange, icon, label }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 min-w-[100px]">
          {icon || <Palette className="h-4 w-4" />}
          <div 
            className="w-4 h-4 rounded border border-border"
            style={{ backgroundColor: color }}
          />
          {label && <span className="text-sm">{label}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="grid grid-cols-6 gap-2">
          {COLORS.map((colorOption) => (
            <button
              key={colorOption}
              className="w-8 h-8 rounded border border-border hover:scale-110 transition-transform"
              style={{ backgroundColor: colorOption }}
              onClick={() => {
                onColorChange(colorOption);
                setIsOpen(false);
              }}
              title={colorOption}
            />
          ))}
        </div>
        <div className="mt-3 pt-3 border-t">
          <input
            type="color"
            value={color}
            onChange={(e) => {
              onColorChange(e.target.value);
              setIsOpen(false);
            }}
            className="w-full h-8 rounded border border-border cursor-pointer"
            title="Custom color"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}