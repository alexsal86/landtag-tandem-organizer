
# Tageszettel: Stimmung beim Abschluss + Wochenroutine + Wochenplanung

## 1. "Wie war dein Tag?" nur beim Tagesabschluss anzeigen

**Aktuell:** Die Stimmungsabfrage (Emoji-Auswahl) ist permanent im Footer des Tageszettels sichtbar.

**Aenderung:** Die Stimmungsabfrage wird nur angezeigt, wenn `resolveMode === true` ist -- also genau dann, wenn der Benutzer auf "Tag abschliessen" klickt und die Triage (Zuweisung offener Punkte) durchlaeuft.

Konkret wird der Block (Zeilen 1640-1666) in `GlobalDaySlipPanel.tsx` mit `{resolveMode && (...)}` umschlossen. Die Stimmung wird also als letzter Schritt vor dem eigentlichen Abschluss abgefragt.

---

## 2. Wochenroutine in den Einstellungen

**Aktuell:** Die "Wiederkehrenden Punkte" sind eine einfache Liste mit Wochentag-Zuordnung (ein Punkt = ein Wochentag oder "Jeden Tag"). Das ist funktional, aber nicht uebersichtlich -- man sieht nicht auf einen Blick, wie die ganze Woche aussieht.

**Aenderung:** Die bestehende Einstellungs-Seite im Tageszettel wird um eine visuelle Wochenroutine-Ansicht erweitert:

### a) Wochenroutine-Raster

Oberhalb der bestehenden "Wiederkehrende Punkte"-Liste wird ein kompaktes Raster eingefuegt:

```text
+----------+----------+----------+----------+----------+
|  Montag  | Dienstag | Mittwoch |Donnerstag|  Freitag |
+----------+----------+----------+----------+----------+
| Inbox    | Inbox    | Inbox    | Inbox    | Inbox    |
| Team-JF  |          | Fokus-   |          | Wochen-  |
|          |          | block    |          | review   |
+----------+----------+----------+----------+----------+
```

- Jeder Wochentag ist eine Spalte
- Punkte mit "Jeden Tag" erscheinen in allen Spalten
- Tagesspezifische Punkte nur in ihrer Spalte
- Klick auf eine Spalte oeffnet einen Inline-Editor zum schnellen Hinzufuegen

### b) Datenstruktur

Die bestehende `RecurringTemplate`-Struktur wird wiederverwendet -- keine Aenderung am Datenmodell noetig. Die Wochenansicht ist nur eine andere Darstellung der gleichen Daten.

### c) Drag-and-Drop zwischen Tagen

Punkte koennen zwischen Wochentag-Spalten gezogen werden, was den `weekday` des jeweiligen `RecurringTemplate`-Eintrags aendert.

---

## 3. Wochenvorplanung am Montag

**Feature:** Wenn der Benutzer den Tageszettel am Montag oeffnet und die Woche noch nicht vorgeplant ist, wird ein optionaler "Woche vorplanen"-Modus angeboten.

### a) Montags-Banner

Am Montag (oder wenn der aktuelle Tag ein Montag ist) erscheint im Tageszettel ein Banner:

```text
+---------------------------------------------------+
| Kalender  Neue Woche starten?                     |
|           Plane deine Woche vor.      [Planen]    |
+---------------------------------------------------+
```

### b) Wochenplanungs-Ansicht

Beim Klick auf "Planen" oeffnet sich eine Ansicht mit:
- 5 Spalten (Mo-Fr), jede vorab gefuellt mit den wiederkehrenden Punkten des jeweiligen Tages
- Der Benutzer kann zusaetzliche Punkte pro Tag hinzufuegen, verschieben oder loeschen
- Ein "Uebernehmen"-Button schreibt die geplanten Punkte als vorbereitete HTML-Eintraege in den jeweiligen Tages-Store (`store[dayKey]`)

### c) Datenstruktur

Neuer localStorage-Key: `day-slip-week-plan-v1`

```text
WeekPlan = {
  weekStartKey: string;           // z.B. "2026-02-23" (Montag)
  applied: boolean;
  days: Record<string, string[]>; // dayKey -> geplante Zeilen
}
```

Beim Oeffnen eines geplanten Tages werden die vorbereiteten Zeilen in den Tageszettel injiziert (aehnlich wie `recurringInjected`), mit einem Flag `weekPlanInjected` um Doppelinjektionen zu verhindern.

### d) Dismiss-Moeglichkeit

Das Banner kann mit einem X geschlossen werden. Ein Flag `weekPlanDismissed` im `WeekPlan`-Objekt verhindert, dass das Banner erneut angezeigt wird.

---

## Betroffene Dateien

| Datei | Aenderung |
|---|---|
| `src/components/GlobalDaySlipPanel.tsx` | Stimmungsabfrage bedingt anzeigen; Wochenroutine-Raster in Einstellungen; Wochenplanungs-Modus mit Banner und Planungsansicht |

## Technische Reihenfolge

1. Stimmungsabfrage in `resolveMode`-Bedingung wrappen (kleiner Fix)
2. Wochenroutine-Raster in Settings-View einbauen (Darstellung bestehender Daten)
3. Wochenplanungs-Modus: localStorage-Struktur, Banner, Planungsansicht, Injektionslogik
