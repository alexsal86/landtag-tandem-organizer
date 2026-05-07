## Ziel

Aktuell gibt es nur ein freies Textfeld `facts_figures` und unstrukturierte `key_topic_items.background`. Wir bauen eine **strukturierte Fakten-Liste** im Stil des Screenshots (kompakte, einzeilige Fakten mit dezenten Trennlinien), die einzelnen **Gesprächspartnern oder Themen zugeordnet** werden kann.

## UI-Konzept

Im Bereich **„Fakten" (Phase Fakten)** und sekundär in der Sprechzettel-Briefing-Ansicht erscheint eine Karte `# FAKTEN` mit:

```text
# FAKTEN
─────────────────────────────────────────
BW: 197 Krankenhäuser · 56.300 Betten · 4,1 Mio. Fälle
─────────────────────────────────────────
Investitionsstau: 2,3 Mrd. EUR · KHG-Quote BW: 7,1 %
─────────────────────────────────────────
[+ Fakt hinzufügen]
```

Jeder Fakt-Eintrag besteht aus:
- **Text** (einzeilig, kompakt — max. ~140 Zeichen empfohlen)
- **Optionale Quelle** (kleine Caption rechts: „RWI 2025", „BWKG-Schätzung")
- **Zuordnung** via Chip-Picker:
  - „Allgemein" (Standard)
  - 1 Gesprächspartner aus `conversation_partners`
  - 1 Thema aus `key_topic_items`

In der Liste werden die Fakten standardmäßig nach Zuordnung gruppiert (Allgemein zuerst, dann pro Partner / Thema), mit kleiner Section-Label-Überschrift. Filter-Chips oben („Alle · Allgemein · Partner · Themen") zum schnellen Eingrenzen.

In der **Themen-Phase** und im **Gesprächspartner-Block** wird zusätzlich pro Item ein dezenter Hinweis „3 Fakten verknüpft" mit Inline-Aufklapper angezeigt — so sind Fakten dort sichtbar, wo sie gebraucht werden, ohne doppelte Pflege.

## Datenmodell

Neues Feld `structured_facts` in `preparation_data` (JSONB, kein DB-Migrations-Aufwand, da Spalte schon existiert):

```ts
type StructuredFact = {
  id: string;            // crypto.randomUUID()
  text: string;
  source?: string;       // optional, z.B. "RWI 2025"
  link_type: 'general' | 'partner' | 'topic';
  link_id?: string;      // partner.id oder topic.id, leer bei 'general'
};
```

Migration alter Daten: `facts_figures` (Free-Text) bleibt bestehen, wird aber im UI nicht mehr aktiv angeboten — beim ersten Öffnen wird ein dezenter Hinweis „Alte Fakten als strukturierte Liste übernehmen?" mit One-Click-Import (Split per Zeile) angezeigt.

## Komponenten

Neue Datei `src/components/appointment-preparations/workflow/StructuredFactsPanel.tsx`:
- Liste mit Inline-Edit (Text, Quelle, Zuordnungs-Chip)
- Drag-Reorder (dnd-kit, bereits im Projekt vorhanden)
- Gruppierung + Filter-Chips
- Empty-State mit Beispiel-Hinweis

Erweiterungen:
- `appointment-preparation-data/types.ts`: Type `StructuredFact` exportieren.
- `PhaseContent.tsx`: `<StructuredFactsPanel>` in Phase **Fakten** einbinden (ersetzt im UI das alte `facts_figures`-Textfeld).
- `PreparationDataCards.tsx`: Pro Topic-Card kleinen Counter „N Fakten" + Aufklapper (read-only Liste der zugeordneten Fakten).
- `gespraechspartner`-Block (in `AppointmentPreparationDataTab.tsx`): selbe Counter-Anzeige pro Partner-Card.
- `AppointmentBriefingView.tsx`: Sprechzettel rendert die Fakten-Karte links (wie im Screenshot) statt des Free-Text-Blocks.

## Out of Scope

- Keine DB-Migration (alles in bestehender JSONB-Spalte).
- Kein Cross-Preparation-Faktenpool (jede Vorbereitung hält eigene Fakten — Knowledge-Dossier-Verlinkung folgt ggf. separat).
- Keine Änderung am Druck-/PDF-Export.

## Risiko

Niedrig — additives Feld in `preparation_data`, alte Daten bleiben unangetastet, Free-Text-Fallback weiterhin lesbar.
