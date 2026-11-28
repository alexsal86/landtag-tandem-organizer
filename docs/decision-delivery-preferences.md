# Persönliche Zustellfrequenz und Ruhezeiten

Entscheidungs-Meldungen lassen sich je Person und Mandant steuern:

| Modus | Verhalten |
|---|---|
| `immediate` | Meldung und Push sofort; Push nur außerhalb der Ruhezeiten |
| `digest` | Meldung wird gesammelt; Push erst mit dem Digest |
| `off` | keine unkritischen Entscheidungs-Meldungen |

Gespeichert in `decision_notification_preferences` (eine Zeile je Person und Mandant).
Gesetzt über `set_decision_notification_preference(tenant_id, delivery_mode)`.

## Kritische Ausnahmen

`task_decision_deadline_changed`, `task_decision_withdrawn` und
`task_decision_trigger_alert` werden immer sofort erzeugt und gepusht — unabhängig von
Ruhezeiten und `off`. Die typbezogene Abschaltung über
`user_notification_settings.is_enabled` bleibt davon unberührt.

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
trotz `off`. Der Szenario-Schritt heißt `delivery-preferences`. Nicht geprüft: echter
Push-Versand, Browserdarstellung und die Einstellungsoberfläche (die RPC ist vorhanden,
eine eigene Karte in den Benachrichtigungseinstellungen fehlt noch).
