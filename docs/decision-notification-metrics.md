# Kennzahlen der Entscheidungs-Meldungen

`notification_metrics(tenant_id, days)` liefert je Mandant und Zeitraum (1–365 Tage,
Standard 30) ein JSON-Objekt für die Wirkungsmessung. Alle aktiven Büromitglieder dürfen
die aggregierten Zahlen lesen; personenbezogene Einstellungen werden nicht einzeln
ausgegeben.

## Kennzahlen

| Bereich | Inhalt |
|---|---|
| `deliveries` | `in_app` (Meldungen im Zeitraum), `push` (`is_pushed` oder `push_sent_at`), `email_sent`/`email_failed` aus `decision_invitation_dispatches` |
| `opt_out_by_type` | je Entscheidungstyp: deaktivierte Einstellungen, aktive Mitglieder und Quote |
| `first_response` | Anzahl ausgewerteter Entscheidungen, durchschnittliche und mediane Minuten von der ersten Teilnehmerzeile bis zur ersten Antwort |
| `nudges` | Anzahl Anstupser, Antworten innerhalb von 24 Stunden danach und Trefferquote |
| `trigger_errors` | protokollierte Trigger-Ausnahmen, Fehler der letzten 24 Stunden, Fehlerquote und `alarm` |

Die Trigger-Fehlerquote bezieht sich auf Meldungen plus Fehler im Zeitraum. `alarm` ist
`true`, sobald in den letzten 24 Stunden mindestens eine Trigger-Ausnahme protokolliert
wurde.

## Trigger-Ausnahmen

Die Entscheidungs-Trigger fangen Fehler weiterhin ab, damit Kommentare, Antworten und
Friständerungen nicht an einer Meldung scheitern. Zusätzlich schreibt jeder Handler eine
Zeile in `decision_notification_trigger_errors` (Quelle, Mandant, Entscheidung, Meldung).
Die Protokollierung ist selbst fehlertolerant. Büroleitungen dürfen die Tabelle lesen.

## Prüfung

`decision_notification_metrics_selftest(p_tenant)` erzeugt eine Entscheidung mit Antwort,
liest die Kennzahlen, protokolliert einen erwarteten Trigger-Fehler und prüft, dass
Fehlerzahl und Alarm steigen. Der Szenario-Schritt `notification-metrics` ruft ihn auf;
alles wird zurückgerollt. Nicht geprüft: echte Cron-/Push-Zustellung, E-Mail-Versand und
die Darstellung in einer Oberfläche (es gibt noch keine Kennzahlenansicht).
