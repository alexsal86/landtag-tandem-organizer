

# Upload-Feld in der Navigationsleiste funktional machen

## Aktueller Zustand
Das "Dossier hochladen"-Feld in der Navigation (Zeile 852-858 in `AppNavigation.tsx`) ist nur ein Klick-Dummy, der zur Aktenansicht navigiert. Es hat keine Upload-Funktionalität.

## Was sich ändert

### 1. Navigation: Upload-Widget statt Klick-Dummy
In `src/components/AppNavigation.tsx` (Zeile 852-858):

Das statische `<div>` wird durch ein funktionales Inline-Widget ersetzt, das folgendes kann:
- **Textfeld**: Notiz oder URL eingeben und absenden (Enter-Taste)
- **Datei-Upload**: Button zum Dateien vom Rechner auswählen (alle Dateitypen, inkl. E-Mail .eml/.msg)
- **Paste-Support**: E-Mails per Strg+V einfügen (Outlook-Integration)
- **Drag & Drop**: Dateien auf das Feld ziehen (optional, da Platz begrenzt)
- Automatische Erkennung: URLs werden als Link gespeichert, alles andere als Notiz oder Datei
- Alles wird als Inbox-Eintrag (dossier_id = null) in `dossier_entries` gespeichert

Das Widget nutzt direkt `useCreateEntry()` aus den Dossier-Hooks. Die Erfolgsmeldung kommt automatisch vom Hook (`toast.success("Eintrag gespeichert")`).

### 2. Kompaktes Design für die Sidebar
Da die Sidebar nur ~280px breit ist, wird das Widget kompakt gehalten:
- Ein einzeiliges Input-Feld mit Placeholder "Notiz, Link oder Datei..."
- Rechts daneben: Büroklammer-Icon (Datei-Upload) und Sende-Button
- Visuelles Feedback: Spinner während Upload/Speichern
- Passt sich dem bestehenden Nav-Farbschema an (`hsl(var(--nav-*))`)

### 3. Presence-Channel-Fehler beheben (Hintergrund-Fix)
In `src/hooks/useUserStatus.tsx`: Der Presence-Channel hat dasselbe Problem wie der Topic-Backlog — der Channel-Name `user_presence_${currentTenant.id}` ist nicht eindeutig pro Mount. Wird mit `useRef(crypto.randomUUID())` behoben, analog zum bereits implementierten Fix.

## Betroffene Dateien
- `src/components/AppNavigation.tsx` — Upload-Widget einbauen
- `src/hooks/useUserStatus.tsx` — Presence-Channel eindeutig machen

## Ergebnis
- Upload-Feld akzeptiert Links, Dateien, E-Mails und Notizen
- Dateiauswahl vom Rechner funktioniert
- Erfolgsmeldung erscheint nach jedem Upload
- Presence-Fehler in der Konsole verschwindet

