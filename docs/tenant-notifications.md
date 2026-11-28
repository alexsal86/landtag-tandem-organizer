# Mandantengebundene Meldungen aus dem Client

## Problem

`create_notification` mit sechs Argumenten löst den Mandanten über
`get_user_primary_tenant_id(empfänger)` auf. Wer in mehreren Büros Mitglied ist,
bekommt die Meldung dadurch unter Umständen im falschen Arbeitsbereich. Die
Sieben-Argument-Fassung nimmt den Mandanten zwar direkt, ist für `authenticated`
aber gesperrt, weil sie ihn ungeprüft übernehmen würde.

## Primitiv

`create_tenant_notification(user_id_param, type_name, title_param, message_param,
data_param, priority_param, tenant_id_param)` ist `SECURITY DEFINER` und prüft vor dem
Weiterreichen:

1. Es gibt eine angemeldete Person.
2. Ein Mandant ist angegeben.
3. Die aufrufende Person ist aktives Mitglied dieses Mandanten (`is_tenant_member`),
   sonst `42501`.
4. Die Priorität ist eine der erlaubten Stufen, sonst `22023`.

Erst danach ruft sie die Sieben-Argument-Fassung auf. Die Mitgliedschaft der
Empfängerin oder des Empfängers prüft weiterhin `create_notification`; wer nicht
Mitglied ist, erhält keine Zeile (`NULL`).

## Verwendung

Der Client übergibt den Mandanten des geladenen Fachobjekts, nicht den eigenen
Hauptmandanten: Aufgaben und Vorgänge nutzen `tenant_id` des Datensatzes, Termine,
Besprechungen, Freigaben, Mitteilungen, Pressemitteilungen, Briefe und Polls den
aktiven Mandanten aus `useTenant`, Erinnerungen an Zeiteinträge den Mandanten des
aufrufenden Bereichs. Fehlt der Mandant, wird die Meldung nicht abgeschickt statt
falsch zugestellt.

Entscheidungs-Meldungen nutzen dieses Primitiv nicht: Sie entstehen vollständig in
Triggern (siehe `docs/decision-notifications.md`).

## Prüfung

Der Selbsttest-Schritt `tenant-rpc` im Szenario `notification-inbox` legt eine Meldung
im eigenen Mandanten an und verlangt, dass derselbe Aufruf mit einem fremden,
zufälligen Mandanten mit `42501` abgewiesen wird. Der Schritt belegt damit die
Mitgliedschaftsprüfung, nicht die Zustellung an jede Empfängerrolle.
