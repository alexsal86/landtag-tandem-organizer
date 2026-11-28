# Bedienbare Entscheidungs-Meldungen

Meldungen springen nicht mehr nur in den Bereich, sondern öffnen die konkrete Stelle
und erlauben die Antwort direkt aus der Meldung.

## Direkt abstimmen

`task_decision_request`- und `task_decision_digest`-Meldungen zeigen in der
Benachrichtigungsliste die Schaltflächen **Ja**, **Nein** und **Rückfrage**. Sie rufen
`respond_to_decision(decision_id, response_type)` auf. Die RPC prüft:

- angemeldete Person und aktive Mandantenmitgliedschaft,
- Zugriff auf die Entscheidung über `user_can_access_task_decision`,
- Status `active`/`open`,
- eine Teilnehmerzeile der Person,
- Antworttyp `yes`, `no` oder `question`.

Eine bestehende Antwort wird aktualisiert, nicht dupliziert. Nach dem Speichern wird die
Meldung als gelesen markiert. Direkte Antworten sind nur für diese beiden Typen sichtbar;
Frist-, Ergebnis- oder Kommentarmeldungen zeigen keine Abstimmungsbuttons.

## Kommentar und Antwort fokussieren

Der Deep Link enthält jetzt zusätzlich `comment=<id>` bzw. `response=<id>`. Die
Entscheidungsseite öffnet daraufhin die Detailansicht und übergibt die ID an die
bestehende Hervorhebung (`highlightCommentId`/`highlightResponseId`), die den Eintrag
scrollt und fünf Sekunden markiert. `respond=1` öffnet die Detailansicht für eine
anstehende Abstimmung.

## „Angestupst“ mit Person und Anzahl

`dashboard_decision_nudges.nudge_count` zählt die Anstupser. Der erste Anstupser setzt
1, jeder weitere nach Ablauf der 24-Stunden-Sperre erhöht den Zähler. Das Dashboard
zeigt „Angestupst von … · 3× · heute um …“; bei einem einzelnen Anstupser entfällt die
Anzahl. Die Formatierung liegt in `decisionNudgeSummary` und wird im Szenario geprüft.

## Prüfung

`decision_notification_actions_selftest(p_tenant)` prüft Antwort, Aktualisierung
derselben Zeile, ungültigen Antworttyp und eine fremde Entscheidung. Der Szenario-Schritt
`notification-actions` ruft ihn auf; `dashboard-nudges` prüft die Anzeige von Person und
Anzahl. Nicht geprüft: echte Klicks in der Oberfläche, Scroll-Verhalten im Browser und
der Push-Versand.
