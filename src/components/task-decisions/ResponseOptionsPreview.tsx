import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, X, MessageCircle, Star, Circle, Info } from "lucide-react";
import { ResponseOption, getColorClasses } from "@/lib/decisionTemplates";

interface ResponseOptionsPreviewProps {
  options: ResponseOption[];
}

const getIcon = (iconName?: string) => {
  switch (iconName) {
    case "check":
      return <Check className="h-3 w-3" />;
    case "x":
      return <X className="h-3 w-3" />;
    case "message-circle":
      return <MessageCircle className="h-3 w-3" />;
    case "star":
      return <Star className="h-3 w-3" />;
    default:
      return <Circle className="h-3 w-3" />;
  }
};

export const ResponseOptionsPreview = ({ options }: ResponseOptionsPreviewProps) => {
  if (!options || options.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const colorClasses = getColorClasses(option.color);
          const badge = (
            <Badge
              key={option.key}
              variant="outline"
              className={`${colorClasses.textClass} ${colorClasses.borderClass} ${option.recommended ? "ring-1 ring-amber-400/70" : ""}`}
            >
              {option.icon && getIcon(option.icon)}
              {!option.icon && <Circle className="h-3 w-3 mr-1" />}
              <span className="ml-1">{option.label || "..."}</span>
              {option.description && <Info className="h-2.5 w-2.5 ml-1 opacity-50" />}
              {option.recommended && (
                <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700">
                  Empfohlen
                </span>
              )}
            </Badge>
          );

          if (option.description || option.recommendation_reason) {
            return (
              <TooltipProvider key={option.key}>
                <Tooltip>
                  <TooltipTrigger asChild>{badge}</TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      {option.description && <p className="text-xs">{option.description}</p>}
                      {option.recommended && option.recommendation_reason && (
                        <p className="text-xs font-medium">Empfehlung: {option.recommendation_reason}</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }

          return badge;
        })}
      </div>
    </div>
  );
};
