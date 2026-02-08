
# Plan: 12 Verbesserungen -- Push, Deeplinks, Avatare, Layout und Benachrichtigungen

## Uebersicht

| Nr | Problem | Ursache | Loesung |
|----|---------|---------|---------|
| 1 | Keine echten Browser-Push-Benachrichtigungen | `create_notification` DB-Funktion erzeugt nur In-App-Eintrag, ruft aber NICHT die Push-Edge-Function auf | DB-Trigger oder Edge-Function-Aufruf nach Notification-Insert |
| 2 | Deep-Links in der Glocke fuehren zum Dashboard | `window.location.href = '/#' + path` -- App nutzt `BrowserRouter`, nicht `HashRouter`, daher wird `/#/tasks` als Hash-Fragment interpretiert | `navigate(path)` via `useNavigate()` verwenden |
| 3 | Zu viele Wiedervorlage-Benachrichtigungen | `useRef` wird bei jedem Komponenten-Mount zurueckgesetzt, daher bei jedem Tab-Wechsel erneut | Deduplizierung ueber DB nutzen (1-Minute-Fenster in `create_notification` reicht nicht fuer taegliche Wiedervorlagen) |
| 4 | Bild-Punkte 2,3,4: Einzelne Benachrichtigungen loeschen, Historie-Seite, Link zu Einstellungen | Fehlen im NotificationCenter | X-Button zum Loeschen, "Alle anzeigen"-Link zu `/notifications`, Link zu `/settings` aendern |
| 5 | Avatar in Online-Anzeige (Header) fehlt | `avatar_url` ist im Presence-State nicht enthalten oder leer | Avatar-URL beim Presence-Track mitsenden und in der Anzeige verwenden |
| 6 | Entscheidungen in "Meine Arbeit" scrollen intern statt Gesamtseite | `ScrollArea className="h-[calc(100vh-22rem)]"` in `MyWorkDecisionsTab` | `ScrollArea` entfernen, Inhalt in den normalen Seitenfluss einbetten |
| 7 | Standard-Benutzer fuer Entscheidungen | Fehlt als Feature | Einstellung in LocalStorage/DB speichern, beim Erstellen einer Entscheidung vorauswaehlen |
| 8 | Admin-Sidebar: Super-Admin Sektion + Umstrukturierung | "Politik & Organisation" enthaelt Tenants + Kreisverband-Items die nur Super-Admins betreffen | Neuen Oberpunkt "Super-Admin" erstellen, Verwaltung nach "System & Sicherheit" verschieben |
| 9 | Falscher Avatar + Rolle in Einstellungen | Query nutzt `.eq("id", user.id)` statt `.eq("user_id", user.id)`, Rolle kommt aus `profiles.role` statt `user_roles` | Query korrigieren, Rolle aus `user_roles` laden |
| 10 | Profil-Seite ohne Header/Navigation | `EditProfile` rendert standalone ohne `AppNavigation`/`AppHeader` | Route in Index.tsx einbetten oder Layout-Wrapper nutzen |
| 11 | Dashboard-Layout falsch | News auf voller Breite, Begruessung darunter | Begruessung (40%) + News (60%) nebeneinander, QuickActions darunter, Custom-Tabs darunter |
| 12 | Avatar in Status-Dialog und Online-Widget | Fehlende Avatar-Bilder | Avatar-URL korrekt laden und anzeigen |

---

## Technische Details

### 1. Echte Push-Benachrichtigungen

**Problem:** Die DB-Funktion `create_notification` (in der Migration) erzeugt nur einen Eintrag in der `notifications`-Tabelle. Sie ruft NICHT die `send-push-notification` Edge Function auf. Push wird nur beim manuellen Test gesendet.

**Loesung:** Einen DB-Trigger auf `notifications` INSERT erstellen, der die `push-notification-worker` Edge Function aufruft:

- **Option A (bevorzugt):** `pg_net` Extension nutzen (falls verfuegbar), um nach jedem INSERT in `notifications` automatisch die Edge Function aufzurufen
- **Option B:** Da `pg_net` moeglicherweise nicht aktiviert ist, stattdessen auf Client-Seite: Nach jedem `create_notification` RPC-Aufruf pruefen, ob `push_enabled` in den User-Settings aktiv ist, und dann die Edge Function aufrufen

Fuer die sofortige Loesung: Im `useNotifications.tsx` Hook, wenn eine neue Notification via Realtime reinkommt, wird geprueft ob der User push_enabled hat. Die `send-push-notification` Edge Function wird dann mit den Notification-Daten aufgerufen.

**Effektivste Loesung:** Die `create_notification` DB-Funktion erweitern, sodass sie `pg_net.http_post` aufruft, um die Edge Function zu triggern. Falls `pg_net` nicht verfuegbar, wird ein DB-Trigger mit `supabase_functions.http_request` verwendet.

**Dateien:** Migration SQL (Trigger), `supabase/functions/send-push-notification/index.ts` (User-spezifische Filterung)

### 2. Deep-Links reparieren

**Problem:** In `NotificationCenter.tsx` Zeile 228: `window.location.href = '/#' + path;` -- Die App nutzt `BrowserRouter`, nicht `HashRouter`. Dadurch wird z.B. `/tasks?highlight=123` als Hash-Fragment ignoriert und der User landet auf `/` (Dashboard).

**Loesung:**
- `useNavigate()` Hook in der `NotificationItem`-Komponente nutzen
- `navigate(path)` statt `window.location.href = '/#' + path`
- Ebenso den Footer-Link zu den Einstellungen korrigieren

```tsx
const navigate = useNavigate();
// ...
const handleClick = () => {
  if (!notification.is_read) onMarkRead(notification.id);
  const path = buildDeepLinkPath(notification);
  navigate(path);
  onClose?.();
};
```

**Datei:** `src/components/NotificationCenter.tsx`

### 3. Wiedervorlage-Benachrichtigungen begrenzen

**Problem:** Bei jedem Mount von `QuickNotesList` wird `notifiedRef` zurueckgesetzt und fuer jede faellige Wiedervorlage eine Notification erzeugt. Die 1-Minute-Dedup in `create_notification` verhindert nur Duplikate innerhalb einer Minute.

**Loesung:** 
- `data_param` um ein `date`-Feld erweitern (das Wiedervorlage-Datum), damit die DB-Dedup per Tag funktioniert
- Alternativ: `localStorage` nutzen, um zu tracken, welche Notiz-IDs bereits benachrichtigt wurden (pro Tag)
- Beste Loesung: Pro Wiedervorlage nur EINE Benachrichtigung am Tag -- das Follow-Up-Datum als Teil von `data_param` mitsenden und eine Dedup-Pruefung auf Tages-Ebene einfuehren

```tsx
const today = new Date().toISOString().split('T')[0];
const notifiedKey = `follow_up_notified_${today}`;
const alreadyNotified = JSON.parse(localStorage.getItem(notifiedKey) || '[]');

followUpNotes
  .filter(note => !alreadyNotified.includes(note.id))
  .forEach(note => {
    supabase.rpc('create_notification', { ... });
    alreadyNotified.push(note.id);
  });

localStorage.setItem(notifiedKey, JSON.stringify(alreadyNotified));
```

**Datei:** `src/components/shared/QuickNotesList.tsx`

### 4. Benachrichtigungs-Features aus dem Bild

**4a. Einzelne Benachrichtigungen loeschen (X-Button)**
- Einen kleinen X-Button an jeder Notification hinzufuegen
- `deleteNotification(id)` Funktion in `useNotifications.tsx` ergaenzen
- DB: `DELETE FROM notifications WHERE id = $1 AND user_id = $2`

**4b. Benachrichtigungs-Historie-Seite**
- Neue Route `/notifications` mit vollstaendiger Filterfunktion
- Filter: Typ (Dropdown), Zeitraum (Datum-Picker), Status (gelesen/ungelesen/alle)
- Im NotificationCenter Footer "Alle anzeigen" statt "Benachrichtigungseinstellungen"
- "Benachrichtigungseinstellungen" wird separat verlinkt

**4c. Benachrichtigungseinstellungen-Link aendern**
- Der Footer-Link im NotificationCenter soll auf `/notifications` verweisen (Historie)
- Dort gibt es dann einen Link zu den Einstellungen

**Dateien:** `src/components/NotificationCenter.tsx`, `src/hooks/useNotifications.tsx`, neue Datei `src/pages/NotificationsPage.tsx`, `src/App.tsx` (Route)

### 5. Avatar in Online-Anzeige (Header)

**Problem:** Im Header (AppHeader.tsx, Zeile 198-214) werden die `onlineUsers` mit Avatar angezeigt. Die `avatar_url` kommt aus dem Presence-State. Das Problem: Die Avatare werden moeglicherweise nicht korrekt geladen, weil `onlineUser.avatar_url` leer sein kann.

**Loesung:** 
- In `useUserStatus.tsx` beim `track()`-Aufruf sicherstellen, dass `avatar_url` aus dem Profil geladen wird
- Im `OnlineUsersWidget.tsx` den Avatar korrekt anzeigen (ist bereits implementiert, moeglicherweise fehlende `avatar_url` im State)
- Das `AvatarImage` muss `src` korrekt erhalten

**Datei:** `src/hooks/useUserStatus.tsx`, `src/components/OnlineUsersWidget.tsx`

### 6. Entscheidungen: Seiten-Scroll statt Container-Scroll

**Problem:** In `MyWorkDecisionsTab.tsx` Zeile 498: `<ScrollArea className="h-[calc(100vh-22rem)]">` erzeugt einen eigenen scrollbaren Container.

**Loesung:** `ScrollArea` durch ein normales `div` ersetzen, damit die gesamte Seite scrollt:

```tsx
// Alt:
<ScrollArea className="h-[calc(100vh-22rem)]">
  {/* content */}
</ScrollArea>

// Neu:
<div>
  {/* content */}
</div>
```

**Datei:** `src/components/my-work/MyWorkDecisionsTab.tsx`

### 7. Standard-Benutzer fuer Entscheidungen

**Loesung:**
- In `SettingsView.tsx` oder einem separaten Bereich: Dropdown "Standard-Teilnehmer fuer Entscheidungen" mit Benutzer-Auswahl
- Speicherung in `localStorage` unter `default_decision_participants`
- In `StandaloneDecisionCreator.tsx` und `MyWorkDecisionsTab.tsx`: Beim Oeffnen des Dialogs die gespeicherten Standard-Teilnehmer vorladen
- In `DecisionOverview.tsx`: Gleiche Logik

**Dateien:** `src/components/task-decisions/StandaloneDecisionCreator.tsx`, `src/components/my-work/MyWorkDecisionsTab.tsx`, `src/components/task-decisions/DecisionOverview.tsx`

### 8. Admin-Sidebar: Super-Admin Sektion

**Aktuelle Struktur:**
```
Politik & Organisation
  - Kreisverbande
  - Betreuungswahlkreise
  - Wahlkreis-Zuordnung
  - Verwaltung (Expenses)

System & Sicherheit
  - Allgemein
  - Login-Anpassung
  - Tenants (superAdminOnly)
  - Rechte & Rollen (superAdminOnly)
  - Audit-Logs
  - Archivierung
```

**Neue Struktur:**
```
System & Sicherheit
  - Allgemein
  - Login-Anpassung
  - Verwaltung (ehemals unter Politik)  <-- NEU hier
  - Audit-Logs
  - Archivierung

Super-Admin (NUR fuer Super-Admins sichtbar)
  - Tenants
  - Kreisverbande
  - Betreuungswahlkreise
  - Wahlkreis-Zuordnung
  - Rechte & Rollen

(Politik & Organisation wird entfernt)
```

**Datei:** `src/components/administration/AdminSidebar.tsx`

### 9. Avatar + Rolle in Einstellungen

**Problem 1:** In `SettingsView.tsx` Zeile 56-61:
```tsx
const { data: profile } = await supabase
  .from("profiles")
  .select("*")
  .eq("id", user.id)  // FALSCH - profiles hat user_id, nicht id
  .single();
```

**Problem 2:** `userProfile?.role` wird angezeigt, aber `profiles` hat kein `role`-Feld. Die Rolle steht in `user_roles`.

**Loesung:**
- Query auf `.eq("user_id", user.id)` aendern und `tenant_id` Filter hinzufuegen
- Rolle separat aus `user_roles` laden
- Avatar-URL korrekt anzeigen

**Datei:** `src/components/SettingsView.tsx`

### 10. Profil-Seite mit Header und Navigation

**Problem:** `EditProfile` ist eine standalone Route (`/profile/edit`) ohne Layout-Wrapper. In `App.tsx` Zeile 75: `<Route path="/profile/edit" element={<EditProfile />} />` -- kein Layout.

**Loesung:** Die Route `/profile/edit` in `Index.tsx` einbetten, sodass sie das gleiche Layout (AppNavigation + AppHeader) wie alle anderen Seiten hat. Der Zurueck-Button soll `navigate('/settings')` aufrufen.

Option: Statt einer separaten Route die Profil-Bearbeitung als Section in `Index.tsx` rendern (wie alle anderen Views). Dafuer:
- In `Index.tsx` den Case `profile-edit` oder `profile` hinzufuegen
- In `App.tsx` die standalone Route entfernen (oder auf Index umleiten)
- In `EditProfile.tsx` den Zurueck-Button auf `/settings` setzen

**Dateien:** `src/App.tsx`, `src/pages/Index.tsx`, `src/pages/EditProfile.tsx`

### 11. Dashboard-Layout: Begruessung links + News rechts

**Aktuell (CustomizableDashboard.tsx, Zeile 266-295):**
```
[News (volle Breite)]
[QuickActions (volle Breite)]
[DashboardGreetingSection]
```

**Gewuenscht:**
```
[Begruessung (40%) | Aktuelle Nachrichten (60%)]
[QuickActions / Schnellzugriff]
[Custom Widget-Tabs (Notes, Anrufe, Zeitmessung)]
```

**Loesung:**
```tsx
{/* Begruessung + News nebeneinander */}
<div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
  <div className="lg:col-span-2">
    <DashboardGreetingSection />
  </div>
  <div className="lg:col-span-3">
    <h2 className="text-2xl font-bold mb-4">Aktuelle Nachrichten</h2>
    <NewsWidget />
  </div>
</div>

{/* QuickActions darunter */}
<div className="mb-6">
  <QuickActionsWidget className="shadow-sm" widgetSize="full-width" />
</div>

{/* Custom Tabs (WidgetQuickAccess) darunter */}
<div className="mb-8">
  <WidgetQuickAccess />
</div>
```

**Datei:** `src/components/CustomizableDashboard.tsx`

### 12. Avatar-Korrekturen (Status-Dialog, Online-Widget, Header-Kreis)

**12a. Status-Dialog Avatar:** In `UserStatusSelector.tsx` wird kein Avatar angezeigt. Ein Avatar-Bereich oben im Dialog hinzufuegen.

**12b. Online-Widget Hover:** Im `OnlineUsersWidget.tsx` das Hover-Styling verbessern -- das gruene Viereck durch ein saubereres Hover-Design ersetzen, und beim Hover die Anwesenheitszeit + Status anzeigen.

**12c. Header-Avatar Status-Kreis Position:** In `AppHeader.tsx` Zeile 267: `className="absolute -bottom-0.5 -right-0.5"` -- der Status-Emoji sitzt zu weit innen. Aendern zu `-bottom-1 -right-1` damit er den Avatar anschneidet statt darinnen zu sitzen.

**Dateien:** `src/components/UserStatusSelector.tsx`, `src/components/OnlineUsersWidget.tsx`, `src/components/layout/AppHeader.tsx`

---

## Betroffene Dateien

| Aktion | Datei |
|--------|-------|
| DB-Migration | Trigger fuer Push-Notifications nach INSERT |
| Bearbeiten | `src/components/NotificationCenter.tsx` (Deeplinks, Loeschen, Historie-Link) |
| Bearbeiten | `src/hooks/useNotifications.tsx` (deleteNotification Funktion) |
| Bearbeiten | `src/components/shared/QuickNotesList.tsx` (Follow-Up Dedup) |
| Bearbeiten | `src/components/my-work/MyWorkDecisionsTab.tsx` (ScrollArea entfernen) |
| Bearbeiten | `src/components/task-decisions/StandaloneDecisionCreator.tsx` (Default-User) |
| Bearbeiten | `src/components/administration/AdminSidebar.tsx` (Super-Admin Sektion) |
| Bearbeiten | `src/components/SettingsView.tsx` (Avatar + Rolle Fix) |
| Bearbeiten | `src/pages/EditProfile.tsx` (Zurueck-Button) |
| Bearbeiten | `src/pages/Index.tsx` (Profile-Route einbetten) |
| Bearbeiten | `src/App.tsx` (Notifications-Route, Profile-Route anpassen) |
| Bearbeiten | `src/components/CustomizableDashboard.tsx` (Layout 40/60) |
| Bearbeiten | `src/components/layout/AppHeader.tsx` (Status-Kreis Position) |
| Bearbeiten | `src/components/OnlineUsersWidget.tsx` (Hover + Avatar) |
| Bearbeiten | `src/components/UserStatusSelector.tsx` (Avatar hinzufuegen) |
| Bearbeiten | `src/hooks/useUserStatus.tsx` (Avatar in Presence-Track) |
| Neu | `src/pages/NotificationsPage.tsx` (Historie-Seite) |

## Reihenfolge

1. Deep-Links reparieren (NotificationCenter -- `navigate()` statt `window.location.href`)
2. Wiedervorlage-Benachrichtigungen begrenzen (localStorage Dedup)
3. NotificationCenter: Loeschen-Button, Historie-Link
4. Notifications-Seite erstellen + Route einrichten
5. Push-Notification Trigger (DB-Migration oder Client-seitig)
6. MyWorkDecisionsTab: ScrollArea entfernen
7. Standard-Benutzer fuer Entscheidungen
8. Admin-Sidebar umstrukturieren
9. Settings: Avatar + Rolle korrigieren
10. EditProfile: Layout-Wrapper + Zurueck-Button
11. Dashboard-Layout: 40/60 Aufteilung
12. Avatar-Fixes: Header-Kreis, Status-Dialog, Online-Widget
