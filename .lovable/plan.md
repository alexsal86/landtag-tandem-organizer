

# Matrix-Provider aus der App-Hülle herauslösen

## Analyse

Der `MatrixClientProvider` (1.671 Zeilen) umschließt die gesamte App in `App.tsx`. Er wird aktuell von **4 Komponenten** konsumiert:

| Komponente | Was sie nutzt |
|---|---|
| `Navigation.tsx` | nur `totalUnreadCount` |
| `AppNavigation.tsx` | nur `totalUnreadCount` |
| `MatrixChatView.tsx` | Voller Client (Räume, Nachrichten, Senden, E2EE) |
| `MatrixLoginForm.tsx` | connect, disconnect, Verifizierung |

**Das Problem**: Der Provider startet beim App-Mount automatisch eine WebSocket-Verbindung zum Matrix-Homeserver (`matrix-js-sdk` Sync-Loop), hält alle Räume, Nachrichten und Crypto-State im Speicher – auch wenn der Nutzer nie den Chat öffnet.

## Lösung: Zwei getrennte Kontexte

```text
┌─ App.tsx ──────────────────────────────────┐
│  MatrixUnreadProvider (leichtgewichtig)     │  ← Nur Unread-Count
│    ├── Navigation  (liest unreadCount)      │
│    ├── AppNavigation (liest unreadCount)    │
│    └── Routes                               │
│         └── /chat                           │
│              └── MatrixClientProvider       │  ← Voller Client, nur bei Chat
│                   ├── MatrixChatView        │
│                   └── MatrixLoginForm       │
└─────────────────────────────────────────────┘
```

### 1. `MatrixUnreadProvider` (neuer, leichter Context)

- Prüft ob Matrix-Credentials vorhanden sind (Supabase-Query auf `profiles`)
- Wenn ja: Pollt den Unread-Count alle 30s über einen simplen `/sync`-API-Call mit Filter (kein voller SDK-Client nötig) **oder** cached den letzten bekannten Wert aus `localStorage`
- Exponiert nur `{ totalUnreadCount: number, hasCredentials: boolean }`
- Kein `matrix-js-sdk` Import, kein WebSocket, kein Crypto
- ~50-80 Zeilen Code

### 2. `MatrixClientProvider` nur um Chat-Route

- Wird in `Index.tsx` (oder der Chat-Section) gerendert, **nicht** in `App.tsx`
- Initialisiert den vollen Matrix-Client erst wenn Chat betreten wird
- Beim Verlassen: Client bleibt verbunden (optional: Disconnect nach Timeout)
- Aktualisiert den Unread-Count des leichten Providers bei Sync-Events

### 3. Migration der Consumer

- `Navigation.tsx` + `AppNavigation.tsx`: `useMatrixClient()` → `useMatrixUnread()`
- `MatrixChatView.tsx` + `MatrixLoginForm.tsx`: Bleiben bei `useMatrixClient()`, werden aber innerhalb des Chat-Bereichs gerendert

## Vorteile

- **Kein Matrix-SDK-Load** beim App-Start (Code-Splitting wirkt jetzt tatsächlich)
- **Keine WebSocket-Verbindung** wenn Chat nicht genutzt wird
- **Weniger Speicherverbrauch** (kein Room/Message-Cache außerhalb von Chat)
- Navigation-Badge funktioniert weiterhin über leichtgewichtiges Polling

## Risiko

- Unread-Count ist nicht mehr in Echtzeit (30s Polling statt WebSocket-Sync). Für einen Badge-Counter ist das akzeptabel.
- Wenn der Nutzer von Chat wegnavigiert und zurückkommt, muss der Client ggf. neu syncen (kurze Ladezeit). Dies kann durch Beibehalten des Clients im Hintergrund (mit Timeout) gemildert werden.

