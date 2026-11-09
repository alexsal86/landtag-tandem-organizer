# Ein Briefing, zwei Zoomstufen, plus Live-Modus

Ziel: Kurz-Briefing, Lang-Briefing (7 Phasen) und Live-Briefing werden zu einem durchgehenden Ablauf: **beantragen, zuarbeiten, freigeben, beim Termin nutzen (live), nachbereiten, Folgeaufgaben**. Für alle Ansichten gibt es nur noch einen Datensatz.

## Wie es heute ist (geprüft)
- Kurz-Briefing (`CompactBriefingEditor`) speichert eigene `compact_*`-Felder (Partner, Ziel, Positionen, Unterlagen, Q&A, Fakten, Nachbereitung).
- Das Lang-Briefing speichert strukturierte Listen (Gesprächspartner, Q&A, Programm, Begleitung). Die beiden Formate tauschen keine Daten aus.
- Das Live-Briefing (`BriefingLivePage`, `LiveBriefingPane`) zeigt das Briefing an. Notizen landen dort in `appointment_feedback`. Aufgaben werden direkt angelegt, ohne Angaben zu „wer ist am Zug“ (Stafette), ohne Verweis auf den Termin und ohne Eintrag in der Timeline.
- Die Nachbereitung im Kurz-Briefing (`compact_debrief`) und das Live-Feedback sind zwei getrennte Orte.

## Der Ablauf danach
```text
Termin / Terminanfrage -> Briefing nötig? (kurz | umfassend | keins)
   -> Stafetten-Aufgabe an die Zuarbeit -> Kurz-Briefing (Standard)
        -> "Zum Dossier erweitern" (gleiche Daten, mehr Felder)
   -> Zur Freigabe -> Freigeben / Zurück mit Anmerkung
   -> Termintag: Tagesbriefing-Karte -> "Live starten"
        -> Live: One-Pager + Notizen + Schnell-Aufgaben
   -> Nachbereitung (eine Quelle) -> Folgeaufgaben mit Ball -> Briefing abgeschlossen
```

## Bausteine
1. **Gemeinsame Daten:** Ein Umrechner verbindet beide Formate. Die Stichpunkte aus dem Kurz-Briefing landen in den Listen des Dossiers, und umgekehrt fasst das Kurz-Briefing das Dossier zusammen. Jede Ansicht liest und schreibt über diesen Umrechner. Bestehende Briefings werden beim Öffnen einmalig zusammengeführt, ohne Datenverlust.
2. **Umschalter `Kompakt | Dossier`** in der Seitenleiste, auf der Detailseite und im Live-Modus. Kompakt ist der Standard. Felder des Dossiers, die ausgefüllt sind, erscheinen im Kurz-Briefing als dezente Zeile, zum Beispiel „Ablauf: 14:00 Begrüßung …“.
3. **Neuer Termin und Zusage im Jour Fixe:** Ein einheitlicher Block „Briefing: keins / kurz / umfassend“ mit Person und Frist. Er nutzt die vorhandene Briefing-Funktion, die die Aufgabe automatisch anlegt.
4. **Freigabe:** „Zur Freigabe“ und „Freigeben / Zurück mit Anmerkung“ bleiben im bestehenden Briefing-Ablauf. Die Vorschau zeigt immer den One-Pager.
5. **Live-Briefing einbinden:**
   - Der Einstieg „Live starten“ erscheint auf der Briefing-Karte im Tagesbriefing und am Termin, sobald das Briefing freigegeben ist und der Termin heute stattfindet.
   - Live-Notizen und die Nachbereitung im Briefing werden zu einer gemeinsamen Quelle. `appointment_feedback` bleibt als Speicherort erhalten, und die Nachbereitung im Briefing zeigt diese Notizen an.
   - Schnell-Aufgaben im Live-Modus laufen über dieselbe Logik für Folgeaufgaben wie in der Nachbereitung: Ball, nächster Schritt, Frist, Verweis auf Termin und Briefing, Eintrag in der Timeline. Wahlweise lässt sich daraus auch ein Vorgang oder eine Entscheidung anfordern.
   - „Live beenden“ führt direkt in die Nachbereitung. Dort sind die Notizen schon eingetragen, und man prüft nur noch die Folgeaufgaben.
6. **Abschluss:** Ist die Nachbereitung gespeichert und sind alle Folgeaufgaben angelegt, wechselt das Briefing auf „abgeschlossen“ und die Aufgabe der Zuarbeit wird geschlossen.
7. **PDF:** Das Dossier-PDF erkennt, ob nur ein Kurz-Briefing vorliegt (eine Seite) oder ein Dossier (zwei Seiten oder mehr).

## Technische Details
- Neu: `src/features/appointments/briefing/briefingModel.ts` mit reinen Funktionen: `compactToFull`, `fullToCompact`, `mergeLegacy`, `canGoLive`, `followUpTaskFromLive`. Dazu kommen Vitest-Tests.
- Optionale Migration: `appointment_preparations.briefing_depth ('compact'|'full')`. Die Funktion `set_appointment_briefing` bekommt einen Tiefe-Parameter. Die Funktion `create_briefing_follow_up_task(prep_id, title, assignee, due)` legt die Aufgabe in einem Schritt an (rollen- und mandantengeprüft) und schreibt die Stafetten-Felder samt `source_type='appointment_briefing'`.
- `BriefingLivePage`: Der direkte Eintrag in `tasks` wird durch diese Funktion ersetzt. Der Status „abgeschlossen“ läuft über `advance_appointment_briefing`.
- Angepasst werden `CompactBriefingEditor`, der 7-Phasen-Editor, `LiveBriefingPane`, `TodayBriefingPanel`, `AppointmentBriefingStatusCard`, `CreateAppointmentDialog`, `JourFixeRequestsCard` und `briefingPdfGenerator`.
- Selbsttest: Das Szenario für den Briefing-Ablauf bekommt neue Schritte: Umrechnung hin und zurück, Live erlaubt, Folgeaufgabe mit Ball, Abschluss.
- Eine neue Regel kommt in `AGENTS.md` (ein Datensatz und Umrechner; Folgeaufgaben nur über die neue Funktion).

## Nicht enthalten
- Die alte Vorbereitungsseite wird nicht gelöscht, sondern nutzt nur denselben Datensatz.
- Die Warnung bei Plenarzeiten kommt später als eigener Schritt.
