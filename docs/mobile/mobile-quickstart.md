# Mobile Quickstart (React Native + Expo)

## Ziel
In wenigen Schritten eine native App (`apps/mobile`) starten, die später schrittweise mit Supabase Auth, Tenant-Handling und Kernflows erweitert wird.

## Voraussetzungen
- Node.js 20+
- npm 10+
- Android Studio (Android)
- Apple/Xcode optional für iOS

## Start lokal
```bash
npm install
npm run mobile:start
```

Danach im Expo-Menü:
- `a` für Android Emulator
- oder **Expo Go** auf dem Handy nutzen (QR-Code)

## Android Developer: nächste Schritte (ab jetzt)
Da dein Google-Developer-Account bereit ist, gehen wir in diese Reihenfolge:

### 1) EAS Build einrichten
```bash
npm i -D eas-cli
npx eas login
npx eas init
```

### 2) Build-Profile anlegen
Lege `apps/mobile/eas.json` an:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  }
}
```

### 3) Internen Android-Build erzeugen (AAB/APK)
```bash
npx eas build --platform android --profile preview
```

### 4) Google Play Internal Testing
1. In Play Console App anlegen (Package: `de.landtag.mobile`).
2. „Internal testing“-Track öffnen.
3. Erzeugtes AAB hochladen.
4. Testgruppe hinzufügen, Opt-in-Link teilen.

### 5) Release-Check vor erstem Upload
- App-Name + kurze Beschreibung
- Datenschutzangaben (Data Safety)
- Tester-E-Mail-Liste
- Crash-Reporting aktiv (Sentry/Firebase)

## Wichtige Pfade
- `apps/mobile/app/index.tsx`: Einstiegsscreen
- `apps/mobile/src/screens/LoginScreen.tsx`: erster Login-Flow
- `packages/domain/src/index.ts`: geteilte Domain-Typen
- `packages/api-client/src/index.ts`: geteilte API-Client-Schicht

## Nächste Umsetzungsschritte in Code
1. `createAuthService().prepareLogin(...)` durch echten Supabase Login ersetzen.
2. Secure Storage für Access-/Refresh-Token integrieren.
3. Tenant-Auswahl nach erfolgreichem Login ergänzen.
4. Erste produktive Screens (`MyWork`, `Tasks`) anbinden.
