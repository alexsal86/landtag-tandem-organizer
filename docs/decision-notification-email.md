# Entscheidungs-Meldungen per E-Mail

Die E-Mail-Schalter in den Benachrichtigungseinstellungen sind für
Entscheidungs-Meldungen wirksam: Wer sie aktiviert, erhält die Meldung zusätzlich per
E-Mail über Resend. E-Mail ist ein Opt-in und standardmäßig aus
(`user_notification_settings.email_enabled`, Standard `false`).

## Weg der Meldung

1. `create_notification` schreibt die Meldung wie bisher in `notifications`.
2. Der Trigger `enqueue_decision_notification_email` legt für Typen
   `task_decision_%` genau eine Zeile in `decision_notification_email_dispatches` an,
   wenn `email_enabled` **und** `is_enabled` der Person für diesen Typ gelten.
3. Der alle fünf Minuten laufende Worker `dispatch-decision-notification-emails`
   übernimmt fällige Zeilen atomar (`claim_decision_notification_email_dispatches`,
   `FOR UPDATE SKIP LOCKED`), prüft die Einstellung erneut, holt die Adresse aus
   `auth.users`, rendert Titel, Text und Link zur Entscheidung und versendet über
   Resend.
4. `finish_decision_notification_email_dispatch` verbucht `sent`, `skipped` oder
   `retry`. Nach drei Fehlversuchen bleibt die Zeile `failed`; fehlende Adresse und
   abgeschalteter Schalter werden als `skipped` verbucht, nicht als Fehler.

## Frequenz und Ruhezeiten

- `immediate`: jede aktivierte Meldung geht sofort per E-Mail raus.
- `digest`: gebündelte Typen (Anfrage, Kommentar, Antwort, Reaktion, Ergebnis) gehen
  **nicht** einzeln per E-Mail; die Digest-Meldung `task_decision_digest` übernimmt den
  Versand. Das Ergebnis des Erstellers bleibt sofort.
- `off`: gebündelte Typen werden nicht per E-Mail versendet. Frist-, Rückzugs-,
  Alarm-, Erwähnungs-, Digest- und Tagesüberblicksmeldungen bleiben erreichbar, weil
  sie auch in der App nicht unterdrückt werden.
- Ruhezeiten verwerfen keine Mail: `decision_quiet_hours_end_at` setzt `defer_until`,
  der Worker übernimmt die Zeile erst nach Ende der Ruhezeit.

## Oberfläche

In den Benachrichtigungseinstellungen zeigen nur Entscheidungs-Meldungstypen einen
E-Mail-Schalter; alle anderen Bereiche tragen an dieser Stelle ein ausgegrautes
E-Mail-Symbol mit dem Hinweis, dass E-Mail derzeit nur für Entscheidungen zugestellt
wird. Die Karte „Entscheidungs-Meldungen“ erklärt, dass die E-Mail-Schalter der
gewählten Zustellfrequenz folgen.

## Betrieb

Benötigte Secrets der Edge Function: `RESEND_API_KEY` und eine App-URL
(`PUBLIC_APP_URL`, `APP_URL`, `SITE_URL` oder `VITE_PUBLIC_APP_URL`) für den Link.
Fehlt eines davon, antwortet der Worker mit 503 und die Zeilen bleiben `pending`.
Absender ist `Entscheidungs-Meldungen <noreply@alexander-salomon.de>`; die Adresse
kommt aus `auth.users`, nicht aus Profilfeldern.

## Prüfung

`decision_notification_email_selftest` prüft: Outbox-Zeile bei aktivierter E-Mail im
Sofort-Modus, keine Zeile bei abgeschaltetem Schalter, keine Einzelmail im
Digest-Modus (aber Mail für die Digest-Meldung), sofortige Mail für das Ergebnis des
Erstellers, Erwähnungen trotz Modus `off`, Zurückstellen während der Ruhezeiten samt
Ausbleiben im selben Lauf sowie Übernahme und Verbuchung als `sent`. Der
Szenario-Schritt heißt `notification-email`.

Nicht geprüft: echter Resend-Versand, echter Cron-Lauf und die Darstellung der
Einstellungen im Browser.
