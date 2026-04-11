import { ChevronDownIcon, ChevronRightIcon, PlusIcon, TrashIcon, UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Companion } from "./types";
import { COMPANION_TYPE_OPTIONS } from "./constants";

interface CompanionsCardProps {
  companions: Companion[];
  expandedSection: boolean;
  onToggleSection: () => void;
  onAdd: () => void;
  onUpdate: (idx: number, field: keyof Companion, value: string) => void;
  onRemove: (idx: number) => void;
}

export function CompanionsCard({
  companions,
  expandedSection,
  onToggleSection,
  onAdd,
  onUpdate,
  onRemove,
}: CompanionsCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Collapsible open={expandedSection} onOpenChange={onToggleSection}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <UsersIcon className="h-5 w-5 text-primary" />
              <h3 className="font-medium">Begleitpersonen</h3>
              {companions.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                  {companions.length}
                </span>
              )}
            </div>
            {expandedSection ? (
              <ChevronDownIcon className="h-4 w-4" />
            ) : (
              <ChevronRightIcon className="h-4 w-4" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-3">
            {companions.length === 0 && (
              <p className="text-sm text-muted-foreground px-1">Noch keine Begleitpersonen hinzugefügt.</p>
            )}
            {companions.map((companion, idx) => (
              <div key={companion.id} className="grid grid-cols-1 gap-2 items-start rounded-lg border bg-muted/20 p-3 md:grid-cols-[1fr_auto_1fr_auto]">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Name</label>
                  <Input
                    value={companion.name}
                    onChange={(e) => onUpdate(idx, 'name', e.target.value)}
                    placeholder="Name der Begleitperson"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Typ</label>
                  <Select value={companion.type} onValueChange={(v) => onUpdate(idx, 'type', v)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPANION_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Hinweis (optional)</label>
                  <Input
                    value={companion.note ?? ''}
                    onChange={(e) => onUpdate(idx, 'note', e.target.value)}
                    placeholder="z.B. Rolle, Funktion..."
                  />
                </div>
                <div className="pt-6">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(idx)}
                    className="text-destructive hover:text-destructive"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={onAdd} className="mt-2">
              <PlusIcon className="h-4 w-4 mr-2" />
              Begleitperson hinzufügen
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
