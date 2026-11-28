# Direkte Erwähnungen in Entscheidungskommentaren

Ein Kommentar kann Personen mit `@Anzeigename` direkt erwähnen. Die Erkennung ist
groß-/kleinschreibungstolerant und verlangt ein eigenes Wort: `@Anna` trifft nicht
`@Annalena`.

## Zustellung

- Eigener Typ `task_decision_mention`, Priorität `high`.
- Wird **nicht** gebündelt und ist vom Digest ausgenommen.
- Wird auch bei persönlicher Frequenz `off` oder `digest` angelegt und gepusht.
- Ruhezeiten gelten weiterhin; die typbezogene Abschaltung
  (`user_notification_settings.is_enabled`) ebenfalls.
- Erwähnte Personen erhalten keine zusätzliche allgemeine Kommentarmeldung und keine
  doppelte Antwortmeldung.

Die Erkennung liegt in `decision_comment_mentions(content, tenant_id)`, die Zustellung
im Trigger `notify_decision_comment`.

## Prüfung

`decision_mention_notification_selftest` prüft: Erwähnung trotz `off`, keine doppelte
`task_decision_comment_received`, kein Digest-Eintrag im Modus `digest`. Der
Szenario-Schritt heißt `comment-mentions`.

Nicht geprüft: ein Mention-Autovervollständigen im Kommentarfeld (es gibt noch keins;
die Erwähnung wird als Text erkannt), echter Push-Versand und die Darstellung im
Browser.
