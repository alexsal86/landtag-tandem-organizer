
## Fix: One-Time-Key-Kollision und Device-Validierung

### Problem

Beim Connect wird eine Device ID aus localStorage wiederverwendet, deren Crypto-Store (IndexedDB) aber nicht mehr zum serverseitigen State passt. Das fuehrt zu:

```
One time key signed_curve25519:AAAAAAAAAA0 already exists → 400
→ Crypto-Layer sendet m.key.verification.cancel
→ Andere Seite sieht m.user_error
```

### Aenderungen in `src/contexts/MatrixClientContext.tsx`

**1. Device-Validierung vor `initRustCrypto` (nach Zeile 338)**

Bevor der Client gestartet wird, wird geprueft ob das gespeicherte Device noch auf dem Homeserver existiert. Falls nicht, wird die lokale Device ID verworfen und der Client ohne Device ID erstellt (Server vergibt eine neue).

```text
// Nach createClient, vor initRustCrypto:
if (localDeviceId) {
  try {
    const resp = await fetch(
      `${creds.homeserverUrl}/_matrix/client/v3/devices/${localDeviceId}`,
      { headers: { Authorization: `Bearer ${creds.accessToken}` } }
    );
    if (!resp.ok) {
      console.warn('Stored device no longer exists on server, creating new device');
      localStorage.removeItem(`matrix_device_id:${creds.userId}`);
      // Recreate client without stale deviceId
      matrixClient = sdk.createClient({
        baseUrl: creds.homeserverUrl,
        accessToken: creds.accessToken,
        userId: creds.userId,
      });
      clientRef.current = matrixClient;
    }
  } catch {}
}
```

**2. `resetCryptoStore` mit serverseitigem Device-Delete (Zeilen 960-1023)**

Der bestehende `resetCryptoStore` loescht nur lokale Daten. Neu wird zuerst versucht, das Device auch serverseitig zu loeschen (mit UIA-Passwort falls vorhanden). Das verhindert die Key-Kollision beim naechsten Login.

```text
// Vor disconnect() und IndexedDB-Cleanup:
if (mc) {
  try {
    const deviceId = mc.getDeviceId();
    if (deviceId) {
      const localpart = credentials?.userId?.split(':')[0].substring(1);
      await mc.deleteDevice(deviceId, credentials?.password ? {
        type: 'm.login.password',
        identifier: { type: 'm.id.user', user: localpart },
        password: credentials.password,
      } : {});
      console.log('Device deleted from server:', deviceId);
    }
  } catch (e) {
    console.warn('Could not delete device from server (non-critical):', e);
  }
}
```

**3. Credentials um password erweitern fuer resetCryptoStore**

`resetCryptoStore` braucht Zugriff auf `credentials?.password`. Da das Passwort in `credentials` nach dem Login gespeichert wird (nur im Memory, nicht persistiert), ist das bereits verfuegbar -- Zeile 683: `setCredentials({ ...creds, deviceId: finalDeviceId || undefined })` speichert auch `password` mit. Es muss nichts zusaetzlich geaendert werden.

### Zusammenfassung

| Stelle | Aenderung |
|---|---|
| `connect()` nach createClient (Zeile 338) | Device-Validierung per GET `/devices/{id}`, bei 404 Client ohne Device ID neu erstellen |
| `resetCryptoStore` (Zeile 960) | Serverseitiges `deleteDevice` mit UIA vor lokalem Cleanup |

### Was sich aendert

- Veraltete Device IDs werden beim Connect erkannt und verworfen statt Key-Kollisionen auszuloesen
- `resetCryptoStore` raeumt auch serverseitig auf, sodass ein sauberer Neustart moeglich ist
- Keine manuellen Browser-Cache-Loeschungen mehr noetig
