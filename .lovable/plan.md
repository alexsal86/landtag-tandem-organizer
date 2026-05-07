# Onboarding & Branding aufwerten

Ausgangslage: Onboarding-Slides, Skip, Splash und App-Icon existieren bereits. Routing in `app/index.tsx` schickt Nutzer:innen vor dem Login durchs Onboarding. Was jetzt fehlt: bessere Optik, schärfere Inhalte und ein Wiederholen-Eintrag in den Settings.

## 1. Inhalte überarbeiten (`app/onboarding.tsx`)

Vier statt drei Slides, klar auf Plan A (Quick Actions) zugeschnitten:

1. **Willkommen** – „Dein Büro in der Tasche" · kurze Einordnung, was die App ist (mobile Erfassung fürs Abgeordnetenbüro).
2. **Schnell erfassen** – Sprachnotiz, Anruf, Termin, Foto, Aufgabe, Notiz. Sechs Mini-Tiles als Vorschau.
3. **Sicher & nahtlos** – Magic Link / Passwort beim ersten Mal, danach Face ID / Fingerabdruck. Tenant-Wechsel im Header.
4. **Berechtigungen on demand** – Mikro/Kamera/Fotos werden erst beim ersten Tap angefragt, nichts vorab.

Pro Slide: Headline, 1–2 Sätze Body, kein Marketing-Sprech.

## 2. Optik aufwerten

- **Echte Icons statt Emoji**: `lucide-react-native` (ist im Monorepo bereits über lucide vorhanden, sonst `lucide-react-native` als Mobile-Variante hinzufügen). Pro Slide ein großes Icon in Kreis-Badge (96px, weißer Kreis mit Schatten auf farbigem Hintergrund).
- **Hintergrund**: weicher vertikaler Verlauf statt Volltonblau (`expo-linear-gradient`, Top `#1E40AF` → Bottom `#155EEF`). Pro Slide leicht andere Akzentfarbe für die Icon-Badge (Indigo, Violet, Emerald, Amber), Hintergrund bleibt konsistent.
- **Typografie**: Headline 32/700, Body 16/400 mit `lineHeight 24`, Buchstabenabstand `-0.3` auf Headline. Body-Farbe `rgba(255,255,255,0.85)`.
- **Mini-Tiles auf Slide 2**: 3×2 Grid von 64×64-Kacheln (Mic, Phone, Calendar, Camera, CheckSquare, FileText) mit halbtransparentem Weiß und Icon innen — gibt dem Onboarding ein konkretes Vorschau-Gefühl.
- **Animation**: beim Slide-Wechsel Icon-Badge mit `Animated` (scale 0.8 → 1, opacity 0 → 1, 250ms). Body-Text fadet 100ms verzögert nach.
- **Dots → Progress**: dünne Progress-Bar oben (4 Segmente, aktives gefüllt) statt Dots unten — wirkt aufgeräumter und zeigt klarer, wie weit man ist.
- **CTA**: weiß auf Verlauf, mit „Weiter" + Pfeil (ChevronRight). Letzter Slide: „Loslegen". Skip oben rechts in `rgba(255,255,255,0.7)`, klein.
- **Safe Area**: `react-native-safe-area-context` (`SafeAreaView`) statt fixe `paddingTop: 60`, damit es auf Geräten mit/ohne Notch sauber sitzt.

## 3. Skip = „Aus Settings erneut öffnen"

- Verhalten von Skip/„Loslegen" bleibt: setzt `landtag.onboardingDone = '1'` in `SecureStore`, navigiert zu `/login`.
- In `app/settings.tsx` neuer Listeneintrag „Einführung erneut anzeigen". Tap → löscht den Flag und `router.push('/onboarding')`. Danach landet man wieder normal in `/login` bzw. `/home`.
- Wir versuchen NICHT, das Onboarding nach dem Login zu zeigen. Es bleibt Pre-Login-Schritt; aus Settings kann man es auch eingeloggt nochmal triggern (es navigiert dann nach Abschluss zurück zu `/home`, weil Session schon existiert — `finish()` ruft `router.replace('/')`, der Index-Router routet korrekt weiter).

## 4. Code-Punkte (technisch)

- `apps/mobile/package.json`: `expo-linear-gradient`, `react-native-safe-area-context` (vermutlich schon da), `lucide-react-native` ergänzen falls nicht vorhanden.
- `app/_layout.tsx`: `SafeAreaProvider` außen herum.
- `app/onboarding.tsx`: komplette Überarbeitung wie oben. Slides als typisierte Konstante mit `{ id, icon: LucideIcon, accent, title, body, preview? }`.
- `app/settings.tsx`: neuer Eintrag mit `RotateCcw`-Icon, `SecureStore.deleteItemAsync('landtag.onboardingDone')` + Navigation.
- `app/index.tsx`: keine Änderung nötig.
- Branding-Assets (`icon.png`, `adaptive-icon.png`, `splash.png`) bleiben vorerst — falls du echtes Logo hast, separat tauschen.

## Was nicht zum Plan gehört

- Kein neues App-Icon/Splash (du wolltest „Inhalte + Optik", nicht „Branding ersetzen"). Bestehende Platzhalter bleiben.
- Keine Server- oder Datenbankänderung.
- Kein i18n-System; Texte bleiben auf Deutsch hartcodiert wie heute.
