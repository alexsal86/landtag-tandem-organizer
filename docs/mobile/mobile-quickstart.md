# Mobile Quickstart (React Native + Expo)

## Ziel
In wenigen Schritten eine native App (`apps/mobile`) starten, die später schrittweise mit Supabase Auth, Tenant-Handling und Kernflows erweitert wird.

## Voraussetzungen
- Node.js 20+
- npm 10+
- Android Studio (Android)
- Apple/Xcode optional für iOS
- **kein Google-Developer-Account notwendig für APK-Tests**

## Start lokal
```bash
npm install
npm run mobile:start
```

Danach im Expo-Menü:
- `a` für Android Emulator
- oder **Expo Go** auf dem Handy nutzen (QR-Code)

## APK ohne Google-Account (3 Befehle)
> Dafür brauchst du nur einen kostenlosen Expo-Account.

```bash
npm run mobile:eas:login
npm run mobile:build:apk
npm run mobile:build:aab
```

- `mobile:build:apk`: erzeugt eine testbare APK (Sideloading/Internal).
- `mobile:build:aab`: erzeugt ein AAB für späteren Play-Store-Upload.

## Build-Profile
Die Profile liegen in `apps/mobile/eas.json`:
- `preview-apk` → Android APK
- `production-aab` → Android App Bundle (AAB)

## Wenn du später doch in den Play Store willst
1. Google Play Developer Account anlegen.
2. App in der Play Console erstellen (`de.landtag.mobile`).
3. Mit `npm run mobile:build:aab` ein AAB bauen.
4. AAB in „Internal testing“ hochladen.

## Wichtige Pfade
- `apps/mobile/app/index.tsx`: Einstiegsscreen
- `apps/mobile/src/screens/LoginScreen.tsx`: erster Login-Flow
- `apps/mobile/eas.json`: Android Build-Profile
- `packages/domain/src/index.ts`: geteilte Domain-Typen
- `packages/api-client/src/index.ts`: geteilte API-Client-Schicht

## Nächste Umsetzungsschritte in Code
1. `createAuthService().prepareLogin(...)` durch echten Supabase Login ersetzen.
2. Secure Storage für Access-/Refresh-Token integrieren.
3. Tenant-Auswahl nach erfolgreichem Login ergänzen.
4. Erste produktive Screens (`MyWork`, `Tasks`) anbinden.
