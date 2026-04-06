

# Zwei große Dateien aufteilen

## Datei 1: `StructuredHeaderEditor.tsx` (1867 Zeilen)

Canvas-Editor fuer Brief-Header mit Drag&Drop, Resize, Snap, Zoom, Bildgalerie, Shapes und Properties-Panel.

### Aufteilung in 5 Dateien:

**`src/components/letters/structured-header/constants.ts`** (~80 Zeilen)
- `BLOCK_VARIABLES`, `createElementId`, `getShapeFillColor`, `getShapeStrokeColor`

**`src/components/letters/structured-header/useCanvasInteractions.ts`** (~500 Zeilen)
- Custom Hook: Drag/Drop, Resize, Selection-Box, Snap-to-Grid, Smart Guides, Mouse-Event-Handler (`onElementMouseDown`, `onResizeMouseDown`, `onPreviewMouseDown/Move/Up`), Keyboard-Handler, Clipboard (Copy/Paste/Duplicate), Layer-Management, Align/Distribute
- Nimmt `elements`, `setElements`, `applyElements`, Selection-State als Parameter

**`src/components/letters/structured-header/useCanvasGallery.ts`** (~180 Zeilen)
- Bildgalerie laden, Upload, loeschen, Blob-URL-Verwaltung (`resolveBlobUrl`, `loadGalleryImages`, `uploadImage`, `handleGalleryUpload`, `deleteGalleryImage`)

**`src/components/letters/structured-header/CanvasElementRenderers.tsx`** (~400 Zeilen)
- `renderResizeHandles`, `renderShapeCanvas`, `renderBlockCanvas`, `renderColorInput`, `getElementLabel/Icon/AriaLabel`
- Properties-Panel JSX (das rechte Seitenpanel mit Element-Eigenschaften)

**`src/components/letters/structured-header/StructuredHeaderEditor.tsx`** (~700 Zeilen)
- Hauptkomponente: State-Deklarationen, Hook-Aufrufe, Zoom-Controls, Return-JSX (Toolbar, Canvas-Bereich, Seitenpanel)
- Re-exportiert ueber bestehenden Import-Pfad

---

## Datei 2: `MatrixClientContext.tsx` (1864 Zeilen)

Matrix-Chat-Client mit Verbindung, Crypto/E2EE, Nachrichten, Reactions, Typing, Verification.

### Aufteilung in 5 Dateien:

**`src/contexts/matrix/types.ts`** (~170 Zeilen)
- Alle Interfaces und Types: `MatrixCredentials`, `MatrixRoom`, `MatrixE2EEDiagnostics`, `MatrixSasVerificationState`, `MatrixClientState`, `MatrixClientContextType`, interne Payload-Types

**`src/contexts/matrix/constants.ts`** (~80 Zeilen)
- `MAX_CACHED_MESSAGES`, `MAX_CACHED_ROOMS`, `SCROLLBACK_BATCH_LIMIT`, `MATRIX_CONSOLE_NOISE_PATTERNS`, Default-Context-Wert, Noop-Funktionen

**`src/contexts/matrix/helpers.ts`** (~120 Zeilen)
- `shouldSuppressMatrixConsoleNoise`, `installMatrixConsoleNoiseFilter`, `matrixLogger`, `toSafeErrorMessage`, `toMatrixEventPayload`, `getMatrixRelatesToPayload`, `mapMatrixEventToMessage`, `isLocalEchoEvent`, `setupVerifierListeners`, `createDefaultE2EEDiagnostics`

**`src/contexts/matrix/MatrixClientProvider.tsx`** (~1400 Zeilen)
- Die `MatrixClientProvider`-Funktion mit allen internen Hooks/Callbacks: `connect`, `disconnect`, `refreshMessages`, `sendMessage`, `sendTypingNotification`, `addReaction`, `removeReaction`, `createRoom`, `requestSelfVerification`, `resetCryptoStore`, Auto-Connect-Logik
- Importiert Types, Constants, Helpers

**`src/contexts/MatrixClientContext.tsx`** (~20 Zeilen)
- Re-Export-Barrel: exportiert alles aus `./matrix/types`, `./matrix/constants`, `./matrix/MatrixClientProvider`
- Damit bestehende Imports (`from '@/contexts/MatrixClientContext'`) weiterhin funktionieren

---

## Betroffene Dateien (Zusammenfassung)

Neue Dateien:
1. `src/components/letters/structured-header/constants.ts`
2. `src/components/letters/structured-header/useCanvasInteractions.ts`
3. `src/components/letters/structured-header/useCanvasGallery.ts`
4. `src/components/letters/structured-header/CanvasElementRenderers.tsx`
5. `src/components/letters/structured-header/StructuredHeaderEditor.tsx`
6. `src/contexts/matrix/types.ts`
7. `src/contexts/matrix/constants.ts`
8. `src/contexts/matrix/helpers.ts`
9. `src/contexts/matrix/MatrixClientProvider.tsx`

Geaenderte Dateien:
- `src/components/letters/StructuredHeaderEditor.tsx` → wird zu Re-Export-Barrel
- `src/contexts/MatrixClientContext.tsx` → wird zu Re-Export-Barrel

Keine Import-Aenderungen in anderen Dateien noetig, da die Original-Pfade als Barrels erhalten bleiben.

