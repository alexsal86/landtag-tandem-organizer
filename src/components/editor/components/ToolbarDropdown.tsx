import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ToolbarDropdownProps {
  options: Array<{
    key: string;
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  }>;
  selectedKey: string;
  buttonLabel: string;
  className?: string;
}

export function ToolbarDropdown({
  options,
  selectedKey,
  buttonLabel,
  className = '',
}: ToolbarDropdownProps): JSX.Element {
  const selectedOption = options.find(option => option.key === selectedKey);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={`gap-1 ${className}`}>
          {selectedOption?.icon}
          <span className="text-sm">{selectedOption?.label || buttonLabel}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.key}
            onClick={option.onClick}
            className="flex items-center gap-2"
          >
            {option.icon}
            <span>{option.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}