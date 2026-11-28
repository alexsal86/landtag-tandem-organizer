# Inbox-Hygiene für Entscheidungs-Meldungen

## Öffnen und Antworten

`mark_decision_request_notifications_read(decision_id)` markiert ausschließlich die
Anfrage-Meldungen (`task_decision_request`) der angemeldeten Person zu genau dieser
Entscheidung als gelesen. Der Aufruf prüft den Zugriff auf die Entscheidung.

Die Detailansicht ruft die Funktion beim Öffnen auf; die Antwortabgabe ebenfalls. Die
frühere breite Aktualisierung über `navigation_context = 'decisions'` ist entfernt, damit
keine ungelesenen Hinweise zu anderen Entscheidungen verschwinden.

## Archivieren und Rückzug

Der Trigger `aaa_expire_decision_notifications` reagiert auf den Statuswechsel nach
`archived` und markiert offene Meldungen zu dieser Entscheidung als gelesen und
`expired`:

- Anfrage, Frist-Erinnerung, Digest
- Kommentar, Antwort, Reaktion, Erwähnung

Ergebnis- und Rückzugsmeldungen bleiben unangetastet. Da der Trigger vor dem
Lebenszyklus-Trigger läuft, bleibt eine neu erzeugte Rückzugsmeldung ungelesen.

## Prüfung

`decision_inbox_hygiene_selftest` prüft das Lesen beim Öffnen, das Verfallen der Anfrage
beim Archivieren (inklusive `expired_reason`) und die ungelesene Rückzugsmeldung. Der
Szenario-Schritt heißt `inbox-hygiene`.

Nicht geprüft: Browserdarstellung, echter Push-Versand und das Öffnen über andere Wege
als die Detailansicht.
