# Selbsttest-Center ausbauen

## 1. Abgleich bestehender Tests mit dem Code

Es gibt heute 8 Abläufe: Meeting, Termin, Tagesbriefing, Veranstaltung, Brief, Vorgang, Entscheidung, Aufgabe.

- **Vorgang:** veraltet. Er prüft nur die Status-Kette (neu → in Klärung → Antwort ausstehend → erledigt). „Wer ist am Zug?“, „Schritt festlegen / erledigt“, Wiedervorlage, Vertretung, Verlaufseinträge und Tageszettel-Links fehlen ganz.
- **Aufgabe:** sehr dünn, nur 3 Schritte (anlegen, in Arbeit, erledigt). Zuweisung, Frist, Entscheidung aus Aufgabe und Jour-Fixe-Übernahme fehlen.
- **Entscheidung:** setzt den Status direkt. Echte Abstimmung, das Abschluss-Ergebnis und die Rückwirkung auf einen verknüpften Vorgang fehlen.
- **Termin, Brief, Meeting, Veranstaltung, Briefing:** passen grob. Sie werden beim Umbau Feld für Feld gegen das aktuelle Datenbankschema geprüft, und veraltete Felder werden korrigiert.
- Neu kommt ein **Schema-Abgleich**. Er schlägt Alarm, wenn ein Test in Spalten schreibt, die es nicht mehr gibt, oder wenn Pflichtfelder fehlen.

## 2. Vorgangs-Lifecycle komplett

Der Ablauf wird so aufgebaut, wie ein Mitarbeiter einen Vorgang wirklich durchläuft:

1. Vorgang anlegen und Standardwerte prüfen (am Zug: Büro, kein Schritt, keine Wiedervorlage).
2. Interaktionen erfassen: Sachlage, Notiz, Anruf, Mail. Prüfen, dass sie im Verlauf erscheinen.
3. „Wer ist am Zug?“ ändern, ohne zu speichern. Prüfen, dass **keine** Wiedervorlage entsteht.
4. Schritt festlegen mit Frist in der Zukunft. Prüfen: Wiedervorlage aktiv, Verlaufseintrag „Schritt festlegt“ und „Auf Wiedervorlage gelegt“.
5. Am Zug: Ministerium. Prüfen: 21-Tage-Frist und Verlaufseintrag.
6. Vertretung/Übergabe. Prüfen: Eintrag im Übergabe-Protokoll und Rollenprüfung (nur Abgeordnete/Büroleitung).
7. Entscheidung anfordern. Prüfen: Vorgang steht auf „Entscheidung abwartend“, Verlaufseintrag und Verknüpfung vorhanden.
8. Abstimmen und Entscheidung abschließen. Prüfen, ob der Vorgang die Rückmeldung sieht.
9. Auf den Tageszettel übernehmen. Prüfen: Die Zeile behält den Link zum Vorgang nach erneutem Laden.
10. Auf den Jour fixe setzen. Prüfen: Markierung und Tagesordnung.
11. Ortstermin anfragen. Prüfen: „Eingang per“ ist „Vorgang“, die Anfrage ist verknüpft.
12. Schritt erledigt. Prüfen: Schritt geleert, Verlaufseintrag, und die Liste zeigt wieder „Schritt festlegen“.
13. Vorgang abschließen und Abschlussfelder prüfen. Alles Erzeugte wird wieder aufgeräumt.

Dazu kommt ein zweiter Prüftyp: **Regeltests ohne Datenbank**. Die Regeln für Wiedervorlage, Schritt-Zustand und Verlaufstexte werden im Selbsttest-Center sichtbar mit festen Beispieldaten ausgeführt. So lässt sich auch die Logik prüfen, nicht nur das Speichern.

## 3. Fehlende Lifecycles der Plattform

Für diese Bereiche gibt es heute keinen Selbsttest. Vorschlag in dieser Reihenfolge:

- **Terminanfragen:** Eingang → Entscheidung über die gesicherte Freigabe-Funktion → Termin entsteht. Außerdem prüfen, dass eine direkte Statusänderung blockiert wird.
- **Tageszettel:** Zeilen mit Links zu Notiz, Aufgabe, Vorgang und Entscheidung, Übernahme auf den Folgetag.
- **Notizen (Quick Notes):** anlegen, Priorität, teilen, in Aufgabe oder Tageszettel überführen.
- **Aufgaben, erweitert:** Zuweisung an mehrere Personen, Frist, Entscheidung aus Aufgabe, Archiv.
- **Terminabstimmung:** Umfrage, Gast-Stimme, automatischer Termin bei „Ja“.
- **Kontakte:** Kontakt anlegen, Interaktion, Briefing-Gedächtnis.
- **Zeiterfassung/Abwesenheit:** Eintrag, Korrektur, Urlaub mit Pflicht-Vertretung, Höchstgrenze 39,5 h/Woche.
- **DSGVO-Löschung:** Antrag, Freigabe durch eine zweite Person, Antragsteller darf nicht selbst bestätigen. Nur als Prüfung der Regeln, ohne echte Löschung.
- **Sicherheit (Mandantentrennung):** Prüfen, dass Daten eines anderen Mandanten nicht lesbar sind.

Im Selbsttest-Center kommt eine **Abdeckungsübersicht** dazu: welcher Bereich einen Test hat, wann er zuletzt lief und mit welchem Ergebnis.

## Umfang dieser Runde

Diese Runde umfasst Punkt 1 (Abgleich und Korrekturen), Punkt 2 (Vorgang komplett) und aus Punkt 3 die Terminanfragen, den Tageszettel und die erweiterten Aufgaben. Die übrigen Bereiche kommen auf die Roadmap für die nächste Runde.

## Technische Details

- Szenarien liegen in `src/features/selftest/scenarios/`. Neu kommen `appointment-request-lifecycle.ts` und `day-slip-lifecycle.ts`; `task-lifecycle.ts` wird erweitert, `case-item-lifecycle.ts` neu geschrieben (Ball, `next_action_*`, `intake_payload.timeline_events`, `case_item_handover_log`).
- Neues optionales Feld in `TestStep`: `kind: "db" | "logic"`. Logik-Schritte rufen reine Funktionen aus `features/cases/items/ball.ts` auf.
- Die Verlaufseinträge werden über denselben Helfer geschrieben, den die UI nutzt (`ballChangeEvents`), damit der Test den echten Pfad prüft. Falls das Schreiben derzeit nur im Komponenten-Code steckt, wird es in eine geteilte Funktion herausgelöst.
- Den Schema-Abgleich übernimmt `scripts/check-selftest-coverage.mjs` gegen die generierten Supabase-Typen; `writes` in jedem Szenario wird aktualisiert.
- Das Aufräumen bleibt rückwärts über `ctx.created`; neue Tabellen werden ergänzt.
- Der Status der letzten Läufe wird lokal gespeichert, um die Abdeckungsübersicht zu füllen. Dafür ist keine neue Tabelle nötig.
- In `AGENTS.md` kommt eine Regel: Neue Fachlogik braucht einen passenden Selbsttest-Schritt.
