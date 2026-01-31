
# Plan: Meeting-Agenda Korrekturen (Teil 4)

## Zusammenfassung der identifizierten Probleme

Nach eingehender Codeanalyse wurden folgende technische Ursachen identifiziert:

---

## 1. Kalender-Zeiten werden um eine Stunde verschoben

**Ursache (MeetingsView.tsx Zeilen 724-725):**
```typescript
start_time: `${meetingDateStr}T${newMeetingTime}:00`,
end_time: `${meetingDateStr}T${endHour}:${timeMinute}:00`,
```

Das Problem: Der Zeitstring `2026-02-01T20:00:00` wird OHNE Zeitzone gesendet. PostgreSQL interpretiert dies als UTC. Der Browser zeigt es dann in lokaler Zeit (CET = UTC+1) an, daher 21:00 statt 20:00.

**Datenbank-Beweis:**
- Meeting: `meeting_time: 20:00:00`
- Appointment: `start_time: 2026-02-01 20:00:00+00` (UTC!)

Die Datenbank speichert den Appointment korrekt als 20:00 UTC, aber das Meeting meint eigentlich 20:00 Ortszeit (CET).

**Lösung:** Die lokale Zeitzone explizit mitgeben, damit PostgreSQL weiß, dass es sich um lokale Zeit handelt:

```typescript
// Timezone offset holen
const now = new Date();
const timezoneOffset = -now.getTimezoneOffset(); // Minuten
const tzHours = Math.floor(Math.abs(timezoneOffset) / 60).toString().padStart(2, '0');
const tzMinutes = (Math.abs(timezoneOffset) % 60).toString().padStart(2, '0');
const tzSign = timezoneOffset >= 0 ? '+' : '-';
const tzString = `${tzSign}${tzHours}:${tzMinutes}`;

// Mit Zeitzone speichern
start_time: `${meetingDateStr}T${newMeetingTime}:00${tzString}`,
end_time: `${meetingDateStr}T${endHour}:${timeMinute}:00${tzString}`,
```

---

## 2. Termine mit Stern werden an den Anfang gruppiert

**Ursache (UpcomingAppointmentsSection.tsx Zeilen 311-318):**
```typescript
const renderWeekSection = (title: string, weekAppointments: Appointment[]) => {
  // ...
  // Sort starred items to top  <--- DAS IST DAS PROBLEM!
  const sortedAppointments = [...weekAppointments].sort((a, b) => {
    const aStarred = starredIds.has(a.id);
    const bStarred = starredIds.has(b.id);
    if (aStarred && !bStarred) return -1;
    if (!aStarred && bStarred) return 1;
    return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  });
```

Der Code sortiert explizit markierte Termine nach oben! Das muss entfernt werden.

**Lösung:** Die Sortierung auf rein chronologisch ändern:
```typescript
const sortedAppointments = [...weekAppointments].sort((a, b) => 
  new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
);
```

Die visuelle Hervorhebung (gelber Hintergrund `bg-amber-50`) bleibt erhalten, aber die Reihenfolge ändert sich nicht.

---

## 3. PageUp/PageDown und d/u funktionieren nicht im Fokus-Modus

**Ursache (FocusModeView.tsx Zeilen 125-135):**
```typescript
case 'PageDown':
case 'd':
  e.preventDefault();
  window.scrollBy({ top: 200, behavior: 'smooth' });
  break;
case 'PageUp':
case 'u':
  e.preventDefault();
  window.scrollBy({ top: -200, behavior: 'smooth' });
  break;
```

Das Problem: `window.scrollBy` scrollt das Hauptfenster, aber der Fokus-Modus hat einen eigenen `overflow-auto` Container (Zeile 250: `<main className="flex-1 overflow-auto">`). Das Fenster scrollt nicht, sondern der Container muss scrollen!

**Lösung:** Den Container-Ref verwenden und diesen scrollen:
```typescript
const mainContainerRef = useRef<HTMLDivElement>(null);

// In handleKeyDown:
case 'PageDown':
case 'd':
  e.preventDefault();
  mainContainerRef.current?.scrollBy({ top: 200, behavior: 'smooth' });
  break;
case 'PageUp':
case 'u':
  e.preventDefault();
  mainContainerRef.current?.scrollBy({ top: -200, behavior: 'smooth' });
  break;

// In JSX:
<main ref={mainContainerRef} className="flex-1 overflow-auto py-8">
```

---

## 4. Teilnehmer können nicht ausgewählt werden

**Ursache (Network Request zeigt 400 Fehler):**
```
GET /user_tenant_memberships?select=user_id,is_active,profiles:user_id(...)
Status: 400
Error: "Could not find a relationship between 'user_tenant_memberships' and 'user_id'"
```

Der aktuelle Query in `UserSelector.tsx` versucht einen Join über `profiles:user_id()`, aber es gibt keine Foreign-Key-Beziehung von `user_tenant_memberships.user_id` zu `profiles.user_id` (nur zu `auth.users`).

**Lösung:** Die Query in zwei Schritten aufteilen:

```typescript
const fetchUsers = async () => {
  if (!currentTenant?.id) {
    console.log('UserSelector: No tenant available yet, waiting...');
    setLoading(false);
    return;
  }
  
  setLoading(true);
  console.log('UserSelector: Fetching users for tenant:', currentTenant.id);
  try {
    // Step 1: Get all active tenant memberships
    const { data: memberships, error: membershipError } = await supabase
      .from('user_tenant_memberships')
      .select('user_id')
      .eq('tenant_id', currentTenant.id)
      .eq('is_active', true);

    if (membershipError) throw membershipError;
    if (!memberships || memberships.length === 0) {
      setUsers([]);
      return;
    }

    // Step 2: Get profiles for these user IDs
    const userIds = memberships.map(m => m.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', userIds);

    if (profilesError) throw profilesError;

    const usersData: User[] = (profiles || []).map(profile => ({
      id: profile.user_id,
      display_name: profile.display_name || 'Unbekannt',
      avatar_url: profile.avatar_url
    }));

    usersData.sort((a, b) => a.display_name.localeCompare(b.display_name));
    setUsers(usersData);
  } catch (error) {
    console.error('Error fetching users:', error);
  } finally {
    setLoading(false);
  }
};
```

---

## 5. Zuweisung von Punkten im Fokus-Modus

**Aktuelle Situation:** Der Fokus-Modus zeigt zugewiesene Benutzer an (Zeilen 344-352), aber es gibt keine Möglichkeit, Punkte zuzuweisen.

**Lösung:** Ein neues Tastenkürzel `a` (für "assign") hinzufügen, das einen kleinen Dialog öffnet:

```typescript
// Neuer State
const [showAssignDialog, setShowAssignDialog] = useState(false);

// In handleKeyDown:
case 'a':
  e.preventDefault();
  setShowAssignDialog(true);
  break;

// Neuer Dialog nach dem Ergebnis-Block:
{isFocused && (
  <div className="mt-4 pt-4 border-t">
    {/* Assignment section */}
    <div className="flex items-center gap-2 mb-4">
      <Users className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium">Zuweisung:</span>
      {item.assigned_to && item.assigned_to.length > 0 ? (
        <span className="text-sm text-muted-foreground">
          {item.assigned_to.map(getDisplayName).join(', ')}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground italic">Nicht zugewiesen</span>
      )}
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-6 text-xs"
        onClick={() => setShowAssignDialog(true)}
      >
        Ändern
      </Button>
    </div>
    
    {/* Existing result textarea */}
    ...
  </div>
)}
```

Für den Zuweisungs-Dialog wird ein `Select` mit den Profilen verwendet:
```typescript
<Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle>Punkt zuweisen</DialogTitle>
    </DialogHeader>
    <Select
      value={currentItem?.assigned_to?.[0] || ''}
      onValueChange={(value) => {
        if (currentItem?.id && currentItemGlobalIndex !== -1) {
          onUpdateItem(currentItemGlobalIndex, 'assigned_to', value ? [value] : null);
        }
        setShowAssignDialog(false);
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Teammitglied auswählen" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">Nicht zugewiesen</SelectItem>
        {profiles.map(profile => (
          <SelectItem key={profile.user_id} value={profile.user_id}>
            {profile.display_name || 'Unbekannt'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </DialogContent>
</Dialog>
```

Und in der Tastenkürzel-Legende:
```typescript
<div className="flex items-center gap-3 p-2 rounded bg-muted/50">
  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">a</kbd>
  <span className="text-sm">Punkt zuweisen</span>
</div>
```

---

## Zusammenfassung der Änderungen

| # | Datei | Änderung |
|---|-------|----------|
| 1 | `MeetingsView.tsx` | Zeitzone beim Appointment-Insert hinzufügen |
| 2 | `UpcomingAppointmentsSection.tsx` | Stern-Sortierung entfernen (nur chronologisch) |
| 3 | `FocusModeView.tsx` | Container-Ref für PageUp/PageDown Scroll |
| 4 | `UserSelector.tsx` | Query in zwei Schritte aufteilen (kein Join) |
| 5 | `FocusModeView.tsx` | Zuweisungs-Dialog und `a`-Tastenkürzel |

---

## Erwartete Ergebnisse

1. **Kalender-Zeit korrekt** - 20:00 Uhr bleibt 20:00 Uhr im Kalender
2. **Stern-Termine bleiben chronologisch** - Nur visuelle Hervorhebung, keine Umordnung
3. **PageUp/PageDown funktioniert** - Scrollt innerhalb langer Punkte im Fokus-Modus
4. **Teilnehmer auswählbar** - UserSelector lädt Tenant-Mitglieder korrekt
5. **Zuweisung im Fokus-Modus** - Mit `a`-Taste Punkte zuweisen
