import { Badge } from "@/components/ui/badge";
import { Check, X, MessageCircle, Star, Circle } from "lucide-react";
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
      <div className="text-sm font-medium">Vorschau:</div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const colorClasses = getColorClasses(option.color);
          return (
            <Badge
              key={option.key}
              variant="outline"
              className={`${colorClasses.textClass} ${colorClasses.borderClass}`}
            >
              {option.icon && getIcon(option.icon)}
              {!option.icon && <Circle className="h-3 w-3 mr-1" />}
              <span className="ml-1">{option.label || "..."}</span>
            </Badge>
          );
        })}
      </div>
    </div>
  );
};
