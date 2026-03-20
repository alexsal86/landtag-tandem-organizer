# Öffentliche Veranstaltungs-Einladungen

## Schutzmaßnahmen für Public Links

- Jeder öffentliche RSVP-Link erhält ein `expires_at`. Beim Versand wird standardmäßig eine Laufzeit von 45 Tagen vergeben; liegt der Termin später, bleibt der Link mindestens bis 14 Tage nach dem bestätigten Veranstaltungstermin gültig.
- Einzelne Links können über `revoked_at` sofort widerrufen werden. Ein späterer UI-Button **„Einladungslink neu erzeugen“** soll intern einen alten Link widerrufen und direkt einen neuen Datensatz anlegen.
- Für bereits abgelaufene Links erzeugt der Versandprozess automatisch einen neuen Link, damit verlorene oder abgelaufene URLs nicht still weiterverwendet werden.

## Verhalten bei Mehrfachklicks und bereits beantworteten Einladungen

- Aktuell gilt die Policy `latest_wins`: Mehrfachklicks oder spätere Änderungen überschreiben die zuvor gespeicherte Antwort.
- Die öffentliche Seite zeigt diese Policy explizit an, damit Gäste wissen, dass eine spätere Änderung möglich ist.
- Falls später eine strengere Policy benötigt wird, ist die API bereits so vorbereitet, dass statt `latest_wins` eine gesperrte Variante (`locked`) ausgeliefert werden kann.

## Rate Limits

- `get-public-event-invitation` verwendet ein Lookup-Limit pro IP-Adresse (`30` Requests / Minute).
- Zusätzlich gibt es ein engeres Limit für ungültige Lookup-Versuche (`10` Requests / Minute), um Enumeration über unbekannte Codes schneller zu bremsen.
- `respond-public-event-invitation` verwendet ein Schreib-Limit pro IP-Adresse (`20` Requests / Minute) sowie ein separates Limit für fehlerhafte/ungültige Requests (`8` Requests / Minute).
- Alle öffentlichen Antworten liefern Rate-Limit-Header zurück, damit Reverse Proxies oder spätere WAF-Regeln daran andocken können.

## Strukturierte Logs

Fehlerfälle werden mit `audit_type`, `status`, `endpoint`, Zeitstempel und Zusatzfeldern geloggt. Besonders relevant sind:

- `invalid_code` mit `failure_reason = "unknown_code"`
- `expired` mit `failure_reason = "expired_code"`
- `revoked` mit `failure_reason = "revoked_code"`

## CAPTCHA-Vorbereitung

- Die Schreib-API akzeptiert bereits optionale Felder `captcha_token` und `captcha_provider`.
- Aktuell ist CAPTCHA standardmäßig **nicht** aktiviert; die Standard-Implementierung lässt Requests daher passieren.
- Eine spätere Aktivierung kann über einen austauschbaren Verifier erfolgen, ohne dass sich das Frontend-Protokoll erneut ändern muss.
