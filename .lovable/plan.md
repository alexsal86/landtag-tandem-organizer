

## Komplett-Fix: MatrixClientContext.tsx -- Alle verbleibenden Probleme

### Ursache des Verifizierungs-Abbruchs

Das Emoji-Matching funktioniert, aber die Verifizierung bricht ab, weil `bootstrapCrossSigning` mit einem leeren Auth-Dict (`{}`) aufgerufen wird. Der Homeserver lehnt das mit 401 ab, Cross-Signing wird nie eingerichtet, und Element auf dem Handy bricht die Verifizierung ab, weil die Cross-Signing-Keys fehlen.

**Loesung**: Das Passwort aus dem Login-Flow wird (temporaer, nur im Speicher) an `connect` durchgereicht, damit `bootstrapCrossSigning` eine echte UIA mit Passwort durchfuehren kann.

### Alle Aenderungen

#### 1. Passwort fuer UIA durchreichen

**MatrixCredentials** um optionales `password`-Feld erweitern. `handlePasswordLogin` in `MatrixLoginForm.tsx` gibt das Passwort mit an `connect()`. Das Passwort wird nur fuer `bootstrapCrossSigning` verwendet und danach verworfen (nicht in State/localStorage gespeichert).

```text
interface MatrixCredentials {
  userId: string;
  accessToken: string;
  homeserverUrl: string;
  deviceId?: string;
  password?: string;  // <-- NEU: nur fuer UIA, wird nicht persistiert
}
```

In `connect()` wird `bootstrapCrossSigning` dann so aufgerufen:

```text
await crypto.bootstrapCrossSigning({
  authUploadDeviceSigningKeys: async (makeRequest) => {
    await makeRequest({
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: localpart },
      password: creds.password,
    });
  },
});
```

Wenn kein Passwort vorhanden ist (z.B. bei Auto-Connect mit gespeichertem Token), wird der Bootstrap-Versuch mit leerem Dict beibehalten (Fallback, kann fehlschlagen).

#### 2. bootstrapSecretStorage nur wenn noetig

Vor dem Aufruf wird `isSecretStorageReady()` geprueft:

```text
const isReady = await crypto.isSecretStorageReady();
if (!isReady && recoveryKey) {
  await crypto.bootstrapSecretStorage({ ... });
}
```

#### 3. Auto-Connect Race Condition

Zusaetzlicher `connectCalledRef` wird eingefuehrt. Der Auto-Connect-Effect setzt diesen Ref beim ersten Aufruf und ignoriert weitere Trigger:

```text
const connectCalledRef = useRef(false);

useEffect(() => {
  if (credentials && !connectCalledRef.current && !isConnectingRef.current) {
    connectCalledRef.current = true;
    connect(credentials);
  }
}, [credentials]);
```

Bei `disconnect` und `resetCryptoStore` wird `connectCalledRef.current = false` zurueckgesetzt.

#### 4. updateRoomList als useCallback

```text
const updateRoomList = useCallback((matrixClient: sdk.MatrixClient) => {
  // ... bestehende Logik ...
}, []);
```

#### 5. sendMessage mit isConnected-Check

Da `isConnected` ein State ist und in `useCallback` mit `[]` Dependencies stale waere, wird stattdessen ein `isConnectedRef` eingefuehrt:

```text
const isConnectedRef = useRef(false);
// Synchron gehalten:
useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);

const sendMessage = useCallback(async (...) => {
  const mc = clientRef.current;
  if (!mc || !isConnectedRef.current) throw new Error('Nicht mit Matrix verbunden');
  // ...
}, []);
```

#### 6. Verification-Timeout und Cancel-Handling verbessern

In `requestSelfVerification`: Nach dem Warten auf "Ready"-Phase wird geprueft ob der Request noch gueltig ist bevor `startVerification` aufgerufen wird. Der Promise-Reject im Timeout wird sauber mit einem `finally`-Block aufgeraeumt:

```text
const checkReady = () => {
  const phase = (verificationRequest as any).phase;
  if (phase === VerificationPhase.Ready || phase === VerificationPhase.Started) {
    clearTimeout(timeout);
    resolve();
  } else if (phase === VerificationPhase.Cancelled || phase === VerificationPhase.Done) {
    clearTimeout(timeout);
    reject(new Error('Verifizierung wurde vom anderen Geraet abgebrochen.'));
  }
};
```

In `onVerificationRequestReceived` (eingehend): Der `change`-Listener wird nach Abschluss entfernt, und der `setTimeout`-Resolve wird per `clearTimeout` aufgeraeumt.

### Zusammenfassung der Datei-Aenderungen

| Datei | Aenderung |
|---|---|
| `src/contexts/MatrixClientContext.tsx` | (1) `password` in MatrixCredentials, (2) UIA mit Passwort in bootstrapCrossSigning, (3) isSecretStorageReady-Check, (4) connectCalledRef, (5) updateRoomList als useCallback, (6) isConnectedRef + Check in sendMessage, (7) Verification-Timeout-Cleanup |
| `src/components/chat/MatrixLoginForm.tsx` | `password` an `connect()` uebergeben im handlePasswordLogin |

### Testen

1. Crypto Store zuruecksetzen
2. Mit Passwort anmelden (nicht manueller Token)
3. In der Konsole sollte "Cross-Signing bootstrapped" erscheinen (nicht mehr "non-critical" Fehler)
4. Verifizierung von Element auf dem Handy starten -- Emojis sollten erscheinen und nach Bestaetigung erfolgreich abschliessen
5. Verifizierung von der App starten -- Element sollte reagieren und der Prozess sollte durchlaufen

