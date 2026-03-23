import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StandaloneDecisionCreator } from "@/components/task-decisions/StandaloneDecisionCreator";
import { Search, Settings2 } from "lucide-react";
import { DecisionTabId } from "@/hooks/useMyWorkSettings";

interface DecisionListToolbarProps {
  isCreateOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  onDecisionCreated: () => void;
  onOpenDefaultParticipants: () => void;
  onSearchChange: (value: string) => void;
  searchQuery: string;
  tabConfig: Record<DecisionTabId, { label: string; count: number }>;
  visibleDecisionTabs: DecisionTabId[];
}

export function DecisionListToolbar({ isCreateOpen, onCreateOpenChange, onDecisionCreated, onOpenDefaultParticipants, onSearchChange, searchQuery, tabConfig, visibleDecisionTabs }: DecisionListToolbarProps) {
  return (
    <div className="space-y-3">
      <TabsList className="grid w-full h-8" style={{ gridTemplateColumns: `repeat(${Math.max(visibleDecisionTabs.length, 1)}, minmax(0, 1fr))` }}>
        {visibleDecisionTabs.map((tab) => (
          <TabsTrigger key={tab} value={tab} className="text-[10px] px-1">
            {tabConfig[tab].label}
            {tab === "for-me" && tabConfig[tab].count > 0 ? <Badge variant="destructive" className="ml-1 text-[9px] px-1 py-0 h-4">{tabConfig[tab].count}</Badge> : tab !== "for-me" ? ` (${tabConfig[tab].count})` : null}
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Suchen..." value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} className="pl-8 h-8 text-xs" />
        </div>
        <StandaloneDecisionCreator isOpen={isCreateOpen} onOpenChange={onCreateOpenChange} onDecisionCreated={onDecisionCreated} />
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onOpenDefaultParticipants} title="Standard-Teilnehmer"><Settings2 className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}
