

# Kontaktliste: Name + Organisation Layout umbauen

## Aenderungen an `src/components/contacts/ContactListTable.tsx`

### 1. Organisation unter den Namen setzen (Standard)
- Die separate "Organisation"-Spalte (`<SortableTableHead sortKey="organization">`) wird standardmaessig entfernt
- Stattdessen wird die Organisation als zweite Zeile unter dem Namen angezeigt (kleinerer, grauer Text), wie im Screenshot
- Der Name wird **fett** (`font-semibold`), die Organisation darunter in `text-xs text-muted-foreground`

### 2. Anrede-Toggle: Herr/Frau inline im Namen
- Die separate "Anrede"-Spalte wird entfernt
- Neuer localStorage-Toggle (`contacts-show-salutation`): Wenn aktiv, wird die Anrede direkt vor dem Namen angezeigt (z.B. "Herr Alexander Salomon")
- Toggle kommt in die bestehende Toggle-Zelle rechts (neben dem V/N-Toggle)

### 3. Organisation-Spalte per Toggle
- Neuer localStorage-Toggle (`contacts-org-column`): Wenn aktiv, wird die Organisation wieder als eigene Spalte angezeigt (wie bisher) statt unter dem Namen
- Beide Darstellungen schliessen sich gegenseitig aus — Org ist entweder unter dem Namen oder in eigener Spalte
- Toggle ebenfalls in der rechten Steuerungszelle

### 4. Toggle-Bereich (letzte Spalte im Header)
Die bestehende Toggle-Zelle wird erweitert mit drei kompakten Toggles:
- **V/N** — Vor-/Nachname aufteilen (bestehend)
- **Hr/Fr** — Anrede inline anzeigen
- **Org** — Organisation als eigene Spalte

### Betroffene Datei
- `src/components/contacts/ContactListTable.tsx`

