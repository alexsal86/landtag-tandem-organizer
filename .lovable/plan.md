
# Plan: Globale Team-Mitteilungen (System-Banner)

## Uebersicht

Eine neue Funktion fuer globale Mitteilungen an das gesamte Team, die als auffaelliges Banner ueber dem Header angezeigt werden.

## Architektur

```text
+--------------------------------------------------+
|  GLOBALES BANNER (ueber gesamter App)            |
|  [Rot/Orange/Gelb/Blau je nach Prioritaet]       |
|  Nachricht hier...                    [X erledigt]|
+--------------------------------------------------+
|  Header (AppHeader.tsx)                          |
+--------------------------------------------------+
|  Navigation | Hauptinhalt                        |
+--------------------------------------------------+
```

---

## 1. Datenbank-Schema

### Neue Tabelle: `team_announcements`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | uuid | Primary Key |
| tenant_id | uuid | Mandanten-Zuordnung (FK zu tenants) |
| author_id | uuid | Ersteller (FK zu auth.users) |
| title | text | Kurzer Titel der Mitteilung |
| message | text | Vollstaendiger Nachrichtentext |
| priority | text | 'critical', 'warning', 'info', 'success' |
| starts_at | timestamptz | Ab wann anzeigen (NULL = sofort) |
| expires_at | timestamptz | Bis wann anzeigen (NULL = unbegrenzt) |
| is_active | boolean | Manuelles Aktivieren/Deaktivieren |
| created_at | timestamptz | Erstellungszeitpunkt |
| updated_at | timestamptz | Letztes Update |

### Neue Tabelle: `team_announcement_dismissals`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | uuid | Primary Key |
| announcement_id | uuid | FK zu team_announcements |
| user_id | uuid | Wer hat als erledigt markiert |
| dismissed_at | timestamptz | Wann als erledigt markiert |

### Farbschema nach Prioritaet

| Prioritaet | Farbe | Hex-Codes | Verwendungszweck |
|------------|-------|-----------|------------------|
| critical | Rot | BG: #fee2e2, Border: #ef4444, Text: #991b1b | Dringende, kritische Meldungen |
| warning | Orange | BG: #fed7aa, Border: #f97316, Text: #9a3412 | Wichtige Hinweise, Fristen |
| info | Blau | BG: #dbeafe, Border: #3b82f6, Text: #1e40af | Allgemeine Informationen |
| success | Gruen | BG: #dcfce7, Border: #22c55e, Text: #166534 | Positive Nachrichten, Erfolge |

---

## 2. RLS-Policies

```sql
-- Lesen: Alle authentifizierten Benutzer im gleichen Tenant
CREATE POLICY "Users can read announcements in their tenant"
ON team_announcements FOR SELECT
TO authenticated
USING (
  tenant_id IN (SELECT tenant_id FROM user_tenant_memberships WHERE user_id = auth.uid() AND is_active = true)
);

-- Erstellen/Bearbeiten: Nur abgeordneter und bueroleitung
CREATE POLICY "Admins can manage announcements"
ON team_announcements FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('abgeordneter', 'bueroleitung')
  )
);

-- Dismissals: Benutzer koennen nur eigene erstellen
CREATE POLICY "Users can manage own dismissals"
ON team_announcement_dismissals FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
```

---

## 3. Frontend-Komponenten

### 3.1 GlobalAnnouncementBanner.tsx (NEU)

Position: Wird in `src/pages/Index.tsx` ganz oben eingefuegt, noch vor dem Layout-Wrapper.

**Funktionen:**
- Laedt aktive Mitteilungen fuer den aktuellen Tenant
- Filtert bereits als erledigt markierte
- Zeigt Banner mit Prioritaets-Farbe an
- "Als erledigt markieren" Button pro Benutzer
- Realtime-Subscription fuer sofortige Updates

**Struktur:**
```typescript
interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: 'critical' | 'warning' | 'info' | 'success';
  author_name: string;
  created_at: string;
}

// Farb-Mapping
const priorityStyles = {
  critical: { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-800', icon: AlertTriangle },
  warning: { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-800', icon: AlertCircle },
  info: { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-800', icon: Info },
  success: { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-800', icon: CheckCircle },
};
```

### 3.2 TeamAnnouncementsManager.tsx (NEU)

Position: In MyWorkView.tsx unter dem "Team"-Tab, nur fuer abgeordneter/bueroleitung sichtbar.

**Funktionen:**
- Neue Mitteilung erstellen (Dialog)
- Aktive Mitteilungen verwalten
- Archiv vergangener Mitteilungen einsehen
- Wer hat bereits als erledigt markiert (Fortschritt)

**UI-Elemente:**
- Button "Neue Mitteilung"
- Tabelle mit aktiven Mitteilungen
- Tabs: "Aktiv" | "Archiv"
- Pro Mitteilung: Titel, Prioritaet-Badge, Zeitraum, Fortschritt (X von Y gelesen), Aktionen

### 3.3 CreateAnnouncementDialog.tsx (NEU)

**Felder:**
- Titel (Pflicht, max 100 Zeichen)
- Nachricht (Pflicht, Textarea)
- Prioritaet (Select: Kritisch/Warnung/Info/Erfolg)
- Anzeigedauer:
  - Sofort starten / Geplanter Start (DateTimePicker)
  - Unbegrenzt / Enddatum (DateTimePicker)
- Vorschau des Banners in gewaehlter Farbe

---

## 4. Zusaetzliche Features

### 4.1 Fortschrittsanzeige fuer Ersteller

Admins sehen, wer die Mitteilung bereits als erledigt markiert hat:
- Fortschrittsbalken: "5 von 8 Teammitgliedern"
- Liste mit Namen und Zeitstempel

### 4.2 Benachrichtigungen

Bei neuer kritischer oder Warn-Mitteilung:
- Push-Notification an alle Team-Mitglieder (optional, ueber bestehendes Notification-System)

### 4.3 Zeitbasierte Automatik

- Mitteilungen werden automatisch angezeigt wenn `starts_at` erreicht
- Mitteilungen verschwinden automatisch wenn `expires_at` ueberschritten
- Cron-artige Logik im Frontend (Intervall-Check alle 60 Sekunden)

### 4.4 Mehrere gleichzeitige Banner

Falls mehrere aktive Mitteilungen existieren:
- Sortiert nach Prioritaet (critical > warning > info > success)
- Dann nach Erstellungsdatum (neueste zuerst)
- Maximal 3 Banner gleichzeitig sichtbar
- "Weitere X Mitteilungen" Link zum Team-Tab

### 4.5 Benachrichtigungs-Toggle in Einstellungen

Benutzer koennen in den Einstellungen deaktivieren:
- "Banner-Benachrichtigungen anzeigen" (on/off)
- Falls off: Banner wird trotzdem im Team-Tab sichtbar, aber nicht global

---

## 5. Dateistruktur

```text
src/
  components/
    announcements/
      GlobalAnnouncementBanner.tsx      # Banner-Komponente
      TeamAnnouncementsManager.tsx      # Verwaltungs-Ansicht
      CreateAnnouncementDialog.tsx      # Erstellungs-Dialog
      AnnouncementCard.tsx              # Einzelne Mitteilung (Liste)
      AnnouncementProgress.tsx          # Fortschrittsanzeige
    my-work/
      MyWorkTeamTab.tsx                 # (erweitert)
  hooks/
    useTeamAnnouncements.ts             # Hook fuer Daten-Logik
  pages/
    Index.tsx                           # (erweitert mit Banner)
```

---

## 6. Integration in bestehendes System

### Index.tsx Aenderung

```typescript
// In Index.tsx, vor dem ThemeProvider/Layout:
return (
  <ThemeProvider>
    {/* NEUES Banner ueber allem */}
    <GlobalAnnouncementBanner />
    
    {/* Bestehender Layout */}
    <div className="flex min-h-screen...">
      ...
    </div>
  </ThemeProvider>
);
```

### MyWorkTeamTab.tsx Erweiterung

Neuer Abschnitt fuer abgeordneter/bueroleitung:
```typescript
{isAdmin && (
  <div className="mb-6">
    <TeamAnnouncementsManager />
  </div>
)}
```

---

## 7. Zusammenfassung der Aenderungen

| Komponente | Aktion |
|------------|--------|
| Datenbank | 2 neue Tabellen + RLS-Policies |
| GlobalAnnouncementBanner.tsx | Neu erstellen |
| TeamAnnouncementsManager.tsx | Neu erstellen |
| CreateAnnouncementDialog.tsx | Neu erstellen |
| AnnouncementCard.tsx | Neu erstellen |
| useTeamAnnouncements.ts | Neu erstellen |
| Index.tsx | Banner-Komponente einfuegen |
| MyWorkTeamTab.tsx | Manager-Komponente einfuegen |

---

## 8. Moegliche Erweiterungen (spaeter)

- **Anhang-Support**: Dateien/Bilder an Mitteilungen anhaengen
- **Zielgruppen**: Mitteilungen nur fuer bestimmte Rollen
- **Wiederkehrende Mitteilungen**: Woechentliche/monatliche Erinnerungen
- **Lesebestaetigung erzwingen**: Mitteilung kann nicht geschlossen werden ohne Bestaetigung
- **E-Mail-Versand**: Kritische Mitteilungen zusaetzlich per E-Mail
