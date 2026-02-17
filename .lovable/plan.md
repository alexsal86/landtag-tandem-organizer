

## Problem-Analyse

Die Konsolen-Logs zeigen zwei kritische Fehler, die sich in einer Endlosschleife wiederholen:

1. **"Unexpected end of JSON input"** -- Die lokale IndexedDB-Datenbank, in der Rust-Crypto seine Schluessel speichert, ist beschaedigt. Jeder `/sync`-Aufruf schlaegt fehl.
2. **"One time key signed_curve25519:AAAAAAAAAA0 already exists"** -- Der Client generiert neue Schluessel, die mit bereits auf dem Server vorhandenen kollidieren. Der Server lehnt sie ab (HTTP 400).

Diese beiden Fehler blockieren sowohl die Entschluesselung als auch die Verifizierung vollstaendig. Die bisherigen Code-Aenderungen (Merge-Logik, Verifizierungs-Wartezeit) waren korrekt, koennen aber nicht greifen, solange der Crypto-Store korrupt ist.

## Loesung

### 1. "Crypto zuruecksetzen"-Funktion im MatrixClientContext

Eine neue Funktion `resetCryptoStore`, die:
- Den Matrix-Client stoppt
- Alle IndexedDB-Datenbanken loescht, die zum Crypto-Store gehoeren (Prefix `matrix-js-sdk:crypto` und `rust-crypto`)
- Den Client danach sauber neu initialisiert

**Datei:** `src/contexts/MatrixClientContext.tsx`

Neue Funktion hinzufuegen:

```typescript
const resetCryptoStore = useCallback(async () => {
  // 1. Client stoppen
  if (client) {
    client.stopClient();
    setClient(null);
  }
  setIsConnected(false);
  setCryptoEnabled(false);

  // 2. Alle crypto-relevanten IndexedDB-Datenbanken loeschen
  try {
    const databases = await indexedDB.databases();
    const cryptoDbs = databases.filter(db => 
      db.name && (
        db.name.includes('matrix-js-sdk:crypto') ||
        db.name.includes('rust-crypto') ||
        db.name.includes('matrix-sdk-crypto')
      )
    );
    for (const db of cryptoDbs) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
        console.log('Deleted crypto DB:', db.name);
      }
    }
  } catch (e) {
    console.warn('Could not enumerate/delete IndexedDB databases:', e);
    // Fallback: versuche bekannte DB-Namen direkt zu loeschen
    const userId = credentials?.userId || '';
    const knownNames = [
      `matrix-js-sdk:crypto:${userId}`,
      `matrix-rust-sdk-crypto-${userId}`,
    ];
    for (const name of knownNames) {
      try { indexedDB.deleteDatabase(name); } catch {}
    }
  }

  // 3. Neu verbinden, falls Credentials vorhanden
  if (credentials) {
    // Kurz warten, damit IndexedDB-Loeschungen abgeschlossen sind
    await new Promise(r => setTimeout(r, 500));
    await connect(credentials);
  }
}, [client, credentials, connect]);
```

Diesen Wert im Context-Provider bereitstellen:
- Interface `MatrixClientContextType` erweitern: `resetCryptoStore: () => Promise<void>;`
- Im `value`-Objekt ergaenzen: `resetCryptoStore`

### 2. "Crypto zuruecksetzen"-Button im Login-Formular

**Datei:** `src/components/chat/MatrixLoginForm.tsx`

Im Verifizierungs-Bereich (unterhalb der Geraete-Verifizierung) einen neuen Button ergaenzen:

```typescript
// resetCryptoStore aus useMatrixClient() holen
const { resetCryptoStore, ...rest } = useMatrixClient();

// Neuer Handler
const handleResetCrypto = async () => {
  setIsStartingVerification(true); // Lade-State wiederverwenden
  try {
    await resetCryptoStore();
    toast({
      title: 'Crypto zurueckgesetzt',
      description: 'Der Verschluesselungs-Speicher wurde geloescht und die Verbindung neu aufgebaut. Bitte starten Sie die Geraete-Verifizierung erneut.',
    });
  } catch (error) {
    toast({
      title: 'Fehler',
      description: error instanceof Error ? error.message : 'Crypto-Reset fehlgeschlagen',
      variant: 'destructive',
    });
  } finally {
    setIsStartingVerification(false);
  }
};
```

Button im UI (nach dem Verifizierungs-Button):

```
<Button onClick={handleResetCrypto} variant="outline" size="sm" className="text-amber-600">
  Verschluesselungs-Speicher zuruecksetzen
</Button>
```

### 3. Fehlermeldung in der Chat-Ansicht verbessern

**Datei:** `src/components/chat/MatrixChatView.tsx`

In der E2EE-Warnung (wo die Diagnostik angezeigt wird) einen Hinweis und Button ergaenzen, der direkt zu den Einstellungen fuehrt, um den Crypto-Store zurueckzusetzen.

### Zusammenfassung der Aenderungen

| Datei | Aenderung |
|---|---|
| `src/contexts/MatrixClientContext.tsx` | Neue Funktion `resetCryptoStore` + Interface-Erweiterung |
| `src/components/chat/MatrixLoginForm.tsx` | "Crypto zuruecksetzen"-Button + Handler |
| `src/components/chat/MatrixChatView.tsx` | Hinweis auf Reset-Option in der E2EE-Warnung |

### Warum das funktioniert

- Der korrupte IndexedDB-Store wird komplett geloescht
- Rust-Crypto erstellt beim naechsten `initRustCrypto()` einen frischen Store
- Neue One-Time-Keys werden generiert, die nicht mit den alten auf dem Server kollidieren
- Danach kann die Verifizierung sauber durchlaufen und verschluesselte Nachrichten (fuer neue Sessions) gelesen werden
- Fuer aeltere Nachrichten wird weiterhin der Recovery Key / Key Backup benoetigt

