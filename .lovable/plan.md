

## Komplett-Refactor: MatrixClientContext.tsx

Die aktuelle Datei hat 1028 Zeilen mit zahlreichen strukturellen Problemen. Statt einzelne Patches anzubringen, wird die Datei grundlegend bereinigt und nach der kanonischen SDK-Reihenfolge neu aufgebaut.

### Kritische Fixes

**1. setupVerifierListeners als eigenstaendige Hilfsfunktion**

Die Funktion wird aus `connect` herausgezogen und als normale Funktion im Provider-Scope definiert. Sowohl `connect` als auch `requestSelfVerification` nutzen dieselbe Referenz -- keine Duplikation mehr.

**2. Event-Listener Cleanup**

Alle `matrixClient.on(...)` Aufrufe werden in `connect` gesammelt. Die Listener-Funktionen werden als benannte Referenzen gespeichert, damit sie in `disconnect` mit `client.off(...)` oder `client.removeListener(...)` wieder entfernt werden koennen. Ein Ref speichert die aktuelle Client-Instanz und deren Listener, sodass `disconnect` sie zuverlaessig aufraeumt.

**3. getMessages: Kein setState mehr im Getter**

`getMessages` wird in zwei Teile aufgeteilt:
- Eine reine Funktion, die Nachrichten berechnet und zurueckgibt (kein Side-Effect)
- Die Timeline-Listener und der Polling-Intervall in `MatrixChatView` uebernehmen das Aktualisieren des Message-States

Stattdessen wird `getMessages` nur noch als "Refresh-Trigger" genutzt, der die Nachrichten aus der Timeline liest und per `setMessages` aktualisiert -- aber klar als Mutation benannt (`refreshMessages`), nicht als Getter.

**4. Kanonische Init-Reihenfolge (laut SDK-Doku)**

```text
1. createClient({ baseUrl, accessToken, userId })
2. initRustCrypto()
3. bootstrapSecretStorage (wenn Recovery Key vorhanden)
4. bootstrapCrossSigning (wenn moeglich)
5. checkKeyBackupAndEnable()
6. startClient({ initialSyncLimit: 50 })
7. Device ID aus client.getDeviceId() persistieren
```

Kein Retry von `initRustCrypto` nach `startClient`. Kein manuelles `whoAmI` fuer die Device ID.

**5. removeReaction implementiert**

Sucht das passende Reaktions-Event im Room-Timeline und redacted es mit `client.redactEvent()`.

**6. connect Dependencies korrigiert**

`connect` wird nicht mehr als `useCallback` mit `[isConnected]` definiert. Stattdessen wird die Guard-Logik ueber `isConnectingRef` allein gesteuert, und `connect` bekommt keine React-Dependencies (oder alle notwendigen).

**7. Race Condition beim Auto-Connect**

Der `useEffect` fuer Auto-Connect nutzt `isConnectingRef.current` als zusaetzlichen Guard. `connect` aendert sich nicht mehr bei jedem Re-Render.

**8. indexedDB.databases() Fallback verbessert**

Prueft ob `indexedDB.databases` existiert bevor es aufgerufen wird, und nutzt ansonsten direkt die bekannten DB-Namen als Fallback.

**9. Nachrichten-Limit konsistent**

Einheitlich 200 Nachrichten als Buffer, konfigurierbar ueber eine Konstante `MAX_CACHED_MESSAGES`.

### Datei-Aenderungen

| Datei | Aenderung |
|---|---|
| `src/contexts/MatrixClientContext.tsx` | Kompletter Refactor (alle 9 Punkte) |

### Neue Struktur der Datei (ca. 850-900 Zeilen statt 1028)

```text
[Imports + Interfaces]             -- unveraendert
[mapMatrixEventToMessage]          -- unveraendert
[MAX_CACHED_MESSAGES = 200]        -- neue Konstante
[setupVerifierListeners()]         -- extrahierte Hilfsfunktion
[MatrixClientProvider]
  State + Refs
  loadCredentials useEffect         -- unveraendert
  connect useCallback
    1. createClient (ohne whoAmI, ohne verificationMethods)
    2. initRustCrypto
    3. bootstrapSecretStorage (mit Recovery Key aus localStorage)
    4. bootstrapCrossSigning (try/catch, nicht-kritisch)
    5. checkKeyBackupAndEnable
    6. Event Listener registrieren (benannte Funktionen)
    7. startClient
    8. Device ID persistieren
    9. Listener-Refs speichern fuer Cleanup
  disconnect useCallback
    - client.off(...) fuer alle Listener
    - client.stopClient()
    - State zuruecksetzen
  refreshMessages (vorher getMessages)
    - Liest Timeline, merged mit Cache
    - Ruft setMessages auf (klar als Mutation gekennzeichnet)
  sendMessage, sendTypingNotification, addReaction -- unveraendert
  removeReaction -- implementiert mit redactEvent
  createRoom -- unveraendert
  requestSelfVerification
    - Nutzt die extrahierte setupVerifierListeners Funktion
    - Kein duplizierter Code mehr
  confirmSas, rejectSas, resetCryptoStore -- unveraendert
  Auto-connect useEffect -- mit besserem Guard
  Context Provider
[useMatrixClient export]
```

### Was sich fuer den Benutzer aendert

- Verifizierung sollte zuverlaessiger funktionieren (kein duplizierter Code, korrekte Listener)
- Keine Memory Leaks mehr bei mehrfachem Connect/Disconnect
- E2EE-Setup folgt der offiziellen Reihenfolge -- bessere Chancen auf funktionierende Verschluesselung
- Reaktionen koennen nun auch entfernt werden

