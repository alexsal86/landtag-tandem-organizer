# Frist-Erinnerungen und Ersteller-Warnungen

`dispatch_decision_deadline_reminders()` läuft stündlich und erinnert offene
Teilnehmende sowie den Ersteller einer Entscheidung. Jede Stufe wird je Entscheidung,
Person und Stufe höchstens einmal versendet (`decision_deadline_reminders`,
Primärschlüssel aus Entscheidung, Person und Stufe). Die Funktion ist über eine
Advisory Lock gegen parallele Cron-Läufe geschützt.

## Teilnehmende

Teilnehmende ohne Hauptantwort erhalten:

| Stufe | Bedingung | Priorität |
|---|---|---|
| `24h` | Frist in mehr als 2 bis 24 Stunden | medium |
| `2h` | Frist in höchstens 2 Stunden | high |

## Ersteller

Der Ersteller erhält zusätzlich:

| Stufe | Bedingung | Priorität |
|---|---|---|
| `creator_24h` | Frist endet innerhalb von 24 Stunden, mindestens eine Hauptantwort fehlt | medium |
| `creator_overdue` | Frist ist überschritten, mindestens eine Hauptantwort fehlt | high |

Die Warnung nennt die aktuelle Zahl der Teilnehmenden ohne Hauptantwort, zum Beispiel
„Noch 2 Antworten fehlen“. Gezählt werden alle Teilnehmenden außer dem Ersteller; eine
spätere Antwortänderung ersetzt die frühere Hauptantwort. Sind alle Antworten
eingegangen, entfällt die Warnung. `creator_overdue` wird genau einmal versendet, auch
wenn die Entscheidung danach offen bleibt.

Die Warnung nutzt den Meldungstyp `task_decision_deadline_reminder` mit
`creator_warning=true` und `missing_count` im `data`-Feld. Die Oberfläche bietet dafür
keine Schnellantworten an; der Klick öffnet die Entscheidung.

## Ruhezeiten und Zustellung

- Liegt der Lauf in den Ruhezeiten der Person (Europe/Berlin, auch über Mitternacht),
  wird die Stufe nicht versendet und beim nächsten Lauf erneut versucht.
- Die Erinnerung wird nicht gebündelt und erreicht die Person auch bei persönlicher
  Frequenz `off` oder `digest`; die typbezogene Abschaltung bleibt wirksam.
- Die Meldung enthält Entscheidungs-ID, Frist, Stufe und bei Ersteller-Warnungen die
  Zahl der fehlenden Antworten. Sie öffnet die Entscheidung.
- Wurde die Frist vor dem Ende der Ruhezeit erreicht, entfällt die Teilnehmer-Stufe.
  Eine Ersteller-Überfälligkeitswarnung wird nach der Ruhezeit nachgeholt, sofern dann
  noch Antworten fehlen.

## Prüfung

`decision_deadline_reminder_selftest` prüft je einmalige 24-h- und 2-h-Erinnerung,
Deduplizierung beim zweiten Lauf, Aussetzen während 22:00–08:00 und den Versand nach
Ende der Ruhezeit. Der Szenario-Schritt heißt `deadline-reminders`.

`decision_creator_deadline_warning_selftest` prüft die Ersteller-Warnung vor Ablauf,
die einmalige Überfälligkeitswarnung mit neu berechneter Zahl sowie das Ausbleiben der
Warnung, wenn alle Antworten vorliegen. Der Szenario-Schritt heißt
`creator-deadline-warnings`.

Nicht geprüft: echter Cron-Lauf, Push-Versand, Browserdarstellung und die Wirkung auf
die Antwortquote.
