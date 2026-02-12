

# Plan: Bilder im Header-Designer reparieren

## Problem

Die Bilder werden im Header-Designer nicht angezeigt, obwohl sie korrekt im Supabase Storage gespeichert sind. Die Ursache liegt im Code der Funktion `loadSystemImages`:

1. Der Code holt zunaechst die **oeffentliche URL** (`getPublicUrl`) -- diese funktioniert, da der Bucket `letter-assets` als **public** konfiguriert ist.
2. Danach wird die URL jedoch **immer** mit einer **signierten URL** (`createSignedUrl`) ueberschrieben.
3. Signierte URLs laufen nach 1 Stunde ab und koennen zu Problemen fuehren.

Da der Bucket bereits public ist (bestaetigt durch Datenbankabfrage), ist die signierte URL unnoetig.

## Loesung

In `src/components/letters/StructuredHeaderEditor.tsx` wird die Funktion `loadSystemImages` (Zeilen 126-157) vereinfacht:

- Die `getPublicUrl`-URL wird direkt verwendet
- Der gesamte `createSignedUrl`-Fallback-Block wird entfernt
- Die `map`-Funktion wird synchron statt async, da `getPublicUrl` kein API-Call ist

### Vorher (vereinfacht)

```text
getPublicUrl -> url
createSignedUrl -> ueberschreibt url (unnoetig, kann Fehler verursachen)
return { name, url }
```

### Nachher

```text
getPublicUrl -> url
return { name, url }
```

## Technische Details

### Datei: `src/components/letters/StructuredHeaderEditor.tsx`

Die Funktion `loadSystemImages` (Zeilen 126-157) wird wie folgt geaendert:

- `Promise.all` mit async-Callback wird durch ein einfaches synchrones `.map` ersetzt
- Der `try/catch`-Block fuer `createSignedUrl` (Zeilen 143-148) wird komplett entfernt
- Die Funktion wird dadurch einfacher, schneller und zuverlaessiger

Es ist nur eine Datei betroffen, die Aenderung ist minimal und zielgerichtet.

