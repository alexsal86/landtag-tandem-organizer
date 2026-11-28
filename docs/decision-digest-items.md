# Aufklappbarer Digest

Die Digest-Meldung (`task_decision_digest`) enthält neben der Anzahl eine Liste
`digest_items`. Jeder Eintrag beschreibt eine gebündelte Einzelmeldung:

| Feld | Bedeutung |
|---|---|
| `type` | ursprünglicher Meldungstyp (Kommentar, Antwort, Reaktion, Ergebnis) |
| `actor_name` | Person, die kommentiert bzw. reagiert hat |
| `comment_id` | Kommentar für den Deep Link |
| `emoji` | Reaktion, falls vorhanden |
| `excerpt` | gekürzter Kommentartext |
| `created_at` | Zeitpunkt der Einzelmeldung |

Die Liste wird beim Flush aus den ersetzten Meldungen gebildet. Die bisherigen
`notification_ids`, `count`, `result_count` und `has_result` bleiben erhalten.

## Oberfläche

Im Benachrichtigungscenter zeigt die Digest-Meldung „N Einzelmeldungen anzeigen“. Aufgeklappt
erscheinen Person, Art, Reaktion und Kommentarauszug; ein Klick springt über
`/decisions?highlight=<decision_id>&comment=<comment_id>` zur Entscheidung. Ergebnisse
haben keine Person und werden nur als „Ergebnis“ angezeigt; die UI ignoriert auch den
früheren Fallback „Ein Teammitglied“ in alten Digests. Kommentar- und Reaktionseinträge
behalten ihre Person.

## Prüfung

`decision_digest_items_selftest` prüft drei Einträge (Kommentar, Reaktion, Ergebnis),
Person und Auszug beim Kommentar, Emoji bei der Reaktion und die Entscheidungs-ID für den
Deep Link. `decision_digest_result_actor_selftest` prüft zusätzlich, dass das Ergebnis
keine Person hat, Kommentar und Reaktion sie aber behalten. Die Szenario-Schritte heißen
`digest-items` und `digest-result-person`.

Nicht geprüft: Browserdarstellung, echter Push-Versand und ein Cron-Lauf.
