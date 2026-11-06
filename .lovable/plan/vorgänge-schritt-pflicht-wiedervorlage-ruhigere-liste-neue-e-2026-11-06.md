# Vorgänge: Schritt-Pflicht, Wiedervorlage, ruhigere Liste, neue Erfassung

## 1. Schritt zuerst festlegen
- Hat ein Vorgang noch keinen Schritt, zeigt der große Knopf unten im Block „Wer ist am Zug?“ **„Schritt festlegen“** statt „Schritt erledigt“. Er speichert Text, Frist und Zuständigkeit zusammen. Bisher wurde beim Verlassen des Feldes gespeichert.
- Ohne Text bleibt der Knopf grau.
- Ist ein Schritt gespeichert, heißt der Knopf **„Schritt erledigt“**. Nach dem Erledigen ist das Feld leer und der Knopf heißt wieder „Schritt festlegen“. Ohne neuen Schritt bleibt der Vorgang mit „Schritt noch offen“ markiert.

## 2. Wiedervorlage
- Regel: Ein Vorgang mit gespeichertem Schritt **und Frist in der Zukunft** liegt auf Wiedervorlage.
- Ab dem Fristtag (oder bei Überfälligkeit) erscheint er wieder oben in der normalen Liste.
- Im Block „Wer ist am Zug?“ erscheint der grüne Hinweis wie im Bild: „Wiedervorlage: Der Vorgang liegt bei der Verwaltung und erscheint am 27.11. wieder unter „Heute“.“ Der Text passt sich an, je nachdem wer am Zug ist.
- „Schritt erledigt“ funktioniert auch während der Wiedervorlage. Danach muss ein neuer Schritt festgelegt werden.

## 3. Linke Spalte
- Unter der normalen Liste kommt ein eigener Abschnitt **„Wiedervorlage · N“** mit dem Zusatz „kommt zurück“ rechts. Er lässt sich einklappen, und die Wahl wird pro Nutzer gemerkt. Die Vorgänge darin sind aus der oberen Liste entfernt.
- Karten auf Wiedervorlage bekommen einen leicht grünen Rahmen und Hintergrund, wie im Bild.
- Der farbige Punkt vor dem Titel fällt weg. Die Priorität bleibt im Kontextmenü und im Detail sichtbar.
- Weniger Abstand: zwischen den Karten (ca. 4 statt 12 px), innerhalb der Karte (Innenabstand kleiner) und zwischen Titel und der Zeile „Büro · Schritt“ (2 statt 8 px).
- Die Filter-Pills („Ohne Schritt“, „Bald fällig“ usw.) zählen weiterhin alle Vorgänge.

## 4. Erfassen im Verlauf (Layout wie im Bild)
- Eine Karte: oben ein großes Textfeld „Was ist passiert? Notiz, Anruf, Treffen …“, unten eine Fußleiste mit den Chips **Notiz · Anruf · Mail · Treffen · Dokument** und rechts dem Knopf **„Erfassen“**.
- **Sachlage** bleibt: als erster Chip vor „Notiz“. Ist er gewählt, bearbeitet das Feld die Sachlage, wie bisher.
- **Notiz** bleibt erhalten, und Einträge lassen sich weiter löschen.
- „Dokument“ öffnet die bisherige Dateiauswahl. Die angehängten Dateien stehen klein über der Fußleiste.
- **Entscheidung anfordern:** Das passt zu „Wer ist am Zug?“, denn eine Entscheidung ist ein nächster Schritt. Es kommt als weitere Schnellaktion in die Reihe „Brief aufsetzen · Auf Tageszettel · Auf Jour fixe · Ortstermin“ und öffnet den bestehenden Entscheidungsdialog. Danach steht der Ball auf „Büro“ und der Schritt auf „Entscheidung abwarten“.

## 5. Alles in den Verlauf
Neue automatische Einträge im Verlauf, jeweils mit Person und Uhrzeit:
- Am Zug geändert („Büro → Verwaltung“)
- Schritt festgelegt (Text, Frist, Zuständig)
- Schritt geändert (Frist oder Zuständigkeit)
- Schritt erledigt (gibt es schon)
- Auf Wiedervorlage gelegt und „Wiedervorlage fällig“ (wird beim Öffnen einmal ergänzt, sobald die Frist da ist)
- Übergabe an eine Vertretung, Entscheidung angefordert, Brief angelegt, auf Jour fixe gesetzt
- Diese Einträge sind grau und nicht löschbar, damit sie sich von echten Notizen unterscheiden.

## 6. Weitere Ideen (nicht in diesem Paket, nur Vorschlag)
- Schnell-Fristen beim Schritt: „+3 T“, „+1 Woche“, „+21 T Ministerium“.
- Tastenkürzel: `S` für Schritt festlegen, `E` für erledigt.
- Hinweis-Punkt in der Seitenleiste, wenn heute Wiedervorlagen zurückkommen.
- Bei „Bürger am Zug“ automatisch eine Wiedervorlage nach 14 Tagen vorschlagen.

## Technische Details
- Die Regeln kommen als reine Funktionen in `src/features/cases/items/ball.ts`: `isOnResubmission(item, now)`, `stepState(item)` (`none` | `set`), `resubmissionHint(item)`, `ballChangeEvents(prev, patch)`. Dazu kommen Tests in `ball.test.ts`: Frist morgen bedeutet Wiedervorlage, Frist heute nicht, ohne Schritt keine Wiedervorlage, und ein Wechsel von Büro zu Verwaltung ergibt einen Eintrag.
- `CaseItemBallPanel.tsx`: Das Speichern beim Verlassen des Feldes fällt weg, dafür kommt ein lokaler Entwurf und der Knopf „Schritt festlegen“. Das Ändern des Balls bleibt sofort. Dazu kommen der Hinweisbalken und die Schnellaktion für die Entscheidung.
- `CaseItemList.tsx`: Die Liste teilt sich in aktive Vorgänge und Wiedervorlagen, mit einklappbarem Abschnitt (gespeichert im Browser), ohne `Circle`-Marker und mit kleineren Abständen.
- `MyWorkCasesWorkspace.tsx` / `handleBallChange`: Systemereignisse (`type: "system"`) werden an `intake_payload.timeline_events` angehängt, im selben Update wie die Feldänderung. Es gibt keine Änderung an der Datenbank.
- `CaseItemDetailPanel.tsx`: Der Erfassungsbereich wird nach dem Bild neu aufgebaut. `SimpleRichTextEditor`, die Dateiauswahl und `onAddInteraction` bleiben, und Systemeinträge sind von der Löschfunktion ausgenommen.
