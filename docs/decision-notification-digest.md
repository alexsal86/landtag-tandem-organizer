# Gebündelte Entscheidungs-Meldungen (Digest)

Kommentar-, Antwort- und Reaktionsmeldungen zu einer Entscheidung werden nicht mehr
einzeln zugestellt, sondern je Empfänger und Entscheidung gebündelt.

## Ablauf

1. Die Trigger aus `20261128217000_decision_lifecycle_notifications.sql` schreiben
   weiterhin Einzelmeldungen. Sie sind die fachliche Quelle und tragen `decision_id`.
2. `flush_decision_notification_digests()` (pg_cron, alle 5 Minuten) gruppiert offene,
   nicht gelesene Meldungen der Typen
   `task_decision_comment_received`, `task_decision_comment_reply`,
   `task_decision_comment_reaction_received` sowie `task_decision_completed` je
   `tenant_id`, `user_id` und `decision_id`.
3. Ergebnismeldungen werden **nur für Teilnehmende außer dem Ersteller** gebündelt. Der
   Ersteller erhält sein Ergebnis weiterhin sofort, weil er die Entscheidung
   verantwortet. Frist- und Rückzugsmeldungen bleiben grundsätzlich sofort, weil sie
   zeit- bzw. statuskritisch sind.
4. Für jede Gruppe entsteht eine Meldung `task_decision_digest` mit Anzahl,
   Ergebnisanteil und Entscheidungsbezug, z. B. „Ergebnis und 2 neue Meldungen zu einer
   Entscheidung“. Die Einzelmeldungen werden auf `is_read = true` gesetzt und in `data`
   mit `superseded = true` sowie `digest_id` markiert.
5. Push wird nur für den Digest ausgelöst. `handle_notification_push()` überspringt die
   drei gebündelten Kommentar-/Reaktionstypen und Ergebnismeldungen an Teilnehmende; die
   Ergebnis-Meldung an den Ersteller und die Digest-Meldung durchlaufen die normalen
   Push-Einstellungen.

## Mandanteneinstellung

`tenant_notification_settings` (eine Zeile je Büro):

| Spalte | Bedeutung | Standard |
|---|---|---|
| `decision_reaction_window_minutes` | Sperrzeit für dasselbe Emoji auf demselben Kommentar | 5 |
| `decision_digest_minutes` | Wartezeit, bevor offene Meldungen gebündelt werden | 15 |

Die Werte 0–1440 sind für das Reaktionsfenster erlaubt (0 = keine Sperre), 1–1440 für
den Digest. Änderbar über `set_decision_notification_timing(tenant_id, reaction_minutes,
digest_minutes)` durch die Büroleitung des angegebenen Mandanten; Lesen dürfen alle
Büromitglieder. Eine
Oberfläche dafür gibt es noch nicht, die Einstellung ist über den RPC erreichbar.

## Prüfung

`decision_digest_selftest(p_tenant)` legt zwei Kommentare und eine Antwort an, altert
die daraus entstandenen Meldungen, ruft den Flush auf und prüft Digest-Anzahl,
Ergebnisanteil, `is_read`, `superseded` und dass der Ersteller keinen Digest erhält. Anschließend prüft es mit einem 60-Minuten-Fenster, dass dasselbe Emoji
nur eine Reaktionsmeldung erzeugt. Alles wird zurückgerollt. Der Szenario-Schritt
`digest` ruft ihn auf.

Wird der Digest während der Ruhezeit erzeugt, wird sein Push nach Ende der Ruhezeit
genau einmal über `dispatch_deferred_decision_pushes()` nachgeholt; die gebündelten
Einzelmeldungen selbst bleiben ohne eigenen Push. Details:
[decision-quiet-push-catchup.md](decision-quiet-push-catchup.md).

Nicht geprüft: echter Cron-Lauf, tatsächlicher Push-Versand, Gleichzeitigkeit zweier
Flush-Läufe und die Oberfläche der Einstellung.
