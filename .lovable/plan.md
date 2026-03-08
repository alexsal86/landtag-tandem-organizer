

## Problem

Beim Klick auf einen bestimmten Jour Fixe in "Meine Arbeit" wird `/meetings?id=<meeting-id>` aufgerufen. In `useMeetingsData.ts` gibt es aber eine **Race Condition** zwischen zwei `useEffect`-Hooks:

1. **Deep-Link-Effect** (Zeile 73-107): Liest `searchParams.get('id')`, findet das Meeting, setzt es als `selectedMeeting` und löscht dann den `id`-Parameter via `searchParams.delete('id')`.
2. **Auto-Select-Effect** (Zeile 120-130): Prüft `!searchParams.get('id')` — wenn kein `id`-Parameter vorhanden, wird automatisch das nächste bevorstehende Meeting ausgewählt.

**Das Problem:** `searchParams` ist ein mutables `URLSearchParams`-Objekt. Wenn der Deep-Link-Effect `searchParams.delete('id')` aufruft, wird dasselbe Objekt mutiert, das der Auto-Select-Effect im selben Render-Zyklus prüft. Der Auto-Select sieht dann keinen `id`-Parameter mehr und überschreibt die Auswahl mit dem nächsten Meeting.

## Lösung

In `src/components/meetings/hooks/useMeetingsData.ts`:

1. **Eigene State-Variable für Deep-Link-Tracking**: Eine `useRef` oder `useState`-Variable `deepLinkProcessed` einführen, die signalisiert, dass ein Deep-Link gerade verarbeitet wird.

2. **Auto-Select-Effect absichern**: Statt nur `searchParams.get('id')` zu prüfen, zusätzlich prüfen ob der Deep-Link gerade aktiv ist. Konkreter Ansatz:
   - Einen `useRef<string | null>(null)` namens `pendingDeepLinkId` anlegen
   - Beim Mount den initialen `id`-Parameter dort speichern
   - Im Auto-Select-Effect prüfen: `!pendingDeepLinkId.current`
   - Im Deep-Link-Effect nach erfolgreichem Select: `pendingDeepLinkId.current = null`

3. **Alternativ (einfacher)**: Im Deep-Link-Effect `setSelectedMeeting` VOR `searchParams.delete` aufrufen ist bereits der Fall — aber das Problem ist, dass beide Effects im selben Zyklus laufen. Dieinfachste Lösung: Im Auto-Select-Effect die URL-Prüfung durch `window.location.search` statt des mutierten `searchParams`-Objekts machen, oder einen Ref verwenden.

**Bevorzugter Ansatz — `useRef`:**

```typescript
// Neue Ref am Anfang des Hooks
const deepLinkIdRef = useRef<string | null>(searchParams.get('id'));

// Deep-Link-Effect: nach Select
deepLinkIdRef.current = null;

// Auto-Select-Effect: Guard erweitern
if (meetings.length > 0 && !selectedMeeting && !activeMeeting 
    && !searchParams.get('id') && !deepLinkIdRef.current) {
```

### Datei
- `src/components/meetings/hooks/useMeetingsData.ts` — Ref einführen, Auto-Select absichern

