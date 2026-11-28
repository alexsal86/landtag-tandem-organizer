# Aggregierte Antwortzahlen im Ergebnis

Ergebnis-Meldungen und Ergebnis-Einträge im Digest nennen nicht nur „Ergebnis“,
sondern die Verteilung der abgegebenen Hauptantworten, zum Beispiel
„1 Dafür · 2 Dagegen · 1 Rückfrage“.

## Zählung

`decision_result_counts(decision_id)` liefert eine geordnete JSON-Liste aus
`key`, `label` und `count`. Grundlage ist je Teilnehmerin bzw. Teilnehmer die
letzte Hauptantwort (`parent_response_id IS NULL`); spätere Antwortänderungen
ersetzen die frühere Zählung, statt doppelt zu zählen.

Die Beschriftungen stammen aus `task_decisions.response_options`. Fehlt eine
Option oder hat sie keine Beschriftung, greift `decision_response_label` mit
`Ja`, `Nein`, `Rückfrage` bzw. dem Schlüssel als Fallback. Optionen ohne
Antworten erscheinen nicht in der Zusammenfassung.

`decision_result_summary(decision_id)` formatiert daraus den Text
`Anzahl Label · Anzahl Label`. Ohne Antworten lautet das Ergebnis
„Keine Antworten“.

## Ergebnis-Meldung

Der Trigger `enrich_decision_result_notification` läuft vor jedem Insert einer
Meldung vom Typ `task_decision_completed`. Er ergänzt `data.result_summary` und
`data.result_counts` und hängt die Zusammenfassung an den Meldungstext an. Das
gilt für die Meldung an den Ersteller, an Teilnehmende und für die
automatische Archivierungsmeldung.

## Digest

`flush_decision_notification_digests()` übernimmt `result_summary` in den
Ergebnis-Eintrag und in die Digest-Meldung. Für ältere Ergebnis-Meldungen ohne
gespeicherte Zusammenfassung berechnet der Flush sie aus der Entscheidung neu.
Das Benachrichtigungscenter zeigt sie hinter „Ergebnis“ an, z. B.
„Ergebnis · 1 Dagegen“.

## Prüfung

`decision_result_summary_selftest` legt eine Entscheidung mit eigenen
Antwortbeschriftungen an, antwortet mit „Dagegen“, prüft die Meldung an Ersteller
und Teilnehmer sowie den aufgeklappten Digest-Eintrag und rollt alles zurück.
Der Szenario-Schritt heißt `result-summary`.

Nicht geprüft: Browserdarstellung, echter Push-Versand und ein Cron-Lauf.
