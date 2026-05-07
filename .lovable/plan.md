# Mobile App – Quick Actions Startscreen + erweiterter Login

## Schema-Klärung quick_notes (erledigt)

`public.quick_notes` hat `user_id` (NOT NULL, auth user) und `content` (NOT NULL). Kein `tenant_id` nötig. Wir schreiben minimal: `{ user_id, content, title?, category: 'mobile' }`.

## Erweiterter Login (Antwort auf Frage 3)

Vorschlag für die mobile App, **mehrstufig** angeordnet:

1. **Erstanmeldung** – mehrere Wege zur Auswahl auf dem Login-Screen:
   - **E-Mail + Passwort** (wie bisher, bleibt als Fallback)
   - **Magic Link** – ein Tipp auf "Login-Link per Mail", User klickt im Mail-Programm, Deep-Link `landtagmobile://auth/callback` öffnet die App und legt die Session an
   - **Google Sign-In** – nativer Button via `expo-auth-session` / Google Provider (in Supabase Dashboard zu aktivieren)
   - *(Apple Sign-In als Folgeschritt sobald iOS-Build relevant wird – auf Android nicht erlaubt von Apple)*
2. **Folgeanmeldungen auf demselben Gerät** – nach erstem erfolgreichem Login:
   - **Biometrie** (Face ID / Fingerprint) via `expo-local-authentication`
   - Refresh-Token liegt verschlüsselt im `expo-secure-store`, Biometrie schaltet ihn nur frei
   - User kann Biometrie in den App-Einstellungen wieder ausschalten
3. **Logout** löscht Refresh-Token und Biometrie-Flag aus SecureStore.

Damit hat man: bequem (Magic Link/Google beim ersten Mal), schnell (Biometrie ab dem zweiten Mal), sicher (kein Passwort dauerhaft auf dem Gerät).

## Quick-Actions-Startscreen

Nach Login einziger Hauptscreen, 6 Touch-Kacheln (2 Spalten):

```text
┌──────────────┬──────────────┐
│ 📝 Notiz     │ 🎙 Sprach-   │
│              │ notiz        │
├──────────────┼──────────────┤
│ ✅ Aufgabe   │ 📅 Termin    │
├──────────────┼──────────────┤
│ 👤 Kontakt   │ 📞 Anruf     │
│ suchen       │ erfassen     │
└──────────────┴──────────────┘
```

Header: aktiver Tenant + Settings-Icon (Logout, Biometrie an/aus).

### v1-Umfang (echt funktionierend)

- **📝 Notiz**: Bottom-Sheet → Titel (optional) + Inhalt → Insert in `quick_notes`
- **✅ Aufgabe**: Titel + Fälligkeit (optional) → Insert in `tasks` (`category='mobile'`, `created_by=profiles.id`, `tenant_id` aus aktivem Tenant)
- **👤 Kontakt suchen**: Suchfeld → Live-Suche `contacts` (Tenant-gefiltert) → Trefferliste → Detail mit "Anrufen" (`tel:`) und "Mailen" (`mailto:`)

### v1-Platzhalter (Kachel sichtbar, "Bald verfügbar"-Toast)

- 🎙 Sprachnotiz, 📅 Termin, 📞 Anruf erfassen

## Umsetzungsschritte

1. **Dependencies** in `apps/mobile`:
   - `@supabase/supabase-js`
   - `@react-native-async-storage/async-storage`
   - `expo-secure-store`
   - `expo-local-authentication`
   - `expo-auth-session` + `expo-crypto` + `expo-web-browser` (für Google + Magic-Link-Callback)
   - `expo-linking` (für `landtagmobile://` Deep-Links)
2. **Supabase-Client** in `packages/api-client/src/supabase.ts` – mit AsyncStorage als Auth-Storage, `autoRefreshToken: true`, `persistSession: true`
3. **AuthContext** in `apps/mobile/src/state/AuthContext.tsx` – hält `session`, `profileId`, lädt beim App-Start `getSession()`, hört auf `onAuthStateChange`
4. **TenantContext** – lädt Memberships (`tenant_users` + `tenants`), persistiert aktive Tenant-ID in SecureStore
5. **Routing** mit Expo Router Gruppen:
   - `app/(auth)/login.tsx` (E-Mail/Passwort + Magic Link + Google + Biometrie-Schnellzugang)
   - `app/(auth)/callback.tsx` (Deep-Link-Handler für Magic-Link)
   - `app/(app)/_layout.tsx` (Guard: ohne Session → Redirect)
   - `app/(app)/index.tsx` → Quick-Actions-Grid
   - `app/(app)/settings.tsx` (Biometrie an/aus, Tenant wechseln, Logout)
6. **Quick-Action-Sheets** – React-Native Modals (`Modal` aus `react-native`), kein extra Lib
7. **App-Identität minimal** – Platzhalter-Icon/Splash via Expo-CLI, damit `eas build` durchläuft
8. **`app.json` ergänzen** – `scheme: 'landtagmobile'`, iOS/Android Intent-Filter für Deep-Links, Google-OAuth-`androidClientId`/`iosClientId` (kommen später aus Google Cloud Console)

## Was du außerhalb von Code noch tun musst

- **Google OAuth** in Supabase aktivieren (Dashboard → Authentication → Providers) und Client-IDs für Android/iOS in der Google Cloud Console anlegen. Ich kann erst integrieren, wenn die Client-IDs da sind – bis dahin liefere ich den Button mit Hinweis "noch nicht konfiguriert" aus.
- **Magic Link Redirect** in Supabase erlauben: `landtagmobile://auth/callback` zur Liste der erlaubten Redirect-URLs hinzufügen.

## Aus Scope ausgenommen (kommt später)

Push-Notifications, Offline-Cache, MyWork-Listen, Kalenderansicht, Briefings, Sprachnotiz-Recording, native Termin-Erfassung, native Anrufaufzeichnung.

## Bestätigung

OK so? Speziell:
- Login-Mix **E-Mail+Passwort + Magic Link + Google + Biometrie ab 2. Login** – passt das?
- Kachel-Auswahl wie oben (3 echt, 3 Platzhalter)?

Wenn ja, setze ich um.
