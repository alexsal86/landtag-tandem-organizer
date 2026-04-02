

# Navigation-Umbau: Quick-Action-Panels, Header entfernen, Avatar + Anwesenheit in Nav

## Übersicht

Die Quick-Action-Buttons in der Sidebar werden zu **Panel-Umschaltern**: Jeder Button ersetzt den normalen Navigationsinhalt durch einen eigenen Bereich. Der Header wird komplett entfernt, da alle Elemente (Benachrichtigungen, Avatar, Anwesenheit, Quick Actions, Suche) in die Navigation wandern.

## Konzept der Quick-Action-Panels

```text
Aktiver Button  │ Sidebar zeigt
────────────────┼──────────────────────────────
Home (default)  │ Normale Navigation (Gruppen, Schnellzugriff, etc.)
Benachrichtigung│ NUR Benachrichtigungen (volle Sidebar-Höhe)
Akten           │ NUR Fallakten-Liste + Dossier-Upload
Termine         │ NUR kommende Termine + Anfragen + Feedback-Hinweis
```

## Änderungen im Detail

### 1. Quick-Action-Panels statt Navigation (`AppNavigation.tsx`)

**State**: `activePanel: 'home' | 'notifications' | 'casefiles' | 'appointments'` (default: `'home'`)

- **Home**: Wie bisher — normale Navigationsgruppen, Schnellzugriff, Footer
- **Benachrichtigungen**: Der bestehende Inline-Panel wird zur Vollansicht (ganzer Bereich unter Quick-Actions). Keine normale Nav sichtbar.
- **Fallakten**: Kompakte Liste der eigenen/zugewiesenen Fallakten (via `useCaseFiles`-Hook) + Dossier-Upload-Fläche (Dropzone für SmartCapture-Inbox)
- **Termine** (neu, Calendar-Icon): Kompakte Liste der Termine der nächsten 3-5 Tage (via Supabase-Query auf `appointments`), Terminanfragen (offene Entscheidungen mit `appointment_request`-Marker) und ein Hinweis-Banner wenn offene Termin-Feedbacks existieren

### 2. Neues Termin-Icon als Quick-Action

Neben Home, Bell, Briefcase und Search kommt ein **Calendar**-Icon als 4. Panel-Button (Search bleibt als reiner Dialog-Trigger, kein Panel).

### 3. NotificationBell aus Header entfernen

Wird nicht mehr benötigt — Benachrichtigungen sind jetzt im Sidebar-Panel.

### 4. Avatar-Menü in die Navigation (ganz unten)

Das gesamte User-Avatar-Dropdown (Profil, Einstellungen, Status-Selector, Abmelden) wird in den unteren Bereich der Navigation verschoben, unter Hilfe/Team/Admin. Zeigt Avatar + Name + Status-Emoji.

### 5. App-Untertitel unter dem App-Namen

Im Logo-Header-Bereich der Navigation wird `appSettings.app_subtitle` als zweite Zeile unter `appSettings.app_name` angezeigt.

### 6. Anwesenheit (Online-Users) in die Navigation

Die `OnlineUsersWidget`-Popover-Anzeige aus dem Header wandert in die Navigation, z.B. als kompakte Avatar-Reihe oberhalb des User-Avatars oder unterhalb der Quick-Actions.

### 7. Header komplett entfernen

- `AppHeader` wird aus `Index.tsx` entfernt
- Quick-Actions (z.B. "Neuer Termin", "Neue Aufgabe") werden stattdessen direkt in die jeweiligen View-Komponenten verschoben oder über die bestehende `SubNavigation` abgebildet
- Die `sectionConfig` mit Quick-Actions bleibt als Utility erhalten für `SubNavigation` oder inline-Buttons auf den Seiten
- `SubNavigation` bleibt bestehen (zeigt Unter-Tabs für Gruppen)

### 8. Index.tsx Layout-Anpassung

- Entferne `<AppHeader />` aus dem Layout
- `SubNavigation` rückt direkt an die Oberkante des Content-Bereichs
- Quick-Action-Buttons (Neuer Termin etc.) werden in die `SubNavigation` integriert oder als Inline-Buttons auf den jeweiligen Seiten belassen

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/components/AppNavigation.tsx` | Panel-System (home/notifications/casefiles/appointments), Calendar-Quick-Action, Avatar+Status unten, Subtitle, Anwesenheit |
| `src/pages/Index.tsx` | `<AppHeader />` entfernen, Layout anpassen |
| `src/components/layout/AppHeader.tsx` | Kann gelöscht oder nur noch für Mobile behalten werden |
| `src/components/layout/SubNavigation.tsx` | Optional: Quick-Action-Button integrieren |
| `src/components/MobileHeader.tsx` | Bleibt bestehen (Mobile-Header separat) |

## Nav-Struktur (neu)

```text
┌────────────────────────────────┐
│ [Logo] App-Name                │
│        App-Untertitel          │
├────────────────────────────────┤
│ [🏠] [🔔] [📅] [📁] [🔍]    │  ← Panel-Switcher + Search
├────────────────────────────────┤
│                                │
│  Panel-Inhalt:                 │
│  - Home: normale Nav           │
│  - Bell: Benachrichtigungen    │
│  - Calendar: Termine           │
│  - Briefcase: Fallakten        │
│                                │
├────────────────────────────────┤
│ 👥 Online: [Avatars...]       │  ← Anwesenheit
├────────────────────────────────┤
│ [Avatar] Max Mustermann  🟢   │  ← User-Menü (Dropdown)
│          online                │
└────────────────────────────────┘
```

