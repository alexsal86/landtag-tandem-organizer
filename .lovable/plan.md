
# Plan: Vier Verbesserungen umsetzen

## Übersicht

| # | Problem | Lösung | Aufwand |
|---|---------|--------|---------|
| 1 | HTML-Code in Aufgaben aus Notizen | HTML-Tags bei Titel-Erstellung entfernen | 15 Min |
| 2 | Dynamische Agenda-Komponenten fehlen | System-Items in Jour Fixe Preview anzeigen | 20 Min |
| 3 | Verantwortlicher in Planungen fehlt | Creator-Avatar/Name anzeigen | 25 Min |
| 4 | Urlaub zurückgeben | Stornierungsfunktion mit Admin-Bestätigung | 45 Min |

---

## 1. HTML-Formatierung in Aufgaben aus Notizen korrigieren

**Problem:** Wenn eine Aufgabe aus einer Notiz erstellt wird, enthält der Titel HTML-Tags (z.B. `<p>`, `<strong>`), weil der Inhalt nicht bereinigt wird.

**Dateien:**
- `src/components/shared/QuickNotesList.tsx`

**Änderungen:**

```typescript
// Zeile 517 - ALT:
title: note.title || note.content.substring(0, 50) + (note.content.length > 50 ? '...' : ''),

// Zeile 517 - NEU:
const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').trim();
const plainContent = stripHtml(note.content);
title: note.title || plainContent.substring(0, 50) + (plainContent.length > 50 ? '...' : ''),
```

Dies stellt sicher, dass HTML-Tags aus dem Titel entfernt werden, während die Beschreibung weiterhin als HTML gespeichert wird (für RichTextDisplay-Rendering).

---

## 2. Dynamische Agenda-Komponenten in Meine Arbeit anzeigen

**Problem:** In der Jour Fixe Vorschau in "Meine Arbeit" werden "Meine Notizen" und "Mein Kalender" (System-Items) nicht angezeigt, da diese explizit gefiltert werden.

**Datei:**
- `src/components/my-work/MyWorkJourFixeTab.tsx`

**Änderungen:**

1. **System-Items laden** (Zeile 110-115):
```typescript
// ALT:
.is('system_type', null) // Only normal agenda items, not system items

// NEU: Alle Items laden, inklusive System-Items
// Filter entfernen - alle agenda items laden
```

2. **System-Items mit Icons anzeigen** (Zeile 229-236):
```typescript
// System-Item Rendering mit speziellen Icons hinzufügen
const getSystemItemIcon = (systemType: string | null) => {
  if (systemType === 'quick_notes') return <StickyNote className="h-3 w-3 text-amber-500" />;
  if (systemType === 'upcoming_appointments') return <Calendar className="h-3 w-3 text-blue-500" />;
  return null;
};
```

3. **Sub-Items (Unterpunkte) anzeigen:**
```typescript
// Für jeden Main-Item auch Sub-Items rendern
const subItems = meetingAgenda.filter(item => item.parent_id === mainItem.id);
```

4. **Interface erweitern:**
```typescript
interface AgendaItem {
  id: string;
  title: string;
  parent_id: string | null;
  order_index: number;
  system_type?: string | null; // NEU
}
```

---

## 3. Verantwortlichen in Planungen anzeigen

**Problem:** Bei Veranstaltungsplanung und Terminplanung ist nicht erkennbar, wer der Ersteller/Verantwortliche ist.

**Dateien:**
- `src/components/EventPlanningView.tsx`
- `src/components/poll/PollListView.tsx`

### 3a. EventPlanningView - Karten-Ansicht (Zeile 2520-2594)

**Änderungen:**

1. **Creator-Profil in Query laden** (fetchPlannings):
```typescript
// Zusätzlich profiles für creator laden
const { data, error } = await supabase
  .from("event_plannings")
  .select(`
    *,
    creator:profiles!event_plannings_user_id_fkey(display_name, avatar_url)
  `)
```

2. **Creator in Card anzeigen** (vor Collaborators):
```typescript
// In CardContent vor planningCollaborators:
<div className="flex items-center gap-2 text-sm text-muted-foreground">
  <User className="h-3 w-3" />
  <span className="font-medium">Verantwortlich:</span>
  <Avatar className="h-5 w-5">
    <AvatarImage src={planning.creator?.avatar_url} />
    <AvatarFallback className="text-xs">{planning.creator?.display_name?.[0]}</AvatarFallback>
  </Avatar>
  <span>{planning.creator?.display_name}</span>
</div>
```

### 3b. EventPlanningView - Tabellen-Ansicht (Zeile 566-609)

**Änderungen:**

```typescript
// Neue Spalte in TableHeader:
<TableHead>Verantwortlich</TableHead>

// Neue Zelle in TableRow:
<TableCell>
  <div className="flex items-center gap-1.5">
    <Avatar className="h-5 w-5">
      <AvatarImage src={planning.creator?.avatar_url} />
      <AvatarFallback className="text-xs">{planning.creator?.display_name?.[0]}</AvatarFallback>
    </Avatar>
    <span className="text-sm">{planning.creator?.display_name}</span>
  </div>
</TableCell>
```

### 3c. PollListView - Terminabstimmungen

**Hinweis:** Da PollListView nur eigene Umfragen zeigt (`eq('user_id', user.id)`), ist der Verantwortliche immer der aktuelle Benutzer. Falls gewünscht, kann ein "Erstellt von mir"-Badge hinzugefügt werden.

---

## 4. Urlaub zurückgeben / stornieren

**Problem:** Mitarbeiter können genehmigte Urlaubsanträge nicht zurückgeben.

### Workflow:

```text
Mitarbeiter          Admin (Abgeordneter)
     │                       │
     ├── Klickt "Stornieren" │
     │                       │
     ├── Status wird ────────┤
     │   "cancel_requested"  │
     │                       │
     │   ◄──────── Sieht Antrag in Pending-Liste
     │                       │
     │   ◄──────── Bestätigt/Ablehnt Stornierung
     │                       │
     └── Status "cancelled"  │
         Urlaubstage zurück  │
```

### Dateien:

1. **`src/components/TimeTrackingView.tsx`** - Stornieren-Button
2. **`src/components/EmployeesView.tsx`** - Stornierung genehmigen
3. **Datenbank-Migration** - Neuer Status-Typ (optional, kann als String verwendet werden)

### 4a. TimeTrackingView - Stornieren-Button (Zeile 686-697)

**Änderungen:**

```typescript
// Neue Spalte "Aktion" in TableHeader:
<TableHead>Aktion</TableHead>

// Neue Zelle mit Stornieren-Button:
<TableCell>
  {(v.status === 'pending' || v.status === 'approved') && 
   parseISO(v.start_date) > new Date() && (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleCancelVacationRequest(v.id)}
      disabled={v.status === 'cancel_requested'}
    >
      {v.status === 'cancel_requested' ? (
        <Clock className="h-4 w-4 text-amber-500" />
      ) : (
        <Undo2 className="h-4 w-4" />
      )}
      {v.status === 'cancel_requested' ? 'Wird geprüft' : 'Stornieren'}
    </Button>
  )}
</TableCell>

// Neue Funktion:
const handleCancelVacationRequest = async (leaveId: string) => {
  if (!window.confirm('Möchten Sie diesen Urlaubsantrag wirklich stornieren?')) return;
  
  try {
    // Für ausstehende Anträge: Direkt auf cancelled setzen
    // Für genehmigte Anträge: Auf cancel_requested setzen (Admin muss bestätigen)
    const leave = vacationLeaves.find(v => v.id === leaveId);
    const newStatus = leave?.status === 'pending' ? 'cancelled' : 'cancel_requested';
    
    await supabase
      .from("leave_requests")
      .update({ status: newStatus })
      .eq("id", leaveId);
    
    if (newStatus === 'cancelled') {
      toast.success("Urlaubsantrag storniert");
    } else {
      toast.success("Stornierungsanfrage gesendet");
    }
    loadData();
  } catch (error) {
    toast.error("Fehler beim Stornieren");
  }
};
```

### 4b. EmployeesView - Stornierung genehmigen (Zeile 707-758)

**Änderungen:**

1. **Stornierungsanfragen in Pending-Liste laden:**
```typescript
// Query erweitern:
.in("status", ["pending", "cancel_requested"])
```

2. **UI für Stornierungsanfragen:**
```typescript
{leave.status === 'cancel_requested' && (
  <div className="flex gap-2">
    <Button
      size="sm"
      variant="outline"
      onClick={() => handleCancelApproval(leave.id, true)}
    >
      <Check className="h-4 w-4 mr-1" />
      Stornierung genehmigen
    </Button>
    <Button
      size="sm"
      variant="ghost"
      onClick={() => handleCancelApproval(leave.id, false)}
    >
      <X className="h-4 w-4 mr-1" />
      Ablehnen
    </Button>
  </div>
)}
```

3. **Neue Handler-Funktion:**
```typescript
const handleCancelApproval = async (leaveId: string, approve: boolean) => {
  try {
    const newStatus = approve ? 'cancelled' : 'approved'; // Zurück auf approved bei Ablehnung
    
    await supabase
      .from("leave_requests")
      .update({ status: newStatus })
      .eq("id", leaveId);
    
    // Wenn genehmigt: Kalendereintrag löschen
    if (approve) {
      // Kalendereintrag entfernen
      await supabase
        .from("appointments")
        .delete()
        .eq("leave_request_id", leaveId); // Falls verknüpft
    }
    
    toast({ title: approve ? "Stornierung genehmigt" : "Stornierung abgelehnt" });
    loadData();
  } catch (error) {
    toast({ title: "Fehler", variant: "destructive" });
  }
};
```

### 4c. Status-Badge erweitern

```typescript
// In getStatusBadge Funktion:
case 'cancel_requested':
  return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
    Stornierung angefragt
  </Badge>;
case 'cancelled':
  return <Badge variant="secondary" className="text-muted-foreground">
    Storniert
  </Badge>;
```

---

## Zusammenfassung der Dateien

| Datei | Änderungen |
|-------|------------|
| `src/components/shared/QuickNotesList.tsx` | HTML-Stripping für Titel |
| `src/components/my-work/MyWorkJourFixeTab.tsx` | System-Items + Sub-Items anzeigen |
| `src/components/EventPlanningView.tsx` | Creator in Cards + Tabelle |
| `src/components/poll/PollListView.tsx` | (Optional) Creator-Badge |
| `src/components/TimeTrackingView.tsx` | Stornieren-Button + Handler |
| `src/components/EmployeesView.tsx` | Stornierung genehmigen |

**Geschätzter Gesamtaufwand:** ~2 Stunden
