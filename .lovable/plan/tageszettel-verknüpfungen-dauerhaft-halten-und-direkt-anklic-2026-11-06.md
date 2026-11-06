# Tageszettel: Verknüpfungen dauerhaft halten und direkt anklickbar machen

## Befund (geprüft)
- Beim Übernehmen (Vorgang „Auf Tageszettel“, Notiz, Drag & Drop von Aufgaben/Entscheidungen) wird die Verknüpfung korrekt mitgegeben und in einer separaten Liste „Zeile → Objekt“ gespeichert.
- In der Datenbank ist der heutige Eintrag „Antwort des Ministeriums nachhalten [Juhhhj]“ vorhanden, seine Verknüpfungsliste ist aber leer. Gestern blieb eine Vorgangs-Verknüpfung erhalten. Die Verknüpfung geht also unterwegs verloren, nicht beim Übernehmen.
- Die Verknüpfung hängt nur an der Zeilen-Kennung. Bei jeder Eingabe wird die Liste neu aus dem Editor abgeleitet und alles entfernt, dessen Zeilen-Kennung nicht mehr gefunden wird. Ändert sich die Kennung beim Neuaufbau des Editors (nach Übernahme oder Refresh), ist die Verknüpfung weg. Im Editor selbst steht nur bei Aufgaben eine Kennung an der Zeile; Notizen, Vorgänge und Entscheidungen haben keine.
- Ein Sprung zum Objekt ist heute nur im Abschluss-Modus möglich („Original öffnen“), nicht direkt aus der Zeile.

## Umsetzung
1. **Ursache bestätigen:** Mit einem Test nachstellen: Vorgang übernehmen → Editor neu laden → tippen → speichern → neu laden. Prüfen, an welcher Stelle Zeilen-Kennung oder Verknüpfung verloren geht.
2. **Verknüpfung an die Zeile selbst binden:** Jede Tageszettel-Zeile trägt Typ und Kennung ihres Objekts (Aufgabe, Notiz, Vorgang, Entscheidung) direkt mit sich. Das wird mitgespeichert und beim Laden wiederhergestellt. Die bisherige Liste wird aus den Zeilen abgeleitet, statt verloren zu gehen.
3. **Nichts stillschweigend löschen:** Eine Verknüpfung verschwindet nur noch, wenn die Zeile wirklich gelöscht wird. Ändert sich nur der Text, bleibt sie bestehen. Alte Tageszettel mit der bisherigen Liste werden beim Laden in die Zeilen übernommen.
4. **Direkt aus dem Zettel springen:** Verknüpfte Zeilen bekommen rechts ein kleines Symbol je Typ (Vorgang, Notiz, Aufgabe, Entscheidung). Ein Klick öffnet das Objekt; über das Rechtsklick-Menü gibt es zusätzlich „Original öffnen“.
5. **Übertrag in den nächsten Tag:** Beim Übernehmen offener Punkte in den neuen Tag bleibt die Verknüpfung erhalten (vorhandene Logik, wird mitgetestet).

## Tests
- Übernommener Vorgang bleibt nach Neuladen und anschließender Eingabe verknüpft.
- Textänderung an einer verknüpften Zeile behält die Verknüpfung.
- Gelöschte Zeile verliert die Verknüpfung.
- Alte gespeicherte Tageszettel werden korrekt übernommen.

## Technische Details
- `DaySlipLineNode`: `linkedTaskId` wird zu `linkedSource {type,id,nextActionLabel?}` (JSON + `data-source-type`/`data-source-id`; altes `data-linked-task-id` wird beim Lesen als Aufgabe übernommen).
- `appendEntries`/`toParagraphHtml` schreiben die Source-Attribute; `onEditorChange` baut `sources` aus den Nodes und behält bestehende Einträge, deren Zeile noch existiert.
- `normalizeStore` migriert `day.sources` in die HTML-Attribute und verwirft dann `nodes`, damit der Editor neu aufbaut.
- Inline-Symbol per Editor-Plugin bzw. CSS-Marker plus Klick-Handler in `GlobalDaySlipPanel` über `sourcePath`.
- Tests in `src/components/dayslip/__tests__`.
