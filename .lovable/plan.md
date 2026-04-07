

# Redaktion: Kalenderansicht nach Planable-Vorbild umbauen

## Uebersicht

Die aktuelle Kalenderansicht nutzt `react-big-calendar` mit Uhrzeiten-Raster. Das Ziel ist ein Planable-aehnliches Grid-Layout: Tagesfelder ohne Uhrzeiten, Post-Karten mit Vorschaubild, Social-Media-Icons pro Kanal, und eine Notiz-Funktion direkt im Kalender.

## Schritt 1: Kalender-Layout (Woche + Monat) ohne Uhrzeiten

### Neues Custom-Grid statt react-big-calendar

`react-big-calendar` ist auf Zeitraster ausgelegt — das laesst sich nicht sinnvoll in ein uhrzeitloses Tagesfeld-Layout umbiegen. Stattdessen wird eine eigene Grid-Komponente gebaut.

**Neue Datei `src/features/redaktion/components/PlannerCalendarGrid.tsx`**:
- Gemeinsame Komponente fuer Wochen- und Monatsansicht
- **Wochenansicht**: 7-Spalten-Grid (Mo–So), eine Zeile, Header mit Wochentag + Datum (wie im Screenshot: `Mon 6`, `Tue 7`, heute rot hervorgehoben)
- **Monatsansicht**: 7-Spalten-Grid, 4–6 Zeilen je nach Monat, Tageszahl oben rechts in jeder Zelle, KW-Nummer am linken Rand
- Jede Zelle ist ein scrollbarer Container, der die Post-Karten vertikal stapelt
- Drag-and-Drop zum Umplanen bleibt erhalten (via `@hello-pangea/dnd` — bereits installiert)
- Klick auf leere Zelle oeffnet den Erstellungsdialog (bestehende `onCreateAtSlot`-Logik)

**Anpassung `Kalenderansicht.tsx`**:
- `react-big-calendar` und `DragAndDropCalendar` werden durch `PlannerCalendarGrid` ersetzt
- Header-Toolbar (Heute/Zurueck/Weiter, Woche/Monat-Toggle, Formatfilter) bleibt bestehen
- Die CSS-Klassen fuer `social-planner-calendar` in `react-big-calendar.css` koennen entfernt werden

### Layout-Details (aus den Screenshots abgeleitet)

```text
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│  Mon 6   │  Tue 7   │  Wed 8   │  Thu 9   │  Fri 10  │  Sat 11  │  Sun 12  │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ [Card]   │ [Card]   │ [Card]   │          │ [Card]   │          │          │
│ [Card]   │          │          │          │          │          │          │
│ [Card]   │          │          │          │          │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

- Monatsansicht: Zellen haben `min-height: 120px`, vertikaler Scroll bei Ueberlauf
- Wochenansicht: Zellen nutzen `min-height: calc(100vh - 250px)` fuer volle Hoehe

## Schritt 2: Post-Karten mit Bild und Social-Media-Icons

### Neue Komponente `PlannerPostCard.tsx`

Jede Karte zeigt:
1. **Header-Zeile**: Social-Media-Icons (links) + Status-Badge + Uhrzeit (rechts)
2. **Vorschaubild**: Wenn vorhanden, als kompaktes Thumbnail (aspect-ratio, abgerundete Ecken)
3. **Titel** (topic, fett)
4. **Text-Vorschau** (draft_text, 1–2 Zeilen, abgeschnitten)
5. **Approval-Badge** (z.B. gruener "Approved"-Badge, wenn `approval_state === 'approved'`)

### Social-Media-Icons

Mapping von Channel-Slug zu Icon (als kleine SVG-Icons oder Emoji-Badges):
- `instagram` → Instagram-Icon
- `facebook` → Facebook-Icon
- `x` → X/Twitter-Icon
- `linkedin` → LinkedIn-Icon
- `newsletter` → Mail-Icon
- `tiktok` → TikTok-Icon (fuer Zukunft)

Die Icons werden nebeneinander in der Karten-Kopfzeile angezeigt, genau wie im Screenshot. Dazu muss der Hook die Channel-Slugs zusaetzlich zu den Namen zurueckgeben (derzeit nur `channel_names`, `channel_ids`).

**Anpassung `useSocialPlannerItems.ts`**: Zusaetzlich `channel_slugs: string[]` im `SocialPlannerItem`-Interface, befuellt aus den Join-Daten.

### Bild-Unterstuetzung

Die DB hat noch kein `image_url`-Feld. Es wird eine Migration erstellt:
- `ALTER TABLE social_content_items ADD COLUMN image_url text;`
- Im Edit-Dialog wird ein Bild-Upload-Feld ergaenzt (Supabase Storage)
- Die Post-Karte zeigt das Bild als Thumbnail an

## Schritt 3: Notizen im Kalender

Wie im Screenshot sichtbar (gelbe/bunte Sticky-Notes neben Posts):

### Neue Tabelle `social_planner_notes`
```sql
CREATE TABLE social_planner_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) NOT NULL,
  note_date date NOT NULL,
  content text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'yellow',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### UI-Integration
- Jede Tageszelle bekommt einen "+"-Button (erscheint on hover), der ein Popover mit Farbauswahl und Textfeld oeffnet
- Bestehende Notizen werden als kleine farbige Karten in der Zelle angezeigt
- Farben: yellow, orange, pink, purple, blue, green (wie im Screenshot)
- Inline-Editing per Klick auf die Notiz

## Betroffene Dateien

| Datei | Aenderung |
|---|---|
| `src/features/redaktion/components/PlannerCalendarGrid.tsx` | Neu: Custom Grid-Kalender |
| `src/features/redaktion/components/PlannerPostCard.tsx` | Neu: Post-Karte mit Bild/Icons |
| `src/features/redaktion/components/PlannerNoteCard.tsx` | Neu: Sticky-Note Komponente |
| `src/features/redaktion/components/Kalenderansicht.tsx` | Umbau: react-big-calendar ersetzen |
| `src/features/redaktion/hooks/useSocialPlannerItems.ts` | Erweitern: channel_slugs, image_url |
| `src/features/redaktion/hooks/usePlannerNotes.ts` | Neu: CRUD fuer Notizen |
| Migration: `add_image_url_to_social_content_items` | Neue Spalte |
| Migration: `create_social_planner_notes` | Neue Tabelle |
| `src/styles/react-big-calendar.css` | Social-Planner-Abschnitt entfernen |

