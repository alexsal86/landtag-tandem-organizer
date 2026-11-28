# Kennzahlen der Entscheidungs-Meldungen

`notification_metrics(tenant_id, days)` liefert je Mandant und Zeitraum (1–365 Tage,
Standard 30) ein JSON-Objekt für die Wirkungsmessung. Alle aktiven Büromitglieder dürfen
die aggregierten Zahlen lesen; personenbezogene Einstellungen werden nicht einzeln
ausgegeben.

## Kennzahlen

| Bereich | Inhalt |
|---|---|
| `deliveries` | `in_app` (Meldungen im Zeitraum), `push` (`is_pushed` oder `push_sent_at`), `email_sent`/`email_failed` aus `decision_invitation_dispatches`, `email_notifications_sent`/`email_notifications_failed` aus `decision_notification_email_dispatches` |
| `opt_out_by_type` | je Entscheidungstyp: deaktivierte Einstellungen, aktive Mitglieder und Quote |
| `first_response` | Anzahl ausgewerteter Entscheidungen, durchschnittliche und mediane Minuten von der ersten Teilnehmerzeile bis zur ersten Antwort |
| `nudges` | Anzahl Anstupser, Antworten innerhalb von 24 Stunden danach und Trefferquote |
| `trigger_errors` | protokollierte Trigger-Ausnahmen, Fehler der letzten 24 Stunden, Fehlerquote und `alarm` |

Die Trigger-Fehlerquote bezieht sich auf Meldungen plus Fehler im Zeitraum. `alarm` ist
`true`, sobald in den letzten 24 Stunden mindestens eine Trigger-Ausnahme protokolliert
wurde.

## Ansicht für Super-Admins

Unter **Administration → Super-Admin → Wirkung der Meldungen** liegt das Panel
`DecisionNotificationMetricsPanel`. Es wählt Arbeitsbereich und Zeitraum (30, 90 oder 365
Tage), ruft `notification_metrics` auf und zeigt Zustellungen, E-Mail-Zahlen, die mediane
und durchschnittliche erste Antwortzeit sowie Trigger-Fehler mit Alarmstatus. Die
Abschaltungen erscheinen als Tabelle nach Quote sortiert; Büros unter drei Mitgliedern
bleiben in der Auswertung außen vor, damit einzelne Personen keine Quote dominieren.

Die Handlungshinweise kommen aus `buildNotificationEffectInsights`
(`src/features/notification-metrics/decisionNotificationEffect.ts`) und sind nach
Dringlichkeit sortiert:

| Hinweis | Schwelle |
|---|---|
| Trigger-Alarm | mindestens eine Ausnahme in den letzten 24 Stunden |
| Meiste Abschaltungen | Quote ab 20 % (ab 50 % als „Handeln“) |
| Push erreicht nur einen Teil | weniger als 50 % der In-App-Meldungen gepusht |
| Erste Antwort dauert | Median über 24 Stunden |
| Anstupser wirken selten | Trefferquote unter 30 % |
| E-Mail-Fehler | mindestens ein fehlgeschlagener Versand (Meldungen oder Einladungen) |

Ohne Meldungen, Antworten oder Anstupser im Zeitraum bleiben die betroffenen Hinweise
neutral statt einen Fehler zu behaupten. Die Ansicht ist auf Super-Admins beschränkt;
die RPC selbst verlangt weiterhin eine Mitgliedschaft im gewählten Arbeitsbereich.

## Trigger-Ausnahmen

Die Entscheidungs-Trigger fangen Fehler weiterhin ab, damit Kommentare, Antworten und
Friständerungen nicht an einer Meldung scheitern. Zusätzlich schreibt jeder Handler eine
Zeile in `decision_notification_trigger_errors` (Quelle, Mandant, Entscheidung, Meldung).
Die Protokollierung ist selbst fehlertolerant. Büroleitungen dürfen die Tabelle lesen.

## Prüfung

`decision_notification_metrics_selftest(p_tenant)` erzeugt eine Entscheidung mit Antwort,
liest die Kennzahlen, protokolliert einen erwarteten Trigger-Fehler und prüft, dass
Fehlerzahl und Alarm steigen. Der Szenario-Schritt `notification-metrics` ruft ihn auf;
alles wird zurückgerollt. Der Schritt `notification-effect-insights` prüft zusätzlich die
reine Auswertung der Ansicht (Sortierung der Abschaltungen, Schwellen, Formate).
Nicht geprüft: echte Cron-/Push-Zustellung, E-Mail-Versand und die Browserdarstellung.
