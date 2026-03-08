

## Plan: Kontaktsuche im Vorgangs-Detailpanel (Von/Gesprächspartner)

### Ist-Zustand
Im **CaseItemDetailPanel** sind die Felder "Von / Gesprächspartner" einfache `Input`-Felder (Name + E-Mail/Telefon als Freitexte). Bei Erstellung (`CaseItemCreateDialog`) gibt es dagegen eine Kontaktsuche mit Dropdown, die aus der `contacts`-Tabelle sucht und E-Mail/Telefon automatisch ausfüllt.

### Änderungen

**1. `EditableCaseItem` erweitern** (`useCaseItemEdit.ts`)
- Neues Feld `selectedContactId: string | null` hinzufügen, um eine Kontaktverknüpfung beim Bearbeiten zu tracken.

**2. `CaseItemDetailPanel` umbauen** (`CaseItemDetailPanel.tsx`)
- Das "Name"-Input durch eine Kontaktsuche ersetzen (gleiche Logik wie im CreateDialog: ab 2 Zeichen in `contacts` suchen, Dropdown mit Ergebnissen anzeigen).
- Bei Auswahl eines Kontakts: Name, E-Mail und Telefon automatisch befüllen.
- **E-Mail und Telefon als separate Felder** anzeigen (statt eines kombinierten "E-Mail / Telefon"-Feldes) — analog zum CreateDialog.
- Kontaktinfo (Organisation, E-Mail, Telefon) im Suchergebnis-Dropdown anzeigen.
- "Kontakt verknüpft"-Hinweis anzeigen, wenn ein Kontakt aus der Suche gewählt wurde.

**3. Props-Anpassung** (`CaseItemDetailPanel.tsx`)
- `contactPerson: string` und `onContactPersonChange` werden erweitert um `contactEmail`, `contactPhone`, `selectedContactId`, und deren Change-Handler — oder alternativ wird die gesamte Kontaktlogik intern im Panel verwaltet und nur beim Save nach oben gegeben.
- Pragmatischerer Ansatz: Die Kontaktsuche und -selektion direkt im `CaseItemDetailPanel` implementieren (analog zum CreateDialog), und `onContactPersonChange` so aufrufen, dass Name, E-Mail und Telefon korrekt im `contactPerson`-String kodiert werden.

**4. Save-Logik erweitern** (`MyWorkCasesWorkspace.tsx`)
- Beim Speichern zusätzlich `contact_id` und `reporter_name`/`reporter_contact` im Update-Patch setzen (aktuell wird nur `intake_payload` geschrieben, `contact_id` wird ignoriert).
- `intake_payload` um `contact_email`, `contact_phone`, `matched_contact_id` erweitern (wie beim Create).

### Technische Details
- Kontaktsuche: Supabase-Query auf `contacts`-Tabelle mit `ilike` auf Name, gefiltert nach `tenant_id`, `neq contact_type archive`, Limit 8, 250ms Debounce.
- Die Suchlogik wird direkt im `CaseItemDetailPanel` implementiert (lokaler State für `searchResults`, `searchingContacts`, `showSearchResults`), da die Komponente bereits die nötige Komplexität kapselt.
- E-Mail und Telefon werden als zwei separate `Input`-Felder dargestellt, jeweils mit eigenem Label.

