import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface NoteLinkedBadgeProps {
  type: 'task' | 'decision' | 'meeting';
  id: string;
  label: string;
  className?: string;
}

export function NoteLinkedBadge({ type, id, label, className }: NoteLinkedBadgeProps) {
  const navigate = useNavigate();
  
  const getPath = () => {
    switch (type) {
      case 'task': return `/tasks?id=${id}`;
      case 'decision': return `/mywork?tab=decisions&id=${id}`;
      case 'meeting': return `/meetings?id=${id}`;
    }
  };
  
  const getColor = () => {
    switch (type) {
      case 'task': 
        return 'text-blue-700 bg-blue-100 border-blue-300 hover:bg-blue-200 dark:text-blue-300 dark:bg-blue-900/50 dark:border-blue-700 dark:hover:bg-blue-800/50';
      case 'decision': 
        return 'text-purple-700 bg-purple-100 border-purple-300 hover:bg-purple-200 dark:text-purple-300 dark:bg-purple-900/50 dark:border-purple-700 dark:hover:bg-purple-800/50';
      case 'meeting': 
        return 'text-emerald-700 bg-emerald-100 border-emerald-300 hover:bg-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/50 dark:border-emerald-700 dark:hover:bg-emerald-800/50';
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
