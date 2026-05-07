import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface NoteLinkedBadgeProps {
  type: 'task' | 'decision' | 'meeting' | 'case_item';
  id: string;
  label: string;
  className?: string;
}

export function NoteLinkedBadge({ type, id, label, className }: NoteLinkedBadgeProps) {
  const navigate = useNavigate();
  
  const getPath = () => {
    switch (type) {
      case 'task': return `/mywork?tab=tasks&highlight=${id}`;
      case 'decision': return `/mywork?tab=decisions&highlight=${id}`;
      case 'case_item': return `/mywork?tab=cases&highlight=${id}`;
      case 'meeting': return `/meetings?highlight=${id}`;
    }
  };
  
  const getColor = () => {
    switch (type) {
      case 'task': 
        return 'text-palette-blue bg-palette-blue/20 border-palette-blue/40 hover:bg-palette-blue/30';
      case 'decision': 
        return 'text-palette-purple bg-palette-purple/20 border-palette-purple/40 hover:bg-palette-purple/30';
      case 'case_item':
        return 'text-palette-teal bg-palette-teal/20 border-palette-teal/40 hover:bg-palette-teal/30';
      case 'meeting': 
        return 'text-emerald-700 bg-emerald-100 border-emerald-300 hover:bg-emerald-200';
    }
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "text-xs px-1.5 py-0 h-4 cursor-pointer transition-all duration-200 group/badge overflow-hidden",
        getColor(),
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        navigate(getPath());
      }}
    >
      <span className="flex items-center">
        {label}
        <ArrowRight className={cn(
          "h-3 transition-all duration-200 ease-out",
          // Initially hidden and takes no space
          "w-0 opacity-0 ml-0",
          // On hover: appears and takes space
          "group-hover/badge:w-3 group-hover/badge:opacity-100 group-hover/badge:ml-0.5"
        )} />
      </span>
    </Badge>
  );
}
