

## Verständnis der Anforderung

Der Nutzer möchte in "Vorgänge" eine **kombinierte Sortierung** implementieren:
1. **Primäre Sortierung**: Wie bisher (z.B. nach Datum, Status, Kategorie, etc.)
2. **Sekundäre Sortierung**: Zusätzlich nach Bearbeiter, falls die primären Werte gleich sind

**Beispiel**: Bei Sortierung nach "Eingang" (Datum) → Vorgänge mit gleichem Eingangsdatum werden zusätzlich alphabetisch nach Bearbeiter sortiert.

---

## Aktuelle Implementierung

**State & Logik** (`MyWorkCasesWorkspace.tsx`):
- `itemSort` State: `{ key: CaseItemSortKey; direction: SortDirection }`
- `sortedCaseItems` useMemo: Sortiert nach einem einzigen Kriterium
- Sortier-Buttons in Tabellenkopfzeile (Zeilen 989-1003)

**Begrenzung**: Nur **eine** aktive Sortierung gleichzeitig möglich.

---

## Lösungsansatz

### 1. State erweitern
```typescript
const [itemSort, setItemSort] = useState<{
  primary: { key: CaseItemSortKey; direction: SortDirection };
  secondary: { enabled: boolean; direction: SortDirection };
}>({
  primary: { key: "received", direction: "desc" },
  secondary: { enabled: false, direction: "asc" }
});
```

### 2. Sortierlogik anpassen
In `sortedCaseItems` useMemo:
- Erst nach primärem Kriterium sortieren
- Bei Gleichheit: Falls `secondary.enabled === true`, nach Bearbeiter (assignee) sortieren

```typescript
return [...filteredCaseItems].sort((a, b) => {
  // Primäre Sortierung
  const primaryResult = comparePrimary(a, b);
  if (primaryResult !== 0) return primaryResult;
  
  // Sekundäre Sortierung (nur wenn aktiviert)
  if (itemSort.secondary.enabled) {
    const aAssignee = getAssigneeIds(a).map(...).join(", ");
    const bAssignee = getAssigneeIds(b).map(...).join(", ");
    return aAssignee.localeCompare(bAssignee) * secondaryFactor;
  }
  return 0;
});
```

### 3. UI-Komponente für sekundäre Sortierung
Zwei Optionen:

**Option A: Toggle-Button in Tabellenkopfzeile**
- Neben den "Bearbeiter"-Sortier-Buttons einen zusätzlichen Toggle-Button
- Text: "Als 2. Sortierung" oder Icon (z.B. `Link2` mit Tooltip)
- Zeigt visuell an, ob sekundäre Sortierung aktiv ist

**Option B: Dropdown-Menü**
- Oberhalb der Tabelle ein DropdownMenu "Sortierung"
- Zeigt primäre + optionale sekundäre Sortierung
- Checkbox "Nach Bearbeiter zusätzlich sortieren"

**Empfehlung**: Option A – kompakter, direkter in der Tabellenkopfzeile sichtbar

### 4. UI-Layout (Option A)
```tsx
<span className="group inline-flex items-center gap-0.5">
  Bearbeiter
  <button className={sortButtonClass("assignee", "asc")} ...>
    <ArrowUp />
  </button>
  <button className={sortButtonClass("assignee", "desc")} ...>
    <ArrowDown />
  </button>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "rounded p-0.5 ml-1 transition-all hover:bg-muted",
            itemSort.secondary.enabled && "bg-primary/15 text-primary"
          )}
          onClick={() => toggleSecondarySort()}
        >
          <Link2 className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        Als zweite Sortierung {itemSort.secondary.enabled ? "deaktivieren" : "aktivieren"}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</span>
```

### 5. Handler für sekundäre Sortierung
```typescript
const toggleSecondarySort = useCallback(() => {
  setItemSort((prev) => ({
    ...prev,
    secondary: {
      ...prev.secondary,
      enabled: !prev.secondary.enabled
    }
  }));
}, []);

const toggleSecondaryDirection = useCallback(() => {
  setItemSort((prev) => ({
    ...prev,
    secondary: {
      ...prev.secondary,
      direction: prev.secondary.direction === "asc" ? "desc" : "asc"
    }
  }));
}, []);
```

---

## Implementierungsschritte

1. **State erweitern**: `itemSort` zu verschachtelter Struktur ändern
2. **Sortierlogik aktualisieren**: Sekundäre Sortierung in `sortedCaseItems` einbauen
3. **UI-Buttons anpassen**: 
   - Alle `toggleSort`-Aufrufe auf `itemSort.primary` umstellen
   - `isSortActive` und `sortButtonClass` auf neue Struktur anpassen
4. **Toggle-Button hinzufügen**: In "Bearbeiter"-Spalte der Tabellenkopfzeile
5. **Visuelle Rückmeldung**: Aktive sekundäre Sortierung deutlich kennzeichnen (z.B. Badge mit "2. Sortierung: Bearbeiter A-Z")

---

## Offene Fragen

1. **Soll die sekundäre Sortierung immer "Bearbeiter" sein**, oder soll der Nutzer zwischen verschiedenen sekundären Kriterien wählen können?
   - Annahme: Zunächst nur "Bearbeiter" als feste sekundäre Sortierung
   
2. **Soll die Richtung (asc/desc) der sekundären Sortierung unabhängig einstellbar sein?**
   - Empfehlung: Ja, separate Auf/Ab-Buttons für sekundäre Sortierung

3. **Soll die sekundäre Sortierung beim Wechsel der primären Sortierung aktiv bleiben?**
   - Empfehlung: Ja, solange nicht explizit deaktiviert

---

## Technische Details

**Dateien zu ändern**:
- `src/components/my-work/MyWorkCasesWorkspace.tsx` (State, Logik, UI)

**Keine DB-Änderungen erforderlich** – reine Frontend-Sortierung

**Kompatibilität**: Funktioniert mit allen bestehenden Sortierkriterien

