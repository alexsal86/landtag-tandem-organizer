import { Badge } from "@/components/ui/badge";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DecisionTabId } from "@/hooks/useMyWorkSettings";

interface DecisionListToolbarProps {
  tabConfig: Record<DecisionTabId, { label: string; count: number }>;
  visibleDecisionTabs: DecisionTabId[];
}

export function DecisionListToolbar({ tabConfig, visibleDecisionTabs }: DecisionListToolbarProps) {
  return (
    <TabsList className="grid w-full h-8" style={{ gridTemplateColumns: `repeat(${Math.max(visibleDecisionTabs.length, 1)}, minmax(0, 1fr))` }}>
        {visibleDecisionTabs.map((tab) => (
          <TabsTrigger key={tab} value={tab} className="text-[10px] px-1">
            {tabConfig[tab].label}
            {tab === "for-me" && tabConfig[tab].count > 0 ? <Badge variant="destructive" className="ml-1 text-[9px] px-1 py-0 h-4">{tabConfig[tab].count}</Badge> : tab !== "for-me" ? ` (${tabConfig[tab].count})` : null}
          </TabsTrigger>
        ))}
    </TabsList>
  );
}
