
# Plan zur Behebung der 6 Punkte

## 1. Build-Fehler beheben: DOMExportOutput
In `src/components/DaySlipLineNode.ts` fehlt der Import von `DOMExportOutput` aus `lexical`. Dieser wird zur Import-Liste hinzugefuegt.

## 2. Pressemitteilungs-E-Mail: Inhalt wird nicht uebernommen
In `src/components/emails/EmailComposer.tsx` (Zeile 179) verwendet das Standard-Template den Platzhalter `{{inhalt}}` nicht. Der Fallback-Template-Body enthaelt nur `{{titel}}`, `{{excerpt}}` und `{{link}}`, aber nicht `{{inhalt}}`. Der Platzhalter wird zum Standard-Template-Body hinzugefuegt, sodass der HTML-Inhalt der Pressemitteilung automatisch in die E-Mail eingefuegt wird.

## 3. Unsplash-Option beim Titelbild der Pressemitteilung
In `src/components/press/FeatureImagePicker.tsx` wird ein neuer Tab "Unsplash" als erste Option vor "Dokumente" und "URL" eingefuegt. Die bestehende Unsplash-Suche aus `src/components/dashboard/UnsplashImagePicker.tsx` dient als Referenz. Die Suche verwendet die bereits vorhandene Edge Function `search-unsplash`.

## 4. Header-Tab Layout-Problem in Briefvorlagen
In `src/components/letters/StructuredHeaderEditor.tsx` (Zeile 1249-1250) ist das 3-Spalten-Grid mit einer verschachtelten `div.xl:contents` umschlossen. Dies kann in bestimmten Szenarien das Grid-Layout brechen. Die Struktur wird korrigiert, indem die Cards direkt als Grid-Kinder positioniert werden, ohne den `xl:contents`-Wrapper, der das Layout stoert.

## 5. Dashboard: Aufgaben unter "Aufgabenstatus" statt "Termine morgen"
In `src/components/dashboard/DashboardGreetingSection.tsx` werden die offenen Aufgaben aktuell mit einem Drag-Handle unter der Terminliste angezeigt. Die Darstellung wird so geaendert, dass:
- Die Aufgabentitel unter der Sektion "Aufgabenstatus" angezeigt werden (statt nach den Terminen)
- Der Draggable-Indikator visuell anders gestaltet wird (z.B. subtilere Card-Optik)
- Ein Klick auf eine Aufgabe den Nutzer zu `/mywork?tab=tasks` navigiert

## 6. Tageszettel: Punkte in Quicknote/Aufgabe/Entscheidung umwandeln
Am Ende des Tages (Resolve-Modus) koennen Tageszettel-Eintraege bereits als "note", "task" oder "decision" markiert werden (der `ResolveTarget`-Typ enthaelt diese bereits). Der Resolve-Export-Mechanismus (`syncResolveExport`) schreibt diese in localStorage. Hier muss sichergestellt werden, dass die markierten Eintraege tatsaechlich als Quicknote, Aufgabe oder Entscheidung in der Datenbank erstellt werden, wenn der Tag abgeschlossen wird.

## 7. Team-Mitteilungen: Push-Benachrichtigung bei Erstellung
In `src/hooks/useTeamAnnouncements.ts` wird nach dem erfolgreichen Erstellen einer Mitteilung (`createAnnouncement`) eine Benachrichtigung via `create_notification` RPC fuer alle aktiven Tenant-Mitglieder (ausser dem Autor) erstellt. Da das bestehende Push-System einen DB-Trigger auf der `notifications`-Tabelle hat, wird die Browser-Push-Benachrichtigung automatisch ausgeloest.

---

## Technische Details

### Datei-Aenderungen:

| Datei | Aenderung |
|-------|-----------|
| `src/components/DaySlipLineNode.ts` | `DOMExportOutput` zum Import hinzufuegen |
| `src/components/emails/EmailComposer.tsx` | `{{inhalt}}` zum Standard-Template-Body hinzufuegen |
| `src/components/press/FeatureImagePicker.tsx` | Unsplash-Tab als erste Option einfuegen |
| `src/components/letters/StructuredHeaderEditor.tsx` | Grid-Struktur korrigieren: `xl:contents`-Wrapper entfernen und Cards direkt im Grid platzieren |
| `src/components/dashboard/DashboardGreetingSection.tsx` | Aufgabenliste unter "Aufgabenstatus" verschieben, Klick-Navigation hinzufuegen, Draggable-Darstellung anpassen |
| `src/components/GlobalDaySlipPanel.tsx` | Beim Abschluss des Tages die aufgeloesten Eintraege als Quicknote/Aufgabe/Entscheidung in die Datenbank schreiben |
| `src/hooks/useTeamAnnouncements.ts` | Benachrichtigungen fuer alle Tenant-Mitglieder beim Erstellen einer Mitteilung anlegen |
