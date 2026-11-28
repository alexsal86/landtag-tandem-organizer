# Entscheidungs-Meldungen und Mandantengrenze

Entscheidungs-Meldungen entstehen in der Datenbank, nicht in der Oberfläche. Der
Mandant kommt immer aus `task_decisions`; die 6-Argument-Fassung von
`create_notification` löst dagegen den Hauptmandanten der Empfängerin auf und trifft
bei mehreren Mitgliedschaften den falschen Arbeitsbereich.

## Trigger und Typen

| Auslöser | Tabelle | Typ | Empfänger |
|---|---|---|---|
| Teilnehmerin/Teilnehmer hinzugefügt | `task_decision_participants` (INSERT) | `task_decision_request` | neu hinzugefügte Person |
| Kommentar | `task_decision_comments` (INSERT) | `task_decision_comment_received` | Ersteller und alle Teilnehmenden außer der Verfasserin bzw. dem Verfasser |
| Emoji-Reaktion | `task_decision_comment_reactions` (INSERT) | `task_decision_comment_reaction_received` | Kommentarautor, Ersteller und Teilnehmende außer der reagierenden Person; je Empfänger, Kommentar und Emoji höchstens einmal in 5 Minuten |
| Kommentar an einer Antwort | `task_decision_responses` (INSERT/UPDATE) | `task_decision_comment_received` | Ersteller |
| Antwort des Erstellers auf eine Rückfrage | `task_decision_responses` (UPDATE) | `task_decision_creator_response` | betroffene Teilnehmerin bzw. Teilnehmer |
| Alle Teilnehmenden haben geantwortet | `task_decision_responses` (INSERT/UPDATE) | `task_decision_completed` | Ersteller, genau einmal je Entscheidung |

Bei Reaktionen prüft der Trigger vor dem Zustellen, ob für dieselbe Person bereits eine
Reaktionsmeldung zu diesem Kommentar und Emoji aus den letzten fünf Minuten existiert.
Entfernen und erneutes Setzen desselben Emojis bleibt damit für die Empfänger stumm;
ein anderes Emoji oder ein anderer Kommentar meldet weiterhin sofort. Dafür trägt die
Meldung `comment_id` und `emoji` im `data`-Feld. Die Sperre ist bewusst fest im Trigger
verankert und nicht pro Person konfigurierbar.

Alle Trigger sind `SECURITY DEFINER` mit `SET search_path = pg_catalog, public` und
prüfen die aktive Mitgliedschaft der Empfängerin bzw. des Empfängers im Mandanten der
Entscheidung. Wer nicht Mitglied ist, erhält keine Meldung.

Frist-Erinnerungen an Teilnehmende und Warnungen an den Ersteller entstehen nicht per
Trigger, sondern über `dispatch_decision_deadline_reminders()`. Die Ersteller-Warnung
nutzt denselben Typ, trägt `creator_warning=true` und nennt die Zahl fehlender
Antworten; Einzelheiten stehen in [decision-deadline-reminders.md](decision-deadline-reminders.md).

Der Meldungsteil ist von der Fachaktion entkoppelt: Die vier Trigger-Funktionen führen
ihre Arbeit in einem inneren Block mit `EXCEPTION WHEN OTHERS` aus. Ein Fehler beim
Auflösen oder Zustellen wird als `WARNING` mit Trigger-Name und Fehlertext protokolliert,
der Trigger liefert `NEW` zurück, und Kommentar, Reaktion, Antwort oder Teilnehmer-Insert
bleiben bestehen. Damit blockiert eine Meldungsstörung nicht mehr das Abstimmen oder
Diskutieren; sie ist im Postgres-Log sichtbar, nicht in der Oberfläche.

## Anstupsen aus dem Dashboard

`nudge_dashboard_decision` ruft `create_notification` bereits mit sieben Argumenten
und dem Mandanten der Entscheidung auf; Empfänger sind ausschließlich wartende,
aktive Abgeordnete dieses Mandanten. Der Selbsttest `decision_nudge_selftest` prüft
neben Anstups-Eintrag und 24-Stunden-Sperre, dass die Meldung `task_decision_request`
mit Priorität `high` für die anmahnende Person im Mandanten der Entscheidung liegt.
Wer den Typ in den eigenen Einstellungen abgeschaltet hat, wird als
`notification_suppressed_by_settings` ausgewiesen statt als Fehler.

`check_and_archive_decision` nutzt ebenfalls den Mandanten der Entscheidung. Die
automatische Archivierung ist derzeit nicht per Trigger aktiv; Entscheidungen bleiben
bis zur manuellen Archivierung aktiv.

## Oberfläche

Die Entscheidungsoberfläche verschickt keine eigenen `task_decision_*`-Meldungen mehr.
Sie speichert nur noch die Datensätze; Texte, Empfänger und Mandant entstehen
serverseitig. Damit gelten dieselben Regeln auch für die öffentliche Antwortseite und
für Einträge außerhalb der Oberfläche.

Die In-App-Anfrage entsteht jetzt unabhängig davon, ob zusätzlich E-Mail oder Matrix
versendet wird: Wer als Teilnehmerin oder Teilnehmer gespeichert ist, erhält die
Meldung. Die Oberfläche kann diesen Versand nicht mehr unterdrücken.

## Prüfung

`decision_notification_selftest(p_tenant)` legt eine echte Entscheidung mit zweiter
Person an, erzeugt Anfrage, Kommentar, Reaktion, Antwort und Ersteller-Antwort und
zählt die zugestellten Meldungen im Mandanten. Am Ende rollt ein `RAISE` die gesamte
Strecke zurück. Ohne zweite aktive Person im Büro meldet der Schritt ausdrücklich
„übersprungen“ statt zu bestehen.

Der Selbsttest deckt beide Seiten der Reaktions-Sperre ab: Er datiert die vorhandene
Meldung künstlich auf sechs Minuten zurück und reagiert erneut — dann muss genau eine
weitere Meldung entstehen (`reaction_window_expired`). Erst danach entfernt und setzt er
das Emoji innerhalb der Sperre erneut; die Zahl bleibt jetzt unverändert
(`reaction_window_blocked`). Zusätzlich prüft er, dass die Meldung `comment_id` und
`emoji` trägt.

Für Nicht-Mitglieder sucht der Test eine aktive Person, die kein Mitglied des
Entscheidungs-Mandanten ist, trägt sie als Teilnehmer ein und lässt sie in der
Kandidatenliste des Reaktionstriggers stehen. Anfrage- und Reaktionsmeldung dürfen für
sie nicht entstehen (`nonmember_notified`). Gibt es keine solche Person, meldet das
Ergebnis `nonmember_testable: false`, statt den Test künstlich zu bestehen.

Der Selbsttest-Schritt `notifications` im Szenario `decision-lifecycle` ruft diese
Funktion auf. Der statische Typ-Check `check:notification-types` stellt sicher, dass
alle fünf Typen im Standard-Seed stehen und ein Deep-Link-Ziel haben.
