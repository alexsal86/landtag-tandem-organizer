

## Problem

Der "Crypto zuruecksetzen"-Button loescht zwar die IndexedDB-Datenbanken, aber der Client verbindet sich danach mit der **gleichen Device ID** (QYAJSAHWUK). Der Server hat fuer dieses Geraet bereits One-Time-Keys gespeichert. Der frische Crypto-Store generiert neue Keys mit denselben IDs, und der Server lehnt sie ab (400 Bad Request).

## Loesung

Beim Crypto-Reset muss zusaetzlich die **gespeicherte Device ID** aus dem localStorage geloescht werden. Dadurch wird beim naechsten `connect()` keine Device ID uebergeben, und `createClient()` registriert automatisch ein neues Geraet auf dem Server -- mit frischen Keys ohne Konflikte.

## Technische Aenderung

**Datei:** `src/contexts/MatrixClientContext.tsx` -- Funktion `resetCryptoStore`

Vor dem erneuten Verbinden die Device ID aus localStorage entfernen:

```typescript
// Nach dem Loeschen der IndexedDB-Datenbanken, vor dem reconnect:
const userId = credentials?.userId || '';
if (userId) {
  localStorage.removeItem(`matrix_device_id:${userId}`);
}
```

Ausserdem muss die `connect`-Funktion angepasst werden, damit sie auch ohne Device ID funktioniert -- aktuell wirft sie einen Fehler, wenn keine Device ID ermittelt werden kann. Die Loesung: Wenn `resolvedDeviceId` leer ist, `createClient` ohne `deviceId` aufrufen, sodass der Server automatisch eine neue Device ID vergibt. Nach dem Login wird die neue Device ID aus `matrixClient.getDeviceId()` gespeichert.

Konkret in der `connect`-Funktion (Zeile 246-251):

```typescript
// Vorher:
const resolvedDeviceId = creds.deviceId || localDeviceId || await fetchDeviceIdFromWhoAmI();
if (!resolvedDeviceId) {
  throw new Error('Matrix Device ID konnte nicht ermittelt werden...');
}

// Nachher:
const resolvedDeviceId = creds.deviceId || localDeviceId || await fetchDeviceIdFromWhoAmI() || undefined;
// Kein Fehler mehr wenn leer -- Server vergibt automatisch eine neue ID
```

Und bei `createClient` (Zeile 253-257):

```typescript
const matrixClient = sdk.createClient({
  baseUrl: creds.homeserverUrl,
  accessToken: creds.accessToken,
  userId: creds.userId,
  ...(resolvedDeviceId ? { deviceId: resolvedDeviceId } : {}),
  // ... rest bleibt gleich
});
```

Nach erfolgreichem Start die vom Server vergebene Device ID speichern (Zeile 509):

```typescript
const finalDeviceId = resolvedDeviceId || matrixClient.getDeviceId() || '';
if (finalDeviceId) {
  localStorage.setItem(`matrix_device_id:${creds.userId}`, finalDeviceId);
}
```

## Zusammenfassung

| Datei | Aenderung |
|---|---|
| `src/contexts/MatrixClientContext.tsx` | In `resetCryptoStore`: localStorage-Eintrag fuer Device ID loeschen |
| `src/contexts/MatrixClientContext.tsx` | In `connect`: Device ID optional machen, Server neue ID vergeben lassen |

