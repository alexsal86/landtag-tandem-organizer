import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus } from "lucide-react";
import { SYSTEM_AGENDA_OPTIONS } from "../systemAgendaRegistry";
import type { AgendaItem, SystemAgendaType } from "../types";
export function AddAgendaMenu({
  agendaItems,
  onAdd,
  onAddSystem,
}: {
  agendaItems: AgendaItem[];
  onAdd: () => void;
  onAddSystem: (type: SystemAgendaType) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="bg-card">
          <Plus className="h-4 w-4 mr-2" />
          Hinzufügen
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-96 overflow-auto">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={onAdd}
        >
          <Plus className="h-4 w-4 mr-2" />
          Eigener Punkt
        </Button>
        <p className="text-xs text-muted-foreground px-3 py-2">
          System · Automatische Bausteine
        </p>
        {SYSTEM_AGENDA_OPTIONS.map(({ type, label, Icon }) => {
          const exists = agendaItems.some((item) => item.system_type === type);
          return (
            <Button
              key={type}
              variant="ghost"
              className="w-full justify-start text-left h-auto whitespace-normal"
              disabled={exists}
              onClick={() => onAddSystem(type)}
            >
              <Icon className="h-4 w-4 mr-2 shrink-0" />
              <span>
                {label}
                {exists && <span className="text-xs ml-2">bereits drin</span>}
              </span>
            </Button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
