# Optionaler Tagesüberblick über Entscheidungen

Der Tagesüberblick ist ein separates Opt-in und ersetzt den lokalen
15-Minuten-Digest nicht. Aktiviert wird er in den Benachrichtigungseinstellungen unter
„Entscheidungs-Meldungen“ oder über `set_decision_daily_digest(tenant_id, enabled)`.

## Verhalten

- `dispatch_decision_daily_digests()` läuft stündlich (Cron `10 * * * *`) und stellt
  nur zwischen 06:00 und 11:59 Berliner Zeit zu.
- Ist der Tagesüberblick aktiv und gibt es offene Entscheidungen ohne Antwort, entsteht
  eine Meldung `task_decision_daily_digest` mit Anzahl und Entscheidungs-IDs.
- Zusätzlich nimmt der Überblick selbst erstellte Entscheidungen mit unbeantworteten
  Rückfragen auf. Er nennt deren Anzahl und das Alter der ältesten Rückfrage („1 offene
  Rückfrage seit 2 Tagen“) und bittet um Antwort. Offen ist eine Rückfrage, solange die
  letzte Hauptantwort der Person `question` ist und `creator_response` leer bleibt.
- Anzahl, Zeitpunkt und Alter der ältesten Rückfrage stehen als `open_question_count`,
  `open_question_decision_count`, `oldest_question_at`, `oldest_question_age_hours` und
  `oldest_question_age_label` im `data`-Feld; die betroffenen eigenen Entscheidungen
  zusätzlich als `creator_question_decision_ids`.
- Pro Person, Mandant und Berliner Kalendertag wird höchstens einmal zugestellt
  (`decision_daily_digest_deliveries`).
- Ruhezeiten werden beachtet; solange das Morgenfenster offen ist, wird es in der
  nächsten Stunde erneut versucht.
- Die Meldung ist vom lokalen Zustellmodus unabhängig, wird nicht in den lokalen Digest
  aufgenommen und unterliegt den Ruhezeiten.
- Ohne offene Entscheidungen wird nichts gesendet und kein Versandtag verbraucht.

## Prüfung

`decision_daily_digest_selftest` prüft die einmalige Zustellung, die JSON-Liste der
Entscheidungen, die offene Rückfrage in einer eigenen Entscheidung samt Alter und
Antwortbitte, die Wiederholungssperre am selben Tag und das Ausbleiben nach dem
Abschalten. Der Szenario-Schritt heißt `daily-digest`.

Nicht geprüft: echter Cron-Lauf, Push-Versand, Browserdarstellung und das Verhalten bei
Ruhezeiten über das gesamte Morgenfenster.
