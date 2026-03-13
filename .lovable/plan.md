

# Kontakte-Seite: Seitenpanel und UI-Verbesserungen

## Übersicht

Die Kontakte-Seite wird grundlegend umstrukturiert: Ein festes Seitenpanel (links, zwischen Navigation und Kontaktliste) übernimmt Header-Elemente und dient als Container für die Kontakt-Detailansicht. Die Listenansicht wird optimiert.

## Änderungen

### 1. Neues Seitenpanel einführen

Neue Komponente `ContactsSidePanel.tsx` — ein festes, scrollbares Panel links neben der Kontaktliste.

**Standardinhalt (wenn kein Kontakt ausgewählt):**
- Titel "Kontakte & Organisationen" + Beschreibung
- "Neuer Kontakt"-Button (+ "Neuer Verteiler" im Verteiler-Tab)
- Tab-Buttons (Kontakte, Stakeholder, Netzwerk, Verteiler, Archiv)
- Suchfeld
- Tag-Filter-Anzeige
- **"Duplikate prüfen"-Button** (bisher nicht im UI eingebunden!)

**Detailansicht (wenn Kontakt ausgewählt):**
- Das bestehende `ContactDetailPanel` wird im Seitenpanel gerendert statt als eigene Spalte

### 2. Header-Bereinigung in ContactsView

Im Hauptbereich (rechts) verbleiben nur:
- Grid/Tabelle-Toggle
- Filter-Button
- Auswählen-Button
- Filter-Leiste (Typ, Kategorie) wenn aktiv

Titel, Tabs, Suche, "Neuer Kontakt" wandern ins Seitenpanel.

### 3. Verlorene Funktionen (Punkt 4)

`DuplicateContactsSheet` existiert, wird korrekt gerendert, aber **kein Button ruft `setIsDuplicateSheetOpen(true)` auf**. Lösung: Button "Duplikate prüfen" ins Seitenpanel aufnehmen.

### 4. Listenansicht: Spalten optimieren (Punkt 5)

- **Entfernen**: Spalten "Letzter Kontakt" und "Dokumente"
- **Name aufteilen**: Name-Spalte in "Vorname" und "Nachname" splitten (basierend auf erstem Leerzeichen)
- **Toggle**: Ein kleiner Schalter im Tabellenkopf (oder per User-Präferenz), um zwischen "Name (zusammen)" und "Vorname / Nachname (getrennt)" zu wechseln. Zustand wird im localStorage persistiert.

### 5. Anrede ohne Badge (Punkt 6)

In `ContactListTable.tsx` Zeile 80: `<Badge variant="outline">` durch einfachen `<span className="text-xs text-muted-foreground">` ersetzen.

### 6. Stern transparent (Punkt 7)

In `ContactListTable.tsx` Zeile 75: `bg-background` und `shadow-sm` aus den Stern-Button-Klassen entfernen. Gleiches in `ContactGridCard.tsx`.

### 7. Einheitliche Zeilenhöhe (Punkt 8)

- Tabellenzeilen bekommen eine feste Höhe (z.B. `h-12`)
- Inhalte werden mit `truncate`/`line-clamp-1` auf eine Zeile begrenzt
- Tags in der Name-Spalte werden inline statt als zweite Zeile dargestellt (oder bei Platzmangel ausgeblendet)
- Adresse, E-Mail, Telefon jeweils einzeilig mit Overflow-Ellipsis

### 8. Layout-Struktur

```text
┌──────────┬─────────────────────┬──────────────────────────┐
│          │   Side Panel        │   Kontaktliste           │
│  Nav     │   (~300px)          │   (flex-1)               │
│          │                     │                          │
│          │  Titel              │  [Grid|List] [Filter]    │
│          │  Tabs               │  [Auswählen]             │
│          │  Suche              │                          │
│          │  + Neuer Kontakt    │  ┌────────────────────┐  │
│          │  Duplikate prüfen   │  │ Kontaktliste/Grid  │  │
│          │                     │  │                    │  │
│          │  ─── oder ───       │  │                    │  │
│          │                     │  └────────────────────┘  │
│          │  ContactDetailPanel │                          │
│          │  (bei Auswahl)      │                          │
└──────────┴─────────────────────┴──────────────────────────┘
```

### 9. Verbesserungsvorschläge (Punkt 9)

Zusätzliche Verbesserungen, die ich bei der Analyse identifiziert habe:

- **Keyboard-Navigation**: Pfeiltasten zum Navigieren durch die Kontaktliste, Enter öffnet Detail
- **Kontakt-Schnellvorschau**: Hover-Card über Kontaktnamen in der Liste mit den wichtigsten Infos
- **Spalten-Konfiguration**: Nutzer können wählen, welche Spalten in der Listenansicht sichtbar sind
- **Sticky-Header für die Tabelle**: Tabellenkopf bleibt beim Scrollen sichtbar
- **Batch-Export**: Ausgewählte Kontakte als CSV/vCard exportieren (die Auswahl-Funktion existiert bereits)

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/components/ContactsView.tsx` | Layout umbauen, Header-Elemente entfernen, Seitenpanel einbinden |
| `src/components/contacts/ContactsSidePanel.tsx` | **Neu** — Seitenpanel mit Nav-Elementen und Detailansicht |
| `src/components/contacts/ContactListTable.tsx` | Spalten anpassen, Badge entfernen, Stern-Styling, Zeilenhöhe |
| `src/components/contacts/ContactGridCard.tsx` | Stern-Styling anpassen |

