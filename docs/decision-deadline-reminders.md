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
| `creator_24h` | Frist endet innerhalb von 24 Stunden, Antworten fehlen oder Rückfragen sind offen | medium |
| `creator_overdue` | Frist ist überschritten, Antworten fehlen oder Rückfragen sind offen | high |

Die Warnung nennt die aktuelle Zahl der Teilnehmenden ohne Hauptantwort, zum Beispiel
„Noch 2 Antworten fehlen“. Gezählt werden alle Teilnehmenden außer dem Ersteller; eine
spätere Antwortänderung ersetzt die frühere Hauptantwort. `creator_overdue` wird genau
einmal versendet, auch wenn die Entscheidung danach offen bleibt.

## Offene Rückfragen

Zusätzlich nennt die Ersteller-Warnung die offenen Rückfragen samt Alter der ältesten,
zum Beispiel „2 offene Rückfragen (älteste seit 3 Tagen)“. Offen ist eine Rückfrage,
solange die letzte Hauptantwort der Person `question` ist und der Ersteller sie nicht
beantwortet hat (`creator_response` leer) – dieselbe Bedingung, die das automatische
Archivieren blockiert. Der Text bittet ausdrücklich um Antwort („bitte beantworte
sie“).

Dadurch bleibt die Warnung auch dann bestehen, wenn alle Teilnehmenden geantwortet
haben, aber noch eine Rückfrage unbeantwortet ist. Sind alle Antworten da und keine
Rückfrage offen, entfällt sie vollständig. Anzahl, Zeitpunkt und Alter stehen als
`open_question_count`, `oldest_question_at`, `oldest_question_age_hours` und
`oldest_question_age_label` im `data`-Feld; die Statistik liefert
`decision_open_question_stats`, die Altersformulierung `decision_question_age_label`.

Die Warnung nutzt den Meldungstyp `task_decision_deadline_reminder` mit
`creator_warning=true` und `missing_count` im `data`-Feld. Die Oberfläche bietet dafür
keine Schnellantworten an; der Klick öffnet die Entscheidung.

## Friständerung

Wird die Frist einer offenen Entscheidung nach hinten verschoben oder erstmals gesetzt,
löscht der Trigger `rearm_decision_deadline_reminders` (AFTER UPDATE OF
`response_deadline`) alle gespeicherten Stufen der Entscheidung. Der stündliche Lauf
legt danach nur die Stufen neu an, die zur neuen Frist passen: Ist die neue Frist noch
weiter als 24 Stunden entfernt, wird zunächst nicht erinnert; rückt sie näher, kommen
Teilnehmer- und Ersteller-Warnung erneut.

Wird die Frist vorgezogen, bleiben die Stufen stehen. So erhält niemand eine bereits
versendete 24-h-Warnung ein zweites Mal; nur eine zusätzlich passende Stufe (etwa `2h`)
kommt hinzu.

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

`decision_deadline_rearm_selftest` prüft, dass eine Verlängerung die gespeicherten
Stufen räumt, dass für die neue, weiter entfernte Frist nicht vorzeitig erinnert wird,
dass Teilnehmer- und Ersteller-Warnung zur neuen Frist erneut greifen und dass ein
Vorziehen der Frist keine doppelte 24-h- oder Ersteller-Warnung erzeugt. Der
Szenario-Schritt heißt `deadline-rearm`.

`decision_creator_deadline_warning_selftest` prüft die Ersteller-Warnung vor Ablauf,
die einmalige Überfälligkeitswarnung mit neu berechneter Zahl, die offene Rückfrage mit
Anzahl und Alter („seit 3 Tagen“) samt Antwortbitte, den Wegfall nach beantworteter
Rückfrage, die Warnung bei vollständig beantworteter Entscheidung mit weiterhin offener
Rückfrage sowie das Ausbleiben der Warnung, wenn alle Antworten vorliegen und keine
Rückfrage offen ist. Der Szenario-Schritt heißt `creator-deadline-warnings`.

Nicht geprüft: echter Cron-Lauf, Push-Versand, Browserdarstellung und die Wirkung auf
die Antwortquote.
