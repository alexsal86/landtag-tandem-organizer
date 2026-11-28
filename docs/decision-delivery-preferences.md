# Persönliche Zustellfrequenz und Ruhezeiten

Entscheidungs-Meldungen lassen sich je Person und Mandant steuern:

| Modus | Verhalten |
|---|---|
| `immediate` | Meldung und Push sofort; Push nur außerhalb der Ruhezeiten |
| `digest` | Meldung wird gesammelt; Push erst mit dem Digest |
| `off` | keine unkritischen Entscheidungs-Meldungen |

Gespeichert in `decision_notification_preferences` (eine Zeile je Person und Mandant).
Gesetzt über `set_decision_notification_preference(tenant_id, delivery_mode)` und in den
Benachrichtigungseinstellungen unter „Entscheidungs-Meldungen“ wählbar.

## Standard

- Bestehende aktive Mitgliedschaften wurden einmalig auf `digest` gesetzt, weil der
  Digest vor der persönlichen Frequenz für alle aktiv war. Explizite Einstellungen
  bleiben unangetastet.
- Neue Nutzer ohne Zeile starten mit `immediate`; die Karte zeigt diesen Standard an.

Die Karte zeigt die Frequenz des aktuellen Arbeitsbereichs und speichert über die RPC.
Frist-, Rückzugs-, Alarm- und Erwähnungsmeldungen bleiben von der Frequenz ausgenommen.

## Kritische Ausnahmen

`task_decision_deadline_changed`, `task_decision_withdrawn` und
`task_decision_trigger_alert` werden immer sofort erzeugt und gepusht — unabhängig von
Ruhezeiten und `off`. Die typbezogene Abschaltung über
`user_notification_settings.is_enabled` bleibt davon unberührt.

## Ruhezeiten-Catch-up

Wird ein Push ausschließlich wegen der Ruhezeit unterdrückt, setzt der zentrale
Push-Trigger `push_deferred_until` auf das Ende der Ruhezeit. Der alle fünf Minuten
laufende `dispatch_deferred_decision_pushes()` holt die Meldung danach genau einmal
nach; bereits gelesene oder inzwischen ungültige Meldungen werden übersprungen.
Einzelmeldungen im Modus „gebündelt“ bleiben vom Catch-up ausgenommen, weil der
Digest sie bündelt. Details: [decision-quiet-push-catchup.md](decision-quiet-push-catchup.md).

## E-Mail-Kanal

Die E-Mail-Schalter je Meldungstyp gelten für Entscheidungs-Meldungen und folgen
derselben Frequenz: Bei `digest` übernimmt die Digest-Meldung die E-Mail, bei `off`
entfallen die gebündelten Typen. Frist-, Rückzugs-, Alarm-, Erwähnungs- und
Digest-Meldungen bleiben erreichbar, solange der E-Mail-Schalter des Typs aktiv ist.
Ruhezeiten stellen den Versand zurück, statt die Mail zu verwerfen. Für alle anderen
Bereiche zeigt die Oberfläche kein E-Mail-Schalter mehr an. Details:
[decision-notification-email.md](decision-notification-email.md).

## Durchsetzung

- `create_notification` verwirft unkritische Entscheidungs-Meldungen bei `off`.
- `decision_push_allowed(user, tenant, type, at)` entscheidet zentral über den Push:
  Modus, Ruhezeiten (Europe/Berlin, auch über Mitternacht) und kritische Ausnahmen.
- `flush_decision_notification_digests()` bündelt nur noch für Personen mit `digest`.
  Anfragen (`task_decision_request`) werden dabei mitgebündelt.
- Der Digest selbst ist von der Frequenzprüfung ausgenommen, unterliegt aber den
  Ruhezeiten.

## Prüfung

`decision_delivery_preference_selftest` prüft Bündelung, Unterdrückung bei `off`,
Ruhezeiten 22:00–08:00, Push außerhalb der Ruhezeiten und die sofortige Friständerung
trotz `off`. `decision_quiet_push_catchup_selftest` prüft den einmaligen Nachholversand
und die Vermeidung doppelter Pushes. Die Szenario-Schritte heißen
`delivery-preferences` und `quiet-push-catchup`. Nicht geprüft: echter Push-Versand,
Cron-Lauf und die Darstellung der Karte im Browser.
