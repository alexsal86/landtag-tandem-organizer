# Entscheidungs-Einladungen: serverseitige Outbox

## Warum

Der E-Mail-Versand hing bisher am Client: `send-decision-email` wurde nur aus
`useDecisionCreator` und `NoteDecisionCreator` aufgerufen, und nur wenn dort
„per E-Mail senden“ gewählt war. Teilnehmende, die über den Bearbeiten-Dialog oder
einen API-Weg hinzukommen, erhielten keine Einladung. Zwei Wege pflegten dieselbe
Absicht getrennt.

## Ablauf

1. `task_decisions.invite_via_email` hält die Absicht des Erstellers fest. Der Client
   setzt sie nach dem Anlegen über `request_decision_email_invites(decision_id)`, wenn
   „per E-Mail senden“ aktiv war. Die Funktion setzt ausschließlich dieses Feld, prüft
   `created_by = auth.uid()` und die Mandantenmitgliedschaft und gibt `false` zurück,
   wenn die Entscheidung nicht dem Aufrufer gehört. Ein direktes Tabellen-Update ist
   damit nicht nötig; der Standard bleibt `true`, wie im Dialog.
2. Der Trigger `trg_decision_invitation_dispatch` stellt bei jedem
   `task_decision_participants`-Insert genau eine Zeile in
   `decision_invitation_dispatches` ein (`pending`). Ein Fehler dabei wird nur
   gewarnt und rollt den Teilnehmer-Insert nicht zurück.
3. `claim_decision_invitation_dispatches(limit)` übernimmt fällige Zeilen mit
   `FOR UPDATE SKIP LOCKED`, setzt sie auf `processing` und erhöht `attempts`.
   Ohne freigegebene Entscheidung bleiben Zeilen liegen und werden nach einer Stunde
   als `skipped` verbucht. Nach sieben Tagen oder drei Fehlversuchen endet der Versuch.
4. Der Cron `dispatch-decision-invitations` ruft alle fünf Minuten die Edge Function
   `dispatch-decision-invitations` mit Service-Role auf.
5. Der Worker prüft, ob die Empfängerin oder der Empfänger `task_decision_request`
   in den eigenen Einstellungen abgeschaltet hat. Wenn ja, wird die Zeile als
   erledigt verbucht, ohne Mail. Sonst ruft er `send-decision-email` im internen
   Modus auf und verbucht Erfolg oder Fehler über
   `finish_decision_invitation_dispatch`.

Genau eine Zustellung je Teilnehmer-Insert ergibt sich aus dem Unique-Index auf
`participant_id` plus der atomaren Übernahme. Wiederholte Läufe senden eine
`processing`-Zeile nicht erneut; schlägt der Versand fehl, wird sie bis zu dreimal
erneut versucht.

## Interner Modus von `send-decision-email`

Der bestehende Renderer bleibt die einzige Stelle, die Vorlage, Antwortlinks und
Resend-Aufruf kennt. Er akzeptiert zusätzlich einen internen Weg bei gültiger
Service-Role. `DECISION_DISPATCH_SECRET` ist eine zusätzliche Absicherung, keine
Voraussetzung: Fehlt der Header, bleibt der interne Weg nutzbar; wird ein Secret
mitgeschickt, muss es zum konfigurierten Wert passen. Damit legt weder ein gar nicht
noch ein nur auf einer Seite gesetztes Secret den gesamten Einladungsversand still. Der Mandant kommt aus dem Body und der
Entscheidungsdatensatz wird weiterhin auf diesen Mandanten geprüft.

Interne Aufrufe haben keinen Origin/Referer. Deshalb übergibt der Worker die
App-Basis-URL explizit als `app_base_url` (aus `PUBLIC_APP_URL`, `APP_URL`,
`SITE_URL` oder `VITE_PUBLIC_APP_URL`); der Renderer verlangt sie im internen Modus
und baut die Antwortlinks daraus. Fehlt sie im Worker, bleibt der Lauf bei 503 und
die Zeilen bleiben pending, statt Links auf den Supabase-Host zu verschicken.

## Matrix

Ein ausgehender Matrix-Versand für Einladungen existiert nicht.
`matrix-decision-handler` verarbeitet nur eingehende Antworten. Das Matrix-Kästchen
im Dialog hat daher weiterhin keine serverseitige Entsprechung; die Absicht wird
nicht gespeichert. Das ist bewusst offen und keine stille Behauptung von
Matrix-Zustellung.

## Prüfung

`decision_invitation_dispatch_selftest(p_tenant)` legt eine Entscheidung **ohne**
Freigabe an, fügt den Aufrufer als Teilnehmer hinzu und prüft, dass die Zeile zwar
eingestellt, aber vom Worker noch nicht übernehmbar ist. Dann prüft es, dass eine
fremde Entscheidungs-ID über `request_decision_email_invites` wirkungslos bleibt,
setzt die Freigabe über denselben RPC, übernimmt die Zeile, verbucht Erfolg und rollt
alles zurück. Der Szenario-Schritt `invitation-dispatch` in `decision-lifecycle` ruft
ihn auf. Nicht geprüft: echter Resend-Versand, Cron-Laufzeit und der Ablauf im Worker.
