# Optionaler Tagesüberblick über Entscheidungen

Der Tagesüberblick ist ein separates Opt-in und ersetzt den lokalen
15-Minuten-Digest nicht. Aktiviert wird er in den Benachrichtigungseinstellungen unter
„Entscheidungs-Meldungen“ oder über `set_decision_daily_digest(tenant_id, enabled)`.

## Verhalten

- `dispatch_decision_daily_digests()` läuft stündlich (Cron `10 * * * *`) und stellt
  nur zwischen 06:00 und 11:59 Berliner Zeit zu.
- Ist der Tagesüberblick aktiv und gibt es offene Entscheidungen ohne Antwort, entsteht
  eine Meldung `task_decision_daily_digest` mit Anzahl und Entscheidungs-IDs.
- Pro Person, Mandant und Berliner Kalendertag wird höchstens einmal zugestellt
  (`decision_daily_digest_deliveries`).
- Ruhezeiten werden beachtet; solange das Morgenfenster offen ist, wird es in der
  nächsten Stunde erneut versucht.
- Die Meldung ist vom lokalen Zustellmodus unabhängig, wird nicht in den lokalen Digest
  aufgenommen und unterliegt den Ruhezeiten.
- Ohne offene Entscheidungen wird nichts gesendet und kein Versandtag verbraucht.

## Prüfung

`decision_daily_digest_selftest` prüft die einmalige Zustellung, die JSON-Liste der
Entscheidungen, die Wiederholungssperre am selben Tag und das Ausbleiben nach dem
Abschalten. Der Szenario-Schritt heißt `daily-digest`.

Nicht geprüft: echter Cron-Lauf, Push-Versand, Browserdarstellung und das Verhalten bei
Ruhezeiten über das gesamte Morgenfenster.
