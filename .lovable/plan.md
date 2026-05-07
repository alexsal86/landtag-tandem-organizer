# Permissions-Helper für Mobile App

Aktuell werden Mikrofon-, Kamera- und Medienberechtigungen direkt in den Sheets per `requestPermissionsAsync()` angefragt — bei Ablehnung gibt es nur einen Toast „Zugriff verweigert", ohne Hinweis darauf, dass iOS/Android die Anfrage beim zweiten Mal nicht mehr zeigen und man in die Systemeinstellungen muss. Außerdem ist die Logik dupliziert.

## Ziel

Ein zentraler Helper, der für alle drei Berechtigungen gleich funktioniert:
1. Status prüfen (`getPermissionsAsync`).
2. Wenn `granted` → direkt true.
3. Wenn anfragbar (`canAskAgain`) → `requestPermissionsAsync`.
4. Wenn endgültig verweigert → modaler Hinweis mit Button „Einstellungen öffnen" (`Linking.openSettings()`).
5. Konsistente Toasts/Texte auf Deutsch.

## Datei: `apps/mobile/src/lib/permissions.ts` (neu)

API:

```ts
type PermissionKind = 'microphone' | 'camera' | 'mediaLibrary';

ensurePermission(kind: PermissionKind): Promise<boolean>
```

Intern:
- `microphone` → `expo-av` `Audio.getPermissionsAsync` / `requestPermissionsAsync`
- `camera` → `expo-image-picker` `getCameraPermissionsAsync` / `requestCameraPermissionsAsync`
- `mediaLibrary` → `expo-image-picker` `getMediaLibraryPermissionsAsync` / `requestMediaLibraryPermissionsAsync`
- Bei `status === 'denied' && !canAskAgain` → `Alert.alert` mit zwei Buttons („Abbrechen", „Einstellungen öffnen" → `Linking.openSettings()`), Funktion gibt false zurück.
- Lokalisierte Titel/Begründung pro Kind (z. B. „Mikrofon-Zugriff benötigt — Für Sprachnotizen brauchen wir Zugriff auf dein Mikrofon. Du kannst das in den Einstellungen aktivieren.").

## Refactor

- `src/sheets/VoiceNoteSheet.tsx`: `Audio.requestPermissionsAsync()` ersetzen durch `await ensurePermission('microphone')`. Bei false einfach return (Helper hat schon Hinweis gezeigt).
- `src/sheets/PhotoSheet.tsx`: beide Aufrufe analog ersetzen (`'camera'` und `'mediaLibrary'`).

## Was nicht zum Plan gehört

- **Kein Pre-Request beim ersten App-Start**: iOS/Android Best Practice ist on-demand. Onboarding-Slide 4 erklärt das bereits. Wir fragen weiterhin erst beim ersten Tap auf die jeweilige Action.
- Keine Push/Standort/Kontakte — nur was wir aktuell nutzen.
- Keine UI-Änderungen an den Sheets über das Refactor hinaus.
