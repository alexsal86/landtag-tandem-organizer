

# Interaktions-Bereich umstrukturieren

## Was sich ändert

Die rechte Spalte des Vorgangs-Detailpanels wird umgebaut: Statt Buttons horizontal oben und Eingabefelder darunter wird ein **horizontales 2-Spalten-Layout** innerhalb des Interaktions-Bereichs erstellt.

### Neues Layout

```text
┌──────────────┬──────────────────────────────────┐
│  [Sachlage]  │  Betreff-Input                   │
│              │  Beschreibung (RichText)          │
│  ─ ─ ─ ─ ─  │                                   │
│  [Anruf]     ├──────────────────────────────────┤
│  [Mail]      │  (Felder der gewählten           │
│  [Treffen]   │   Interaktion, z.B. Kontakt,     │
│  [Dokument]  │   Datum, Notiz)                  │
│  [Notiz]     │                                   │
│  [Entscheid.]│                                   │
└──────────────┴──────────────────────────────────┘
```

- **"Sachlage"** ist ein neuer Button (Icon: `FileEdit`) der Betreff + Beschreibung zeigt
- Sachlage ist **standardmäßig ausgewählt** beim Öffnen des Vorgangs
- Die restlichen Interaktions-Buttons (Anruf, Mail, etc.) kommen mit **Abstand** (z.B. `mt-3` + Trennlinie) darunter
- Buttons sind vertikal gestapelt (`flex-col`) in der linken Spalte
- Die rechte Seite zeigt die Eingabefelder des jeweils ausgewählten Buttons

### Zustand-Logik

- Neuer State: `activeSection: 'sachlage' | TimelineInteractionType | 'entscheidung'`, Default `'sachlage'`
- Wenn "Sachlage" gewählt → rechts Betreff + Beschreibung anzeigen
- Wenn ein Interaktionstyp gewählt → rechts die bisherigen Composer-Felder anzeigen
- `showInteractionComposer` wird ersetzt durch die Prüfung `activeSection !== 'sachlage'`

### Betroffene Datei

Nur `src/components/my-work/CaseItemDetailPanel.tsx` (Zeilen 765-861):
- Buttons von `flex-wrap` horizontal → `flex-col` vertikal
- "Sachlage"-Button als erstes Element mit Separator
- Grid-Layout `grid-cols-[auto_1fr]` um Buttons und Inhalt nebeneinander zu setzen
- Betreff/Beschreibung-Felder (Zeilen 848-861) in die "Sachlage"-Ansicht verschieben (nicht mehr separat darunter)

