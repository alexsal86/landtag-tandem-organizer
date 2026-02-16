# Matrix E2EE – Installations- und Betriebs-Checkliste

Diese Checkliste basiert auf der im Projekt eingesetzten `matrix-js-sdk`/Rust-Crypto-Integration.

## 1) Client-Initialisierung (Pflicht)

- Matrix-Client erzeugen (`sdk.createClient(...)`).
- **`await matrixClient.initRustCrypto()`** aufrufen.
- Danach `matrixClient.startClient(...)` starten.

> Hinweis aus `matrix-js-sdk`: `initCrypto()` ist veraltet, `initRustCrypto()` ist der korrekte Weg.

## 2) Browser-/Runtime-Voraussetzungen (sehr häufige Ursache)

Für Web-E2EE müssen in der Praxis folgende Bedingungen erfüllt sein:

- Sicherer Kontext (`window.isSecureContext` → `true`)
- Cross-Origin Isolation (`window.crossOriginIsolated` → `true`)
- `SharedArrayBuffer` verfügbar
- COOP/COEP korrekt aktiv (bei uns per `coi-serviceworker.js`)
- Service Worker tatsächlich aktiv/controlling

Wenn eine davon fehlt, kann Rust-Crypto nicht sauber laufen.

## 3) Wichtig für das Laden alter verschlüsselter Nachrichten

Auch wenn neue verschlüsselte Nachrichten funktionieren, können ältere Nachrichten ohne Schlüsselmaterial undecryptable bleiben.

Dafür braucht ihr zusätzlich:

- Secret Storage (4S) Zugriff
- Key Backup auf dem Homeserver
- Device Verification / Cross-Signing

Empfehlung aus SDK: Secret Storage + Cross-Signing bewusst im UI-Flow einbauen.

## 4) Raumerstellung

Beim Anlegen verschlüsselter Räume muss `m.room.encryption` im `initial_state` gesetzt werden, z. B. mit:

- `algorithm: "m.megolm.v1.aes-sha2"`

## 5) Ops-/Deployment-Checks

- App in eigenem Tab/Fenster starten (kein restriktiver Embed-Kontext).
- Keine Reverse-Proxy-Header, die COOP/COEP kaputt machen.
- Bei Deployments mit CDN sicherstellen, dass SW und Assets nicht aus nicht-isolierten Kontexten geladen werden.
- Bei Änderungen am SW einmal hart neu laden (Cache/SW-Zustand ausschließen).

## 6) Was wir in der App ergänzt haben

- Laufzeit-Diagnose im Chat-Warnhinweis:
  - Secure Context
  - Cross-Origin Isolation
  - SharedArrayBuffer
  - Service Worker aktiv
  - letzter Crypto-Fehler

So kann man direkt sehen, **welche** Bedingung konkret fehlt.

## 7) Praktisch im aktuellen Projekt

- Im Matrix-Login kann optional ein Recovery Key hinterlegt werden.
- Dieser wird lokal im Browser gespeichert und als `getSecretStorageKey`-Quelle für das SDK verwendet.
- Nach dem Start wird `checkKeyBackupAndEnable()` aufgerufen, um Schlüssel-Backups zu aktivieren und Historie besser entschlüsseln zu können.
