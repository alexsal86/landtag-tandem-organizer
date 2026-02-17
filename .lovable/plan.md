

## Problem: Falsche Phasen-Vergleiche in der Verifizierung

Der Code vergleicht `verificationRequest.phase` mit Strings wie `'requested'`, `'ready'`, `'started'` usw. Aber das SDK verwendet **numerische Enum-Werte**:

```text
VerificationPhase.Unsent    = 1
VerificationPhase.Requested = 2
VerificationPhase.Ready     = 3
VerificationPhase.Started   = 4
VerificationPhase.Cancelled = 5
VerificationPhase.Done      = 6
```

Das bedeutet: Alle `if (phase === 'requested')` Checks sind immer `false`, weil `phase` z.B. `2` ist, nicht `'requested'`. Dadurch werden eingehende Verifizierungen nie akzeptiert und ausgehende warten nicht korrekt auf den anderen Client.

## Loesung

### Aenderung in `src/contexts/MatrixClientContext.tsx`

**1) Import hinzufuegen:**

```typescript
import { VerificationPhase } from 'matrix-js-sdk/lib/crypto-api/verification';
```

(Neben dem bestehenden Import von `VerifierEvent` und `Verifier`)

**2) Eingehende Verifizierung (Zeilen 507-546) -- String-Vergleiche durch Enum ersetzen:**

Alle Vorkommen von:
- `verificationRequest.phase === 'requested'` wird zu `verificationRequest.phase === VerificationPhase.Requested`
- `'ready'` wird zu `VerificationPhase.Ready`
- `'started'` wird zu `VerificationPhase.Started`
- `'cancelled'` wird zu `VerificationPhase.Cancelled`
- `'done'` wird zu `VerificationPhase.Done`

**3) Ausgehende Verifizierung (Zeilen 794-811) -- gleiche Korrektur:**

`(verificationRequest as any).phase !== 'started'` wird zu `(verificationRequest as any).phase !== VerificationPhase.Started`

Und in der `checkReady`-Funktion:
- `phase === 'ready' || phase === 'started'` wird zu `phase === VerificationPhase.Ready || phase === VerificationPhase.Started`

## Zusammenfassung

| Datei | Aenderung |
|---|---|
| `src/contexts/MatrixClientContext.tsx` | `VerificationPhase` importieren |
| `src/contexts/MatrixClientContext.tsx` | Alle String-Phasen-Vergleiche in der eingehenden Verifizierung durch Enum-Werte ersetzen |
| `src/contexts/MatrixClientContext.tsx` | Alle String-Phasen-Vergleiche in der ausgehenden Verifizierung durch Enum-Werte ersetzen |

### Danach testen

1. Crypto Store zuruecksetzen
2. Neu verbinden (Passwort-Login)
3. Verifizierung von Element auf dem Handy starten -- die App sollte jetzt die Anfrage erkennen und Emojis anzeigen
4. Verifizierung von der App starten -- Element sollte reagieren

