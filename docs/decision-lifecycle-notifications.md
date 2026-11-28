# Lebenszyklus-Meldungen für Entscheidungen

Ergänzt die bestehenden Meldungen (Anfrage, Kommentar, Reaktion, Ersteller-Antwort,
Abschluss) um vier fachlich naheliegende Fälle. Alle Meldungen laufen über
`create_notification` im Mandanten der Entscheidung; Meldungsfehler werden gewarnt und
rollen die auslösende Änderung nicht zurück.

## Fälle

| Fall | Typ | Empfänger | Auslöser |
|---|---|---|---|
| Frist geändert oder entfernt | `task_decision_deadline_changed` | Teilnehmende außer der handelnden Person | `task_decisions.response_deadline` ändert sich, Status `active`/`open` |
| Rückzug vor der ersten Antwort | `task_decision_withdrawn` | Teilnehmende außer der handelnden Person | Status wechselt von `active`/`open` nach `archived`, noch keine Antwort |
| Ergebnis verfügbar | `task_decision_completed` | zusätzlich alle Teilnehmenden (der Ersteller wird weiterhin vom bestehenden Trigger bedient) | letzte Antwort geht ein, alle Teilnehmenden haben geantwortet |
| Direkte Antwort auf einen Kommentar | `task_decision_comment_reply` | ausschließlich der Autor des Elternkommentars | neuer Kommentar mit `parent_id`, Autor ist eine andere Person |
| `visible_to_all` ohne Teilnehmer | `task_decision_request` | alle aktiven Büromitglieder außer dem Ersteller | Entscheidung wird mit `visible_to_all = true` angelegt |

Der Ergebnis-Trigger dedupliziert je Empfänger und Entscheidung. Bei `visible_to_all`
übernimmt die breite Anfrage die Zustellung; der Teilnehmer-Insert meldet dann nicht
zusätzlich, sonst käme dieselbe Anfrage doppelt an. Ergebnis-Meldungen werden vor dem
Insert um `result_summary` und `result_counts` ergänzt; Details stehen in
[decision-result-summary.md](decision-result-summary.md).

## Bewusst stumm

- Titel-, Beschreibungs-, Prioritäts- und Optionsänderungen.
- Archivieren **nach** eingegangenen Antworten (normaler Abschluss, keine Meldung).
- Löschen einer Entscheidung.
- Reine Anhangs- oder Metadatenänderungen.
- Die handelnde Person erhält nie eine Meldung über ihre eigene Änderung.

## Statusmodell

`task_decisions.status` kennt kein eigenes `withdrawn`/`cancelled`. Ein Rückzug ist
deshalb als Archivieren vor der ersten Antwort definiert. Sobald eine Antwort vorliegt,
gilt das Archivieren als Abschluss und bleibt stumm.

## Prüfung

`decision_lifecycle_notification_selftest(p_tenant)` legt eine sichtbare Entscheidung
an, prüft die breite Anfrage, ändert die Frist, antwortet gezielt auf einen Kommentar,
lässt alle antworten und zieht eine zweite Entscheidung vor der ersten Antwort zurück.
Der Szenario-Schritt `lifecycle-notifications` ruft ihn auf; alles wird zurückgerollt.
Nicht geprüft: echte Zustellung per Push/E-Mail, Cron und Mehrbenutzer-Gleichzeitigkeit.
