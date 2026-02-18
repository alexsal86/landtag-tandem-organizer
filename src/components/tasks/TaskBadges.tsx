import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TaskBadgesProps {
  priority: string;
  status: string;
  category?: string;
  assignedTo?: string | null;
  assigneeName?: string;
  isHovered?: boolean;
  className?: string;
}

const priorityConfig = {
  high: { color: "bg-red-500", label: "Hoch", textColor: "text-red-600", borderColor: "border-red-300", bgLight: "bg-red-50 dark:bg-red-900/30" },
  medium: { color: "bg-orange-500", label: "Mittel", textColor: "text-orange-600", borderColor: "border-orange-300", bgLight: "bg-orange-50 dark:bg-orange-900/30" },
  low: { color: "bg-green-500", label: "Niedrig", textColor: "text-green-600", borderColor: "border-green-300", bgLight: "bg-green-50 dark:bg-green-900/30" },
};

const statusConfig = {
  todo: { color: "bg-gray-500", label: "Offen", textColor: "text-gray-600", borderColor: "border-gray-300", bgLight: "bg-gray-50 dark:bg-gray-900/30" },
  "in-progress": { color: "bg-blue-500", label: "In Arbeit", textColor: "text-blue-600", borderColor: "border-blue-300", bgLight: "bg-blue-50 dark:bg-blue-900/30" },
  completed: { color: "bg-green-500", label: "Erledigt", textColor: "text-green-600", borderColor: "border-green-300", bgLight: "bg-green-50 dark:bg-green-900/30" },
};

export function TaskBadges({ 
  priority, 
  status, 
  category, 
  assignedTo, 
  assigneeName,
  isHovered = false,
  className 
}: TaskBadgesProps) {
  const priorityCfg = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.low;
  const statusCfg = statusConfig[status as keyof typeof statusConfig] || statusConfig.todo;

  // Small squares view (default)
  if (!isHovered) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <div className={cn("w-1.5 h-1.5 rounded-sm", priorityCfg.color)} title={`Priorität: ${priorityCfg.label}`} />
        <div className={cn("w-1.5 h-1.5 rounded-sm", statusCfg.color)} title={`Status: ${statusCfg.label}`} />
        {category && (
          <div className="w-1.5 h-1.5 rounded-sm bg-violet-500" title={`Kategorie: ${category}`} />
        )}
        {assignedTo && (
          <div
            className="w-1.5 h-1.5 rounded-sm bg-cyan-500"
            title={assigneeName ? `Zugewiesen an ${assigneeName}` : "Zugewiesen"}
          />
        )}
      </div>
    );
  }

  // Full badges view (on hover)
  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs px-1.5 py-0 h-4 cursor-help",
                priorityCfg.textColor, 
                priorityCfg.borderColor, 
                priorityCfg.bgLight
              )}
            >
              {priorityCfg.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Priorität</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs px-1.5 py-0 h-4 cursor-help",
                statusCfg.textColor, 
                statusCfg.borderColor, 
                statusCfg.bgLight
              )}
            >
              {statusCfg.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Status</TooltipContent>
        </Tooltip>

        {category && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className="text-xs px-1.5 py-0 h-4 cursor-help text-violet-600 border-violet-300 bg-violet-50 dark:bg-violet-900/30"
              >
                {category}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Kategorie</TooltipContent>
          </Tooltip>
        )}

        {assignedTo && assigneeName && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className="text-xs px-1.5 py-0 h-4 cursor-help text-cyan-600 border-cyan-300 bg-cyan-50 dark:bg-cyan-900/30"
              >
                {assigneeName.split(',')[0].trim().split(' ')[0]}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Zugewiesen an {assigneeName}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
