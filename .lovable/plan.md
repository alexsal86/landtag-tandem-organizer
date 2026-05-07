# Mobile App – Plan A + C parallel

Wir bauen die "Erfassen unterwegs"-Aktionen echt aus **und** machen die App optisch/produktreif. In einem Rutsch.

## Teil A — Quick Actions echt machen

### 1. Sprachnotiz 🎙
- `expo-av` für Mikrofon-Aufnahme (Start/Stop, Dauer-Anzeige)
- Upload als `.m4a` in Storage-Bucket `audio-recordings`, Pfad `${user_id}/quicknotes/${uuid}.m4a` (Bucket per Migration anlegen falls nicht vorhanden, mit RLS-Policy "user_id im Pfad")
- Insert in `quick_notes`: `content` enthält Platzhaltertext + signierte URL bzw. Storage-Pfad-Marker, `category='mobile-voice'`
- v1 ohne Transkription. Transkription kann später als Edge-Function-Hook draufkommen.

### 2. Anruf-Erfassung 📞
- Bottom-Sheet mit zwei Modi:
  - **Bekannter Kontakt**: Kontakt suchen (gleiche Suche wie Quick-Action 👤) → `contact_id` füllen
  - **Unbekannte Nummer**: nur `caller_name` + `caller_phone` füllen
- Felder: `call_type` (eingehend/ausgehend Toggle), `duration_minutes` (optional), `notes`, `follow_up_required` (Switch)
- Insert in `call_logs` mit `user_id`, `tenant_id`, `created_by_name` (aus Profil)
- Kann auch direkt aus Kontakt-Detail "Nach Anruf erfassen" gestartet werden (nach `tel:` Link)

### 3. Termin-Schnellerfassung 📅
- Bottom-Sheet: Titel, Datum+Uhrzeit (native Picker), Dauer (Chips: 15/30/60/90 Min), Ort optional
- Insert in `appointments`: `user_id`, `tenant_id`, `start_time`, `end_time`, `category='meeting'`, `status='planned'`
- Kein Recurring, kein Polling — bewusst minimal. Komplexere Terminorga bleibt im Web.

### 4. Foto/Beleg-Aufnahme 📷
- Neue 7. Kachel "Foto" oder als Anhang-Aktion innerhalb Notiz-Sheet
- `expo-image-picker` mit Kamera-Option
- Upload nach Storage-Bucket `documents`, Pfad `${user_id}/mobile/${uuid}.jpg`
- An Notiz angehängt: Foto-Pfad in `quick_notes.content` als Markdown-Bildlink, oder als separate Spalte falls vorhanden
- v1: einfacher Weg → Foto erzeugt automatisch eine `quick_notes` mit Bildlink

### Quick-Actions-Layout danach

```text
┌──────────────┬──────────────┐
│ 📝 Notiz     │ 🎙 Sprach-   │
├──────────────┼──────────────┤
│ ✅ Aufgabe   │ 📅 Termin    │
├──────────────┼──────────────┤
│ 👤 Kontakt   │ 📞 Anruf     │
├──────────────┼──────────────┤
│ 📷 Foto      │              │
└──────────────┴──────────────┘
```

(7 Kacheln, eine Lücke — oder wir machen 8 mit "Letzte Eingaben" als Kachel zur Übersicht der zuletzt erfassten Items.)

## Teil C — Produktreif machen

### 5. App-Icon + Splash + Branding
- Icon (1024×1024) und Splash erstellen — ich generiere Vorschläge mit Imagegen, du wählst aus
- `app.json` ergänzen: `icon`, `splash`, `adaptiveIcon` (Android), `ios.icon`, Background-Color
- Status-Bar-Style passend zum Hintergrund

### 6. Onboarding (3 Slides)
- Beim allerersten App-Start vor Login:
  1. "Schnell erfassen unterwegs" + Symbol
  2. "Sicher per Biometrie" + Symbol
  3. "Wir brauchen Mikrofon, Kamera, Benachrichtigungen" + "Los geht's"-Button
- Flag in SecureStore (`landtag.onboardingDone`)
- Skip-Button rechts oben

### 7. Google OAuth fertig konfigurieren
- `expo-auth-session` mit Google-Provider verdrahten
- **Du musst beisteuern**: in Google Cloud Console OAuth-Client-IDs für Android (`expo` Bundle) und iOS anlegen, Web-Client-ID für Supabase
- Sobald die IDs da sind, `androidClientId` / `iosClientId` / `webClientId` in `app.json` extra-config + Code eintragen
- Magic-Link-Redirect `landtagmobile://auth/callback` musst du in Supabase als Redirect-URL freigeben

### 8. Bessere Fehler-/Erfolgs-UX
- `Alert.alert` raus, stattdessen Toast/Snackbar (z.B. eigene kleine Komponente — keine externe Lib nötig)
- Lade-States auf Buttons (Spinner statt nur disabled)
- Empty States in Kontakt-Suche mit Hinweistexten

### 9. Permissions ehrlich anfragen
- Mikrofon (Sprachnotiz), Kamera (Foto), Foto-Bibliothek (Beleg)
- Beim ersten Tipp auf die jeweilige Aktion Permission anfragen, bei Verweigerung freundlicher Hinweis mit Link in System-Einstellungen

### 10. Header polieren
- Aktiver Tenant + Avatar/Initialen-Bubble + Settings-Icon
- Beim Pull-down: Tenant-Wechsel-Sheet (statt Umweg über Settings)

## Datenbank/Storage-Migrationen

- Bucket `audio-recordings` anlegen (private), RLS: nur eigene Dateien (`storage.foldername(name)[1] = auth.uid()`)
- Bucket `documents` ist vermutlich da (Memory bestätigt) — falls nicht, gleiches Muster
- Keine neuen Tabellen nötig: `call_logs`, `appointments`, `quick_notes` reichen

## Was du außerhalb von Code beisteuerst

- Google Cloud OAuth-Client-IDs (Android + iOS + Web)
- Supabase: `landtagmobile://auth/callback` als Redirect-URL freigeben
- Optional: gewünschte Brand-Farbe für Icon/Splash (sonst nehme ich das bestehende Blau `#155EEF`)

## Bewusst nicht jetzt

- Sprachnotiz-Transkription (kommt später als Edge Function)
- Push-Notifications (gehört zu Plan B "Reagieren")
- Offline-Outbox
- Termin-Recurring/Polls
- Kontakt-Anlage aus Telefon-Adressbuch

## Reihenfolge der Umsetzung

1. Migrationen (audio-recordings Bucket + Policies)
2. Permissions-Helper
3. Sprachnotiz-Sheet
4. Anruf-Sheet
5. Termin-Sheet
6. Foto-Flow
7. Toast-System + Buttons polieren
8. Icon + Splash + app.json
9. Onboarding-Slides
10. Google OAuth (sobald Client-IDs da sind)

OK so? Wenn ja, lege ich los.
