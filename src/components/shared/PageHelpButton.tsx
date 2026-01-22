import { HelpCircle } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface PageHelpButtonProps {
  title: string;
  description: string;
  features?: string[];
}

export function PageHelpButton({ title, description, features }: PageHelpButtonProps) {
  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        <button 
          className="h-8 w-8 rounded-full border bg-background flex items-center justify-center hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          aria-label="Hilfe anzeigen"
        >
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-80">
        <div className="space-y-2">
          <h4 className="font-semibold text-foreground">{title}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
          {features && features.length > 0 && (
            <ul className="text-sm space-y-1 mt-3">
              {features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
