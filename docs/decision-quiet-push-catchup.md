# Ruhezeiten-Catch-up für Entscheidungs-Pushes

Pushes, die während der persönlichen Ruhezeiten unterdrückt werden, werden nach
deren Ende genau einmal nachgeholt. Das gilt für Sofortmeldungen und für den
Digest selbst. Einzelmeldungen im Modus „gebündelt“ werden weiterhin nicht
einzeln gepusht; für sie übernimmt der Digest die Zustellung.

## Ablauf

1. Der zentrale Trigger `notification_push_trigger` prüft bei jedem Insert
   Frequenzmodus, Ruhezeiten und die Push-Einstellung der Person.
2. Ist der Push nur wegen der Ruhezeit blockiert und existiert mindestens ein
   aktiver Web- oder Mobile-Kanal, setzt der Trigger `push_deferred_until` auf
   das Ende der Ruhezeit. Die Meldung selbst bleibt ungelesen in der App.
3. `dispatch_deferred_decision_pushes()` läuft alle fünf Minuten. Fällige
   Meldungen werden unter einer Advisory Lock und mit `FOR UPDATE SKIP LOCKED`
   beansprucht: `push_deferred_until` wird vor dem externen Aufruf geleert und
   `push_catchup_sent_at` gesetzt.
4. Gelesene oder verfallene Meldungen werden nicht nachgeholt; ihre Pufferung
   wird ohne Push entfernt. Ohne aktiven Kanal oder bei inzwischen geändertem
   Modus wird ebenfalls nicht gesendet.
5. Web- und Mobile-Push nutzen denselben Nachhol-Lauf. Der Mobile-Trigger prüft
   Ruhezeiten und Modus ebenfalls, damit kein Kanal die Sperre umgeht.

## Doppelzustellungen

- Pro Meldung existiert nur ein Puffer; der Nachhol-Lauf beansprucht ihn vor
  dem HTTP-Aufruf.
- Ein zweiter Lauf findet dieselbe Meldung nicht mehr.
- Einzelmeldungen im Digest-Modus erhalten keinen eigenen Puffer.
- Bereits gelesene Meldungen werden nie nachgeholt.

## Prüfung

`decision_quiet_push_catchup_selftest` prüft die Pufferung einer Sofortmeldung,
den einmaligen Nachholversand, den ausbleibenden zweiten Versand, die Pufferung
des Digests und die fehlende Pufferung einer Einzelmeldung im Digest-Modus. Der
Selbsttest läuft mit `_deliver = false`, damit kein echter HTTP-Aufruf entsteht.
Der Szenario-Schritt heißt `quiet-push-catchup`.

Nicht geprüft: echter Cron-Lauf, tatsächlicher Push-Versand, Mobile-Zustellung
und das Verhalten bei einer Änderung der Ruhezeiten während des Nachholfensters.
