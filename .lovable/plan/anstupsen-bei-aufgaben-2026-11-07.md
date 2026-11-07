# Anstupsen bei Aufgaben

## Ziel
Wenn eine Aufgabe bei jemand anderem liegt („Wartet auf andere“), kann ich die Person **anstupsen**. Die Aufgabe springt dann bei ihr deutlich sichtbar nach oben, statt nur still in der Liste zu stehen.

## So funktioniert es
1. In „Wartet auf andere“ und im Detailbereich gibt es den Knopf **„Anstupsen“**, optional mit kurzer Nachricht, z. B. „Brauche das bis Mittwoch“.
2. Wer gerade am Zug ist, bekommt:
   - eine Benachrichtigung (auch per Push, wenn aktiviert),
   - die Aufgabe ganz oben in „Mein Zug“ in einem eigenen Block **„Angestupst“**, farbig hervorgehoben, mit Name, Zeitpunkt und Nachricht,
   - im Detailbereich einen auffälligen Hinweis mit **„Gesehen“** (Hinweis verschwindet) oder **„Antworten“** (Notiz geht in den Verlauf, die anstupsende Person wird benachrichtigt).
3. Mehrfaches Anstupsen ist höchstens **einmal pro Tag** möglich. Die Zahl wird angezeigt („2× angestupst“), damit es nicht nervt, aber Dringlichkeit sichtbar bleibt.
4. Jedes Anstupsen und jedes „Gesehen“ landet im Verlauf der Aufgabe.
5. Wen man anstupst: die verantwortliche Person, sonst bei „Abgeordnete/r“ die Abgeordneten des Büros. Bei „Extern“ gibt es nur die eigene Erinnerung.

Die eigene Erinnerung aus dem letzten Schritt (Morgen/In 3 Tagen/Nächste Woche) bleibt als „Mich erinnern“ erhalten.

## Technische Details
- `tasks`: neue Felder `nudged_at`, `nudged_by`, `nudge_note`, `nudge_count`, `nudge_seen_at`.
- RPC `nudge_task(task_id, note)` (security definer, tenant-geprüft): prüft das 24-Stunden-Limit, setzt die Felder, schreibt den Verlauf und ruft `create_notification` für die Empfänger auf. RPC `ack_task_nudge(task_id, reply)` für „Gesehen“/„Antworten“.
- `stafette.ts`: `isNudgeActive`, `canNudge` (24-Stunden-Regel), Zone „nudged“ vor „mine“; Verlaufstexte. Plus Unit-Tests und ein Logikschritt im Selbsttest der Aufgaben-Stafette.
- UI: neuer Abschnitt in `TaskTriageList`, Hinweisbanner und Knopf in `TaskDetailView`, Darstellung mit Design-Tokens (Akzent).
