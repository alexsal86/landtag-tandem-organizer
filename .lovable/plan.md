## Ziel

Den bestehenden Detailbildschirm der Terminvorbereitung (`/appointment-preparation/:id`) auf das vorgeschlagene Design umstellen — kompakter Header, schlankere Tabs und ein 3-Spalten-Workspace mit Live-Vorschau. **Reife-Score/Reife-Bar und Mini-ID-Schema werden bewusst weggelassen.**

---

## Step 1 — Header & Tabs

**Datei:** `src/pages/AppointmentPreparationDetail.tsx`

### Header (ersetzt aktuelle Card 220–292)

Zweispaltiges Layout, deutlich kompakter:

```text
┌────────────────────────────────────────────────────────────────────┐
│ [Notebook] Titel des Termins                          [Status-Pill]│
│ Meta-Zeile: 📅 Mi., 12. Mai 2026 · 🕒 09:00–10:30 · 📍 Ort         │
│ [Termindetails öffnen ↗]                  Zuletzt bearbeitet: …    │
│                                           [PDF] [Live-Briefing]    │
└────────────────────────────────────────────────────────────────────┘
```

- Einzeiler-Titel, Status als Pill rechts oben.
- Meta-Daten (Datum, Uhrzeit, Ort) als **inline-Zeile mit Icons + Trennpunkten**, nicht mehr als drei separate Tiles.
- Rechte Infobox enthält nur „Zuletzt bearbeitet" + die zwei CTAs (PDF herunterladen, Live-Briefing). Die CTAs wandern aus dem Briefing-Tab hoch in den Header und sind kontextunabhängig sichtbar.
- **Keine Reife-Bar, keine Mini-ID, kein Countdown.**

### Tabs (ersetzt 295–317)

- Icons entfernen, schlankerer `TabsList`.
- Counter an den Tabs, sofern sinnvoll abzuleiten:
  - „Checkliste (3/7)" → aus `preparation.checklist_items`
  - „Dokumente (n)" → optional via einfacher Count-Query (nice-to-have, sonst weglassen)
- Reihenfolge bleibt: Briefing · Vorbereitung · Checkliste · Details · Dokumente.

---

## Step 2 — Layout & Modularisierung des Vorbereitungs-Tabs

**Datei:** `src/components/appointment-preparations/AppointmentPreparationDataTab.tsx` (aktuell 620 Zeilen)

### Neues Layout (ersetzt 412–619)

3-Spalten-Workspace ab `xl`:

```text
┌───────────────────┬───────────────────┬─────────────────────────┐
│ Linke Spalte (4)  │ Mittelspalte (5)  │ Live-Vorschau (3) sticky│
│                   │                   │                         │
│ • Anlass          │ • Programm        │ Briefing-Card-Vorschau  │
│ • Gesprächspartner│ • Q&A             │ (gleiche Komponente wie │
│ • Begleitpersonen │ • Key Topics      │ AppointmentBriefingView,│
│ • Logistik        │ • Talking Points  │ kompakt skaliert)       │
│ • Öffentlichkeit  │                   │                         │
└───────────────────┴───────────────────┴─────────────────────────┘
```

- Unterhalb `xl` Fallback auf das bestehende 2-Spalten-Grid (responsive bleibt erhalten).
- Live-Vorschau ist `sticky top-20`, scrollt mit, zeigt den aktuellen `preparation`/`editData`-State.
- Die bestehenden Sub-Komponenten (`ConversationPartnersCard`, `CompanionsCard`, `ProgramCard`, `PreparationDataCards`) bleiben unverändert und werden lediglich neu in den Spalten platziert.
- **Keine Reife-Bar, kein Reife-Score.**

### Header des Vorbereitungstabs (415–430)

Wird zurückgebaut: nur noch dezente „Speichert…"-Anzeige bleibt — Titel und Status sind ja bereits im Seiten-Header (Step 1) sichtbar. Vermeidet Doppelung.

### Vorbereitung Submodule (kein Refactor jetzt)

Eine weitere Zerlegung in `PartnersSection`, `OccasionSection` etc. ist **nicht** Teil dieses Plans, da das Datei-Volumen durch das reine Re-Layout nicht weiter wächst. Falls die Datei nach den Änderungen >1500 Zeilen überschreitet, wird das in einem Folgeschritt nachgezogen (siehe Memory: Component decomposition).

---

## Bewusst NICHT enthalten

- Reife-Bar / Reife-Score (auf beiden Steps).
- Mini-ID-Schema (`TV-2026-018`) — würde DB-Sequenz benötigen.
- Countdown bis zum Termin.
- Änderungen an `AppointmentBriefingView` selbst (wird nur im Preview-Pane wiederverwendet).

---

## Betroffene Dateien

- `src/pages/AppointmentPreparationDetail.tsx` (Header, Tabs, CTAs nach oben)
- `src/components/appointment-preparations/AppointmentPreparationDataTab.tsx` (3-Spalten-Workspace, Header zurückbauen, Live-Preview einbauen)

Keine DB-Migration, keine neuen Hooks, keine Änderungen am `useAppointmentPreparation`-Hook.
