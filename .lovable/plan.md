

## Fix: Verification bricht nach Emoji-Matching ab (m.user_error)

### Ursache

Drei zusammenhaengende Probleme fuehren dazu, dass die Verifizierung nach dem Emoji-Abgleich abbricht:

1. **`confirm()` in `setupVerifierListeners` raeumt den State zu frueh auf** (Zeile 158-160): `setActiveSasVerification(null)` wird sofort nach `sas.confirm()` gesetzt, bevor `verifier.verify()` den Handshake abschliessen kann. Die andere Seite sieht dann keinen aktiven Verifier mehr und bricht mit `m.user_error` ab.

2. **Incoming-Verification: `void verifier.verify()` hat keinen Cleanup** (Zeile 608): Wenn `verify()` fehlschlaegt oder erfolgreich abschliesst, wird der State nie aufgeraeumt.

3. **Timeout von 30s ist zu kurz + kein explizites Cancel bei Abbruch** (Zeile 596-600): Bei Timeout oder Cancel wird die andere Seite nicht informiert.

### Aenderungen in `src/contexts/MatrixClientContext.tsx`

**1. `setupVerifierListeners` -- confirm() raeumt State nicht mehr selbst auf (Zeilen 157-161)**

Vorher:
```text
confirm: async () => {
  await sas.confirm();
  setActiveSasVerification(null);
  setLastVerificationError(null);
},
```

Nachher:
```text
confirm: async () => {
  try {
    await sas.confirm();
    // State-Cleanup erfolgt durch verifier.verify().then()
    // NICHT hier null setzen -- sonst Race Condition
  } catch (e) {
    setLastVerificationError(e instanceof Error ? e.message : 'Bestaetigung fehlgeschlagen');
    setActiveSasVerification(null);
  }
},
```

**2. Incoming-Verification: Timeout auf 60s + explizites Cancel + verify()-Cleanup (Zeilen 576-612)**

- Timeout von 30s auf 60s erhoehen
- `reject()` durch `resolve('ok' | 'cancelled' | 'timeout')` ersetzen -- sauberes Signal ohne Exception
- Bei `timeout` oder `cancelled`: explizit `verificationRequest.cancel()` aufrufen damit die andere Seite informiert wird
- `void verifier.verify()` erhaelt `.then()` und `.catch()` fuer State-Cleanup (wie bei outgoing)

**3. Keine weiteren Dateien betroffen**

### Technische Details

| Stelle | Zeilen | Aenderung |
|---|---|---|
| `setupVerifierListeners` confirm | 157-161 | Kein `setActiveSasVerification(null)` mehr in confirm, nur im Fehlerfall |
| Incoming wait-Promise | 576-601 | Timeout 60s, resolve-basiert statt reject, explizites cancel |
| Incoming verify() | 606-609 | `.then()/.catch()` Cleanup wie bei outgoing (Zeilen 933-942) |

