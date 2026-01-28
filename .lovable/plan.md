
# Plan: Fehlerbehebungen für Notizen und Verbesserungen der Planungs-Karten

## Übersicht der Änderungen

| # | Problem | Ursache | Lösung |
|---|---------|---------|--------|
| 1 | Wiederherstellung aus Papierkorb zeigt Fehler | Fehlender `user_id` Filter bei RLS | Filter hinzufügen |
| 2 | Notiz-Bearbeitung zeigt HTML | Textarea statt Rich-Text-Editor | SimpleRichTextEditor verwenden |
| 3 | Archiv-Button bei Planungen fehlt | Funktion existiert, aber kein UI-Element | Archiv-Button/Menü auf Karten |
| 4 | Anpinnen erzeugt Fehler | Fehlender `user_id` Filter bei RLS | Filter hinzufügen |
| 5 | Mitarbeiter ohne Farben auf Karten | Avatare statt farbige Badges | UserBadge-Komponente + neues Layout |

---

## 1. Wiederherstellung aus Papierkorb: RLS-Fehler beheben

**Datei:** `src/components/shared/NotesArchive.tsx`

**Problem:** Die Funktionen `handleRestore` (Zeile 143-158) und `handleRestoreFromArchive` (Zeile 160-180) haben keinen `user_id` Filter, was bei RLS-geschützten Tabellen zu einer Fehlermeldung führt.

**Lösung:**

```typescript
// handleRestore - Zeile 143-158
const handleRestore = async (noteId: string) => {
  if (!user?.id) return;  // Prüfung hinzufügen
  
  try {
    const { error } = await supabase
      .from("quick_notes")
      .update({ deleted_at: null, permanent_delete_at: null })
      .eq("id", noteId)
      .eq("user_id", user.id);  // Filter hinzufügen

    if (error) throw error;
    toast.success("Notiz wiederhergestellt");
    // ...
  }
};

// handleRestoreFromArchive - Zeile 160-180
const handleRestoreFromArchive = async (noteId: string) => {
  if (!user?.id) return;  // Prüfung hinzufügen
  
  try {
    const { error } = await supabase
      .from("quick_notes")
      .update({ is_archived: false, archived_at: null })
      .eq("id", noteId)
      .eq("user_id", user.id);  // Filter hinzufügen

    if (error) throw error;
    // ...
  }
};
```

---

## 2. Notiz-Bearbeitung: Rich-Text-Editor statt Textarea

**Datei:** `src/components/shared/QuickNotesList.tsx`

**Problem:** Der Edit-Dialog (Zeile 1637-1670) verwendet `Textarea` für den Inhalt, was HTML-Tags roh anzeigt.

**Aktuelle Implementierung:**
```typescript
<Textarea
  placeholder="Inhalt"
  value={editContent}
  onChange={(e) => setEditContent(e.target.value)}
  className="min-h-[150px]"
/>
```

**Lösung:**
```typescript
// Import am Anfang der Datei
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";

// Im Edit-Dialog (ca. Zeile 1652-1656)
<SimpleRichTextEditor
  initialContent={editContent}
  onChange={setEditContent}
  placeholder="Inhalt"
  className="min-h-[150px]"
/>
```

**Zusätzlich:** Den `editContent` State beim Öffnen des Dialogs mit dem HTML-Inhalt initialisieren (funktioniert bereits korrekt in `openEditDialog`).

---

## 3. Archiv-Button bei einzelnen Planungen

**Datei:** `src/components/EventPlanningView.tsx`

**Problem:** Die Funktion `archivePlanning` existiert (Zeile 465-498), aber es gibt keinen Button auf den Planungs-Karten, um sie zu verwenden.

**Lösung:** Ein Drei-Punkte-Menü auf jeder Planungs-Karte hinzufügen (Zeile 2751-2834):

```typescript
// Im CardHeader der Planungs-Karte (nach Zeile 2758)
<CardHeader className="pb-2">
  <CardTitle className="flex items-center justify-between">
    <span className="truncate">{planning.title}</span>
    <div className="flex items-center gap-2">
      {planning.is_private && (
        <Badge variant="outline">Privat</Badge>
      )}
      {/* Archiv-Menü - nur für Ersteller */}
      {planning.user_id === user?.id && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              archivePlanning(planning.id);
            }}>
              <Archive className="h-4 w-4 mr-2" />
              Archivieren
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  </CardTitle>
</CardHeader>
```

**Import hinzufügen:**
```typescript
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
```

---

## 4. Anpinnen bei Notizen: RLS-Fehler beheben

**Datei:** `src/components/shared/QuickNotesList.tsx`

**Problem:** Die Funktion `handleTogglePin` (Zeile 360-373) hat keinen `user_id` Filter:

```typescript
// Aktuell
const handleTogglePin = async (note: QuickNote) => {
  try {
    const { error } = await supabase
      .from("quick_notes")
      .update({ is_pinned: !note.is_pinned })
      .eq("id", note.id);  // Fehlt: .eq("user_id", user.id)
    // ...
  }
};
```

**Lösung:**
```typescript
const handleTogglePin = async (note: QuickNote) => {
  if (!user?.id) {
    toast.error("Nicht angemeldet");
    return;
  }
  
  try {
    const { data, error } = await supabase
      .from("quick_notes")
      .update({ is_pinned: !note.is_pinned })
      .eq("id", note.id)
      .eq("user_id", user.id)  // RLS-konform
      .select();

    if (error) throw error;
    
    if (!data || data.length === 0) {
      toast.error("Keine Berechtigung zum Ändern dieser Notiz");
      return;
    }
    
    toast.success(note.is_pinned ? "Notiz losgelöst" : "Notiz angepinnt");
    loadNotes();
  } catch (error) {
    console.error("Error toggling pin:", error);
    toast.error("Fehler beim Ändern");
  }
};
```

---

## 5. Planungs-Karten: Mitarbeiter mit Farben und neues Layout

**Datei:** `src/components/EventPlanningView.tsx`

**Konzept:** Die Karten-Struktur wird überarbeitet:
- **Unten links:** Datum und Uhrzeit
- **Unten mittig:** Mitarbeiter mit ihren Badge-Farben
- **Unten rechts:** Verantwortliche Person mit Badge-Farbe

**Imports hinzufügen:**
```typescript
import { UserBadge } from "@/components/ui/user-badge";
import { getHashedColor } from "@/utils/userColors";
```

**Profile-Daten erweitern:** `badge_color` beim Laden der Profile mit abrufen:

```typescript
// In fetchAllProfiles oder ähnlich
const { data: profiles } = await supabase
  .from("profiles")
  .select("user_id, display_name, avatar_url, badge_color")
  .in("user_id", userIds);
```

**Neues Card-Layout (Zeile 2751-2834):**

```typescript
<Card
  key={planning.id}
  className="cursor-pointer hover:shadow-md transition-shadow relative flex flex-col"
  onClick={() => setSelectedPlanning(planning)}
>
  <NewItemIndicator isVisible={isItemNew(planning.id, planning.created_at)} />
  
  <CardHeader className="pb-2">
    <CardTitle className="flex items-center justify-between">
      <span className="truncate">{planning.title}</span>
      <div className="flex items-center gap-2">
        {planning.is_private && (
          <Badge variant="outline">Privat</Badge>
        )}
        {/* Archiv-Menü */}
        {planning.user_id === user?.id && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                archivePlanning(planning.id);
              }}>
                <Archive className="h-4 w-4 mr-2" />
                Archivieren
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </CardTitle>
  </CardHeader>
  
  <CardContent className="flex-1 space-y-3">
    {/* Beschreibung */}
    {planning.description && (
      <p className="text-sm text-muted-foreground line-clamp-2">
        {planning.description}
      </p>
    )}
    
    {/* Ort */}
    {planning.location && (
      <div className="flex items-center text-sm text-muted-foreground">
        <MapPin className="mr-2 h-3 w-3" />
        {planning.location}
      </div>
    )}
    
    {/* Status Badge */}
    <Badge variant={planning.confirmed_date ? "default" : "secondary"}>
      {planning.confirmed_date ? "Bestätigt" : "In Planung"}
    </Badge>
  </CardContent>
  
  {/* Footer mit neuem Layout */}
  <div className="px-6 pb-4 pt-2 border-t mt-auto">
    <div className="flex items-end justify-between gap-2">
      {/* Links: Datum & Uhrzeit */}
      <div className="flex flex-col text-xs text-muted-foreground">
        {planning.confirmed_date ? (
          <>
            <span className="flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              {format(new Date(planning.confirmed_date), "dd.MM.yyyy", { locale: de })}
            </span>
            {/* Falls Uhrzeit vorhanden */}
            {planning.confirmed_date.includes('T') && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(planning.confirmed_date), "HH:mm", { locale: de })} Uhr
              </span>
            )}
          </>
        ) : (
          <span className="italic">Termin offen</span>
        )}
      </div>
      
      {/* Mitte: Mitarbeiter mit Farben */}
      {planningCollaborators.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-center">
          {planningCollaborators.slice(0, 3).map((collab) => {
            const profile = allProfiles.find(p => p.user_id === collab.user_id);
            const color = profile?.badge_color || getHashedColor(collab.user_id);
            return (
              <span
                key={collab.id}
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full text-white",
                  color
                )}
                title={profile?.display_name || "Unbekannt"}
              >
                {(profile?.display_name || "?")[0]}
              </span>
            );
          })}
          {planningCollaborators.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{planningCollaborators.length - 3}
            </span>
          )}
        </div>
      )}
      
      {/* Rechts: Verantwortliche Person */}
      <div className="flex flex-col items-end">
        <span className="text-[10px] text-muted-foreground mb-0.5">Verantwortlich</span>
        <UserBadge
          userId={planning.user_id}
          displayName={creatorProfile?.display_name || null}
          badgeColor={creatorProfile?.badge_color}
          size="sm"
        />
      </div>
    </div>
  </div>
</Card>
```

**Visuelle Darstellung des neuen Layouts:**

```text
┌─────────────────────────────────────────────────────────────┐
│ Veranstaltungstitel                            [Privat] [⋮] │
├─────────────────────────────────────────────────────────────┤
│ Beschreibung der Veranstaltung...                           │
│ 📍 Stuttgart, Rathaus                                       │
│ [In Planung]                                                │
├─────────────────────────────────────────────────────────────┤
│ 📅 28.01.2026    [C] [F] [M]          Verantwortlich        │
│ 🕐 14:00 Uhr      +2                  [Alexander]           │
│                                           ↑                  │
│ ↑ Datum/Uhrzeit   ↑ Mitarbeiter-Badges    UserBadge         │
└─────────────────────────────────────────────────────────────┘

Legende:
[C] = Carla (blaue Farbe)
[F] = Franziska (grüne Farbe)  
[M] = Michael (orange Farbe)
[Alexander] = UserBadge mit Farbe des Erstellers
```

---

## Zusammenfassung der Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/shared/NotesArchive.tsx` | `user_id` Filter in `handleRestore` und `handleRestoreFromArchive` |
| `src/components/shared/QuickNotesList.tsx` | SimpleRichTextEditor im Edit-Dialog + `user_id` in `handleTogglePin` |
| `src/components/EventPlanningView.tsx` | Archiv-Dropdown auf Karten + neues Layout mit UserBadge-Farben |

---

## Technische Details

### RLS-konforme Updates
Alle Update-Operationen auf `quick_notes` benötigen `.eq("user_id", user.id)` um mit Row Level Security zu funktionieren ohne Fehlermeldungen.

### SimpleRichTextEditor Props
```typescript
interface SimpleRichTextEditorProps {
  initialContent?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}
```

### UserBadge-Komponente
Verwendet `badge_color` aus dem Profil oder generiert eine konsistente Farbe basierend auf der User-ID.

---

## Geschätzter Aufwand

| Änderung | Zeit |
|----------|------|
| Wiederherstellung RLS-Fix | 5 Min |
| Edit-Dialog Rich-Text | 10 Min |
| Archiv-Button auf Karten | 15 Min |
| Anpinnen RLS-Fix | 5 Min |
| Neues Karten-Layout mit Farben | 25 Min |
| **Gesamt** | **~60 Min** |
