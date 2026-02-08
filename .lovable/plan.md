

# Plan: Benachrichtigungssystem verbessern -- Toene, Darstellung und Vorschau

## Uebersicht der Probleme und Loesungen

| Problem | Loesung |
|---------|---------|
| Toene zu kurz und zu aehnlich (nur "Klang" gut) | Alle Toene komplett ueberarbeiten: laenger, melodischer, deutlich unterscheidbar |
| Kein individueller Ton moeglich | Upload-Option fuer eigene Audio-Dateien (MP3/WAV/OGG) via FileReader + localStorage |
| Position "Oben Mitte" fehlt | `top-center` als dritte Positions-Option hinzufuegen (Sonner unterstuetzt das nativ) |
| Vorschau zeigt alle Groessen/Positionen gleich | Sonner-Konfiguration in `sonner.tsx` korrigieren: grosse Variante deutlich groesser (600px breit, groessere Schrift, mehr Padding), Position korrekt uebernehmen |
| "Nicht ausblenden" -- wie wegklicken? | `closeButton` in Sonner aktivieren, damit ein X-Button zum Schliessen erscheint. Hinweistext in den Einstellungen ergaenzen |
| Weitere Ergaenzungen | "Nicht stoeren"-Modus (setzt alle Toasts stumm), Animations-Auswahl (Slide/Fade) |

---

## 1. Toene komplett ueberarbeiten (`notificationSounds.ts`)

**Problem:** Alle Toene dauern 0.08-0.4 Sekunden und bestehen aus einem einzelnen Oszillator. Sie klingen fast identisch.

**Neue Toene (laenger, melodischer, unterscheidbar):**

| Ton | Beschreibung | Dauer | Technik |
|-----|-------------|-------|---------|
| **Ping** | Zwei aufsteigende Toene, klar und freundlich | ~0.5s | Zwei Oszillatoren nacheinander, hoehere Frequenzen |
| **Glocke** | Glockenartig mit Nachhall, metallischer Klang | ~0.8s | Mehrere ueberlagerte Sinustoene mit Decay, verschiedene Harmonische |
| **Plopp** | Tiefer, runder Ton wie ein Wassertropfen | ~0.4s | Sinus mit schnellem Frequency-Sweep von tief nach hoch, dann runter |
| **Dezent** | Sanftes Zweiklang-Motiv | ~0.6s | Triangle-Welle, zwei Noten leise hintereinander |
| **Klang** | Dreiklang aufsteigend (bleibt wie bisher, da beliebt) | ~0.8s | Drei Sinustoene (C-E-G), laengerer Nachhall |
| **Melodie** (NEU) | Kurze 4-Noten-Melodie | ~1.2s | Vier aufeinanderfolgende Toene mit verschiedenen Intervallen |
| **Harfe** (NEU) | Harfenartige aufsteigende Arpeggio | ~1.0s | Schnelle Folge von 5 Toenen mit Triangle-Welle |
| **Alarm** (NEU) | Doppelton, aufmerksamkeitsstark | ~0.6s | Zwei identische kurze Toene mit Pause dazwischen |

**Technische Verbesserungen:**
- Alle Toene verwenden Gain-Envelope (Attack-Decay-Sustain-Release) fuer natuerlicheren Klang
- Mehrere ueberlagerte Oszillatoren fuer reicheren Sound
- Laengere Ausklingzeiten (mindestens 0.4s, maximal 1.2s)

### Individueller Ton (Custom Sound Upload)

Neue Funktion: Benutzer koennen eine eigene Audio-Datei hochladen.

**Technische Umsetzung:**
- File-Input fuer MP3/WAV/OGG (max 500KB)
- `FileReader.readAsDataURL()` konvertiert die Datei in einen Base64-String
- Speicherung in `localStorage` unter `custom_notification_sound`
- Abspielen ueber `new Audio(dataUrl)` statt Web Audio API
- In der Tonliste erscheint "Eigener Ton" als zusaetzliche Option
- Loeschen-Button zum Entfernen des eigenen Tons

**Aenderungen in `notificationSounds.ts`:**
```typescript
export const NOTIFICATION_SOUNDS = [
  { value: 'ping', label: 'Ping' },
  { value: 'bell', label: 'Glocke' },
  { value: 'pop', label: 'Plopp' },
  { value: 'subtle', label: 'Dezent' },
  { value: 'chime', label: 'Klang' },
  { value: 'melody', label: 'Melodie' },
  { value: 'harp', label: 'Harfe' },
  { value: 'alert', label: 'Alarm' },
  { value: 'custom', label: 'Eigener Ton' },
] as const;

export function playNotificationSound(soundName: SoundName, volume: number = 0.5) {
  if (soundName === 'custom') {
    playCustomSound(volume);
    return;
  }
  // ... bestehende Web Audio API Logik
}

function playCustomSound(volume: number) {
  const dataUrl = localStorage.getItem('custom_notification_sound');
  if (!dataUrl) return;
  const audio = new Audio(dataUrl);
  audio.volume = volume;
  audio.play().catch(console.error);
}
```

---

## 2. Position "Oben Mitte" hinzufuegen

**Sonner unterstuetzt nativ:** `top-left`, `top-center`, `top-right`, `bottom-left`, `bottom-center`, `bottom-right`

**Aenderungen:**

In `useNotificationDisplayPreferences.ts`:
```typescript
position: 'top-right' | 'top-center' | 'bottom-right';
```

In `NotificationsPage.tsx` -- RadioGroup von 2 auf 3 Optionen erweitern:
- Oben rechts (`top-right`)
- Oben Mitte (`top-center`)
- Unten rechts (`bottom-right`)

Grid-Layout: `grid-cols-3` statt `grid-cols-2`

---

## 3. Vorschau korrigieren -- Groesse und Position

**Problem:** Die Vorschau ruft `toast()` auf, aber Sonner verwendet die globale Konfiguration aus `sonner.tsx`. Die aktuelle `isLarge`-Klasse ist zu subtil (nur 420px Breite und `text-base`).

**Loesung in `sonner.tsx`:**

Die grosse Variante muss deutlich auffaelliger sein:

```typescript
// Normal: Standard-Sonner-Darstellung (~356px)
// Gross: Deutlich groesser

const largeStyles = isLarge ? [
  'group-[.toaster]:!w-[520px]',      // Breiter (statt 420px)
  'group-[.toaster]:!max-w-[90vw]',   // Responsiv
  'group-[.toaster]:!text-lg',         // Groessere Schrift (statt text-base)
  'group-[.toaster]:!p-6',            // Mehr Padding (statt p-5)
  'group-[.toaster]:!rounded-xl',     // Groessere Rundung
  'group-[.toaster]:!shadow-2xl',     // Staerkerer Schatten
  'group-[.toaster]:!border-2',       // Dickerer Rand
].join(' ') : '';

// Description bei gross:
const largeDescStyles = isLarge
  ? 'group-[.toast]:!text-base'  // statt text-sm
  : '';
```

**Position:** Die Position wird bereits korrekt ueber `preferences.position` an Sonner weitergegeben. Das sollte schon funktionieren -- falls nicht, liegt es daran, dass die Preferences nicht sofort nach Aenderung den Sonner-State aktualisieren. Wir stellen sicher, dass die Vorschau-Benachrichtigung die aktuell gewaehlte Position/Groesse live widerspiegelt (kein Page-Reload noetig).

**Vorschau-Verbesserung in `NotificationsPage.tsx`:**
```typescript
const handlePreview = () => {
  // Alle bestehenden Toasts entfernen, damit man die neue Position sieht
  toast.dismiss();
  
  // Kurze Verzoegerung damit das Dismiss wirkt
  setTimeout(() => {
    toast('Beispiel-Benachrichtigung', {
      description: 'So werden Ihre Benachrichtigungen angezeigt. Bei "Nicht ausblenden" koennen Sie diese mit dem X-Button schliessen.',
      duration: preferences.persist ? Infinity : preferences.duration,
      position: preferences.position, // Explizit die Position setzen
      closeButton: true, // Immer Close-Button in der Vorschau zeigen
    });
  }, 100);
};
```

---

## 4. "Nicht ausblenden" -- Close-Button

**Problem:** Wenn `persist: true` (Dauer = Infinity), bleiben Toasts fuer immer sichtbar, aber der Benutzer kann sie nicht schliessen.

**Loesung in `sonner.tsx`:**
```typescript
<Sonner
  closeButton={preferences.persist}  // Close-Button anzeigen bei persistenten Toasts
  // ... rest
/>
```

Alternativ immer einen Close-Button anzeigen -- das ist nutzerfreundlicher:
```typescript
<Sonner
  closeButton={true}  // Immer einen X-Button anzeigen
/>
```

**Zusaetzlich:** Hinweistext in den Einstellungen unter "Nicht ausblenden":
> "Benachrichtigungen bleiben sichtbar, bis Sie diese manuell mit dem X-Button schliessen."

---

## 5. Weitere Ergaenzungen

### "Nicht stoeren"-Modus
- Ein einfacher Toggle in den Einstellungen: "Nicht stoeren"
- Wenn aktiviert: Keine Toast-Einblendungen und keine Toene
- Die Benachrichtigungen werden weiterhin in der Liste gespeichert, nur nicht eingeblendet
- Visueller Indikator (z.B. durchgestrichenes Glocken-Icon) im Header

### Visuelle Vorschau-Box
Statt nur einen Button "Vorschau anzeigen" -- ein kleines visuelles Schema der Bildschirm-Position:
- Ein Mini-Bildschirm (160x100px Box) mit markierter Position wo der Toast erscheint
- Klick auf die Position aendert diese direkt
- Zeigt auch die relative Groesse an (Normal vs. Gross)

---

## Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/utils/notificationSounds.ts` | Alle Toene ueberarbeiten (laenger, reichhaltiger), 3 neue Toene, Custom-Sound-Support |
| `src/hooks/useNotificationDisplayPreferences.ts` | Position-Typ um `top-center` erweitern, `closeButton`-Preference hinzufuegen |
| `src/components/ui/sonner.tsx` | `closeButton` aktivieren, grosse Variante deutlich groesser (520px, text-lg, p-6, shadow-2xl) |
| `src/pages/NotificationsPage.tsx` | 3 Positions-Optionen, Custom-Sound-Upload UI, Vorschau mit `toast.dismiss()` + position-Override, Hinweistext bei "Nicht ausblenden", visuelle Position-Preview-Box |

## Reihenfolge

1. Toene ueberarbeiten und neue Toene hinzufuegen (`notificationSounds.ts`)
2. Custom-Sound Upload-Logik (`notificationSounds.ts`)
3. Position `top-center` + Close-Button (`useNotificationDisplayPreferences.ts`)
4. Sonner grosse Variante korrigieren + closeButton (`sonner.tsx`)
5. Einstellungs-UI aktualisieren: 3 Positionen, Upload, Hinweistexte, visuelle Vorschau (`NotificationsPage.tsx`)

