# Frist-Erinnerungen vor Ablauf

`dispatch_decision_deadline_reminders()` läuft stündlich und erinnert offene
Teilnehmende, die noch keine Hauptantwort abgegeben haben:

| Stufe | Bedingung | Priorität |
|---|---|---|
| `24h` | Frist in mehr als 2 bis 24 Stunden | medium |
| `2h` | Frist in höchstens 2 Stunden | high |

Je Entscheidung, Person und Stufe wird höchstens einmal erinnert
(`decision_deadline_reminders`, Primärschlüssel aus Entscheidung, Person und Stufe).
Die Funktion ist über eine Advisory Lock gegen parallele Cron-Läufe geschützt.

## Ruhezeiten und Zustellung

- Liegt der Lauf in den Ruhezeiten der Person (Europe/Berlin, auch über Mitternacht),
  wird die Stufe nicht versendet und beim nächsten Lauf erneut versucht.
- Die Erinnerung wird nicht gebündelt und erreicht die Person auch bei persönlicher
  Frequenz `off` oder `digest`; die typbezogene Abschaltung bleibt wirksam.
- Die Meldung enthält Entscheidungs-ID, Frist und Stufe, öffnet die Entscheidung und
  bietet die konfigurierten Schnellantworten an.
- Wurde die Frist vor dem Ende der Ruhezeit erreicht, entfällt die Stufe; es wird keine
  Erinnerung nach Ablauf nachgeschoben.

## Prüfung

`decision_deadline_reminder_selftest` prüft je einmalige 24-h- und 2-h-Erinnerung,
Deduplizierung beim zweiten Lauf, Aussetzen während 22:00–08:00 und den Versand nach
Ende der Ruhezeit. Der Szenario-Schritt heißt `deadline-reminders`.

Nicht geprüft: echter Cron-Lauf, Push-Versand, Browserdarstellung und die Wirkung auf
die Antwortquote.
