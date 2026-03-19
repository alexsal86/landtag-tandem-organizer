

## Problem

Der Build schlägt fehl, weil in `DIN5008LetterLayout.tsx` die Funktion `getLetterAssetPublicUrl` verwendet wird (Zeile 129), aber nicht importiert ist. Ohne erfolgreichen Build kann kein Brief geöffnet werden.

## Lösung

In `src/components/letters/DIN5008LetterLayout.tsx` den fehlenden Import hinzufügen:

```ts
import { getLetterAssetPublicUrl } from './letterAssetUrls';
```

Dies wird in die bestehenden Imports (Zeile 1-9) eingefügt. Die Funktion existiert bereits in `letterAssetUrls.ts` und wird dort korrekt exportiert.

## Zusätzliche Build-Fehler

Es gibt weitere Build-Fehler in `AutomationRulesManager.tsx` und `MeetingTemplateManager.tsx`, die aber nicht mit dem Brief-Problem zusammenhängen. Diese können separat behoben werden.

