# Tageszettel: Termine aktuell halten und in der Wochenplanung zeigen

## 1. Vorbei = ausgeblendet
- Unter „Heutige Termine“ stehen nur noch Termine, die noch nicht zu Ende sind. Die Liste aktualisiert sich jede Minute, wie bisher.
- Ganztägige Termine bleiben den ganzen Tag stehen.
- Die Überschrift zeigt die verbleibenden Termine, z. B. „Heutige Termine (2 von 5)“. Wenn alle vorbei sind: „Für heute keine Termine mehr“.
- Optional gibt es den kleinen Link „3 vorbei anzeigen“, um die erledigten Termine einmal gedämpft aufzuklappen.
- Der laufende Termin wird als „Jetzt“ hervorgehoben, der nächste als „Als Nächstes in 25 Min.“.

## 2. Bekannte Termine in der Wochenplanung
- Im Raster „Woche vorplanen“ (Mo–Fr) stehen oben in jeder Tagesspalte die Termine der Woche aus dem Kalender: Uhrzeit und Titel, nur zum Lesen, farblich von den eigenen Punkten abgesetzt.
- Vorgemerkte Terminanfragen erscheinen dort gestrichelt mit ⏳, wie im Kalender.
- Ein Klick auf einen Termin öffnet ihn im Kalender.
- Termine werden nicht in den Wochenplan kopiert. So bleiben sie immer aktuell, auch wenn sich im Kalender etwas ändert.

## 3. Wird mit umgesetzt
- **Nachbereitung anstoßen:** Ist ein Termin vorbei, fragt der Tageszettel einmal „Nachbereitung notieren?“. Ein Klick legt eine Zeile wie „Nachbereitung: Jahresempfang“ an.
- **Termin als Zeile übernehmen:** Ein kleines Plus am Termin übernimmt ihn als Notizzeile, z. B. für Vorbereitungsaufgaben.

## 4. Weitere Ideen (zum Mitbestellen)
- **Freie Zeitfenster:** In der Wochenplanung steht pro Tag ein dezenter Hinweis wie „noch ca. 3 Std. frei“. Das hilft beim Verteilen der Aufgaben.
- **Briefing-Status am Termin:** Im Tageszettel zeigt ein Punkt in Grün, Gelb oder Rot, ob das Briefing fertig ist, gerade bearbeitet wird oder fehlt. Das entspricht der Anzeige auf dem Dashboard.

## Technische Details
- `DaySlipAppointments.tsx`: Filter `(endTime ?? date) > now` für Termine mit Uhrzeit. Ganztägige Termine werden bis Tagesende behalten. Dazu kommen die Ableitung von „jetzt“ und „als Nächstes“ und ein Umschalter für die vergangenen Termine.
- Die Logik kommt als reine Funktion in eine kleine Hilfsdatei mit Tests: vorbei, laufend, als Nächstes, ganztägig.
- `WeekPlanningBanner.tsx`: `useCalendarData(monday, "week")` und `useOpenAppointmentRequests()`. Beides wird nach Tag gruppiert (Mo–Fr) und oberhalb der Plan-Einträge jeder Spalte angezeigt. Am gespeicherten `WeekPlan` ändert sich nichts.
- Nachbereitung und „Als Zeile übernehmen“ nutzen die vorhandene Tageszettel-Brücke (`sendToDaySlip`). Die Nachbereitungsfrage erscheint pro Termin nur einmal. Bereits gefragte Termine werden pro Nutzer gemerkt.
- Abschnitt 4 setze ich nur um, wenn du ihn freigibst.
