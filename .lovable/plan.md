

## Problem

In der MyWork Jour Fixe Ansicht (`MyWorkJourFixeTab.tsx`) fehlt die Unterstützung für den System-Typ `case_items` (Vorgänge) an drei Stellen:

1. **Kein Icon**: `getSystemItemIcon()` hat keinen Eintrag für `case_items` — daher wird kein Briefcase-Icon angezeigt
2. **Keine Daten geladen**: `meetingCaseItems` wird nicht aus dem Hook `useMyWorkJourFixeSystemData` destrukturiert
3. **Keine Untereinträge gerendert**: Es gibt keinen Rendering-Block für `item.system_type === 'case_items'` — weder für Haupt- noch für Unterpunkte
4. **Icon-Import fehlt**: `Briefcase` wird nicht importiert

## Änderungen in `src/components/my-work/MyWorkJourFixeTab.tsx`

1. **Import erweitern** (Zeile 8): `Briefcase` zu den Lucide-Imports hinzufügen

2. **Hook-Destrukturierung** (Zeile 34-42): `meetingCaseItems` aus `useMyWorkJourFixeSystemData` destrukturieren

3. **`getSystemItemIcon`** (Zeile 106-113): Eintrag für `case_items` hinzufügen:
   ```
   if (systemType === 'case_items') return <Briefcase className="h-3 w-3 text-teal-500" />;
   ```

4. **`MeetingItem`-Komponente** (Zeile 128-131): `meetingCaseItems` in die lokale Variable `caseItems` lesen

5. **Haupt-Agenda-Rendering** (nach Zeile 314, analog zu birthdays/decisions): Block für `item.system_type === 'case_items'` einfügen, der `caseItems` als Liste mit Briefcase-Icons rendert (Betreff + Status)

6. **Sub-Item-Rendering** (nach Zeile 380, analog zu sub-birthdays/sub-decisions): Gleichen Block für `subItem.system_type === 'case_items'` einfügen

