import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DecisionTabId } from "@/hooks/useMyWorkSettings";

interface DecisionListToolbarProps {
  tabConfig: Record<DecisionTabId, { label: string; count: number }>;
  visibleDecisionTabs: DecisionTabId[];
}

export function DecisionListToolbar({ tabConfig, visibleDecisionTabs }: DecisionListToolbarProps) {
  return (
    <TabsList className="grid w-full h-8" style={{ gridTemplateColumns: `repeat(${Math.max(visibleDecisionTabs.length, 1)}, minmax(0, 1fr))` }}>
        {visibleDecisionTabs.map((tab) => {
          const hasItems = tabConfig[tab].count > 0;
          return (
            <TabsTrigger key={tab} value={tab} className="relative text-[10px] px-1">
              {tabConfig[tab].label}
              {tab === "for-me" && hasItems && (
                <span className="absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" aria-hidden />
              )}
            </TabsTrigger>
          );
        })}
    </TabsList>
  );
}
