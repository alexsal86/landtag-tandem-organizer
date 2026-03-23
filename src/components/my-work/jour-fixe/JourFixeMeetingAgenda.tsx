import { List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgendaItem } from "@/hooks/useMyWorkJourFixeSystemData";
import type { JourFixeAgendaData, JourFixeSystemDataMaps } from "./types";
import { getSystemEntries, getSystemItemIcon } from "./utils";

interface JourFixeMeetingAgendaProps {
  agenda: JourFixeAgendaData;
  systemData: JourFixeSystemDataMaps;
}

const AgendaSystemEntries = ({ entries }: { entries: ReturnType<typeof getSystemEntries> }) => {
  if (entries.length === 0) return null;

  return (
    <ul className="ml-6 mt-1 space-y-1">
      {entries.map((entry, entryIndex) => (
        <li key={entry.id} className="text-muted-foreground rounded bg-muted/40 px-2 py-1">
          <div className="flex items-center gap-1">
            <span className="min-w-[0.5rem] text-[11px] font-medium text-foreground/70">{String.fromCharCode(97 + entryIndex)})</span>
            {entry.icon}
            <span className="text-foreground">{entry.label}</span>
            {entry.ownerLabel && <span className="text-muted-foreground/80">({entry.ownerLabel})</span>}
          </div>
        </li>
      ))}
    </ul>
  );
};

const AgendaItemRow = ({
  item,
  numbering,
  agenda,
  systemData,
}: {
  item: AgendaItem;
  numbering: string;
  agenda: JourFixeAgendaData;
  systemData: JourFixeSystemDataMaps;
}) => {
  const childItems = agenda.items
    .filter((subItem) => subItem.parent_id === item.id)
    .sort((a, b) => a.order_index - b.order_index);
  const systemEntries = getSystemEntries({
    systemType: item.system_type,
    notes: agenda.notes,
    tasks: agenda.tasks,
    decisions: agenda.decisions,
    birthdays: agenda.birthdays,
    caseItems: agenda.caseItems,
    userProfiles: systemData.userProfiles,
  });

  return (
    <li className="text-xs">
      <div className="flex items-start gap-1">
        <span className="text-muted-foreground font-medium min-w-[0.5rem]">{numbering}</span>
        {getSystemItemIcon(item.system_type)}
        <span className={cn("text-foreground", item.system_type && "font-medium")}>{item.title}</span>
      </div>
      <AgendaSystemEntries entries={systemEntries} />
      {childItems.length > 0 && (
        <ul className="ml-[0.8rem] mt-1 space-y-0.5">
          {childItems.map((childItem, childIndex) => (
            <AgendaItemRow
              key={childItem.id}
              item={childItem}
              numbering={`${numbering}.${childIndex + 1}`}
              agenda={agenda}
              systemData={systemData}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export function JourFixeMeetingAgenda({ agenda, systemData }: JourFixeMeetingAgendaProps) {
  const mainItems = agenda.items
    .filter((item) => !item.parent_id)
    .sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="border-t bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <List className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Tagesordnung</span>
      </div>

      {agenda.loading ? (
        <div className="space-y-1.5">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-4 bg-muted animate-pulse rounded w-3/4" />
          ))}
        </div>
      ) : mainItems.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Keine Agenda-Punkte vorhanden</p>
      ) : (
        <ul className="ml-[18px] space-y-1.5">
          {mainItems.map((item, index) => (
            <AgendaItemRow
              key={item.id}
              item={item}
              numbering={`${index + 1}.`}
              agenda={agenda}
              systemData={systemData}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
