

# Plan: Dashboard-Umbau "Meine Arbeit"

## Zusammenfassung

Das Dashboard im Tab "Meine Arbeit" wird neu strukturiert: Header mit Datum + Begruessung + Wetter oben, Aufgaben links, Termine + besondere Tage + wechselnde Begruessung + News rechts. KPI-Cards entfallen.

## Schritt 1: Build-Fehler beheben

Bevor das Dashboard umgebaut wird, muessen die bestehenden Build-Fehler gefixt werden:

- **`manage-tenant-user/index.ts`**: `supabaseAdmin` mit `as any` casten bei Aufrufen von `hasPlatformAdminAccess` und `logAdminAction`
- **`matrix-bot-handler/index.ts`**: Insert-Aufruf und `row`-Parameter mit expliziten Typen versehen (`as any` fuer den Supabase-Client, `row: any` im Filter)
- **`MyWorkCasesWorkspace.tsx`**: `intake_payload` mit `as any` casten, damit es zum `Json`-Typ passt
- **`useCaseItems.tsx`**: `insertData` mit `as any` casten beim `.insert()`-Aufruf

## Schritt 2: Dashboard-Layout umbauen (MyWorkView.tsx)

Aktuell (Zeilen 531-555):
```
grid-cols-2: DashboardGreetingSection | NewsWidget + Feedback-Card
```

Neu:
```
Zeile 1: Header-Zeile (volle Breite)
  - Links: "Freitag, 6. Maerz" (Tag + Datum, gross/fett) + Begruessung ("Guten Abend, Alexander")
  - Rechts: Wetter-Anzeige (Karlsruhe + Stuttgart inline, kompakt)

Zeile 2: Zwei-Spalten-Layout
  - Links: Aufgaben (bestehendes TasksSummary/Aufgabenliste aus DashboardGreetingSection - UNVERAENDERT)
  - Rechts:
    - Termine (heute/morgen) mit besonderen Tagen
    - Wechselnde Begruessung (rollenbasierte Zeile + kontextuelle Nachricht)
    - News (nur Titel + Quelle)
```

## Schritt 3: DashboardGreetingSection aufteilen

Die aktuelle `DashboardGreetingSection` ist ein Monolith, der Begruessung, Wetter, Aufgaben und Termine in einem Textblock rendert. Dieser wird aufgeteilt:

1. **Header-Bereich** (neues Element direkt in MyWorkView): Datum + Begruessung + Wetter-Kompaktanzeige
2. **Linke Spalte**: Nur der Aufgaben-Teil aus DashboardGreetingSection (Aufgabenstatus mit draggable Tasks) - Code wird extrahiert aber Logik/Darstellung bleibt identisch
3. **Rechte Spalte oben**: Termine-Sektion (aus DashboardGreetingSection extrahiert) + Special-Day-Hints + rollenbasierte/kontextuelle Begruessung
4. **Rechte Spalte unten**: NewsWidget, vereinfacht auf Titel + Quelle

## Schritt 4: NewsWidget vereinfachen

Im Dashboard-Kontext wird dem NewsWidget ein neuer `compact`-Prop uebergeben. Im Compact-Modus:
- Nur Titel + Quelle (Badge) anzeigen
- Beschreibung, Kategorie-Badge, Datum und Hover-Aktionen ausblenden
- Schlanker, wie im Mockup

## Betroffene Dateien

| Datei | Aenderung |
|---|---|
| `supabase/functions/manage-tenant-user/index.ts` | Type-Casts fuer supabaseAdmin |
| `supabase/functions/matrix-bot-handler/index.ts` | Type-Casts fuer insert + row |
| `src/components/my-work/MyWorkCasesWorkspace.tsx` | `as any` fuer intake_payload |
| `src/features/cases/items/hooks/useCaseItems.tsx` | `as any` fuer insertData |
| `src/components/MyWorkView.tsx` | Dashboard-Tab Layout komplett neu |
| `src/components/dashboard/DashboardGreetingSection.tsx` | Aufteilen in Teilkomponenten |
| `src/components/widgets/NewsWidget.tsx` | `compact`-Prop hinzufuegen |
| Neue Datei: `src/components/dashboard/DashboardHeader.tsx` | Datum + Begruessung + Wetter |
| Neue Datei: `src/components/dashboard/DashboardAppointments.tsx` | Termine + Special Days + Kontextbegruessung |

