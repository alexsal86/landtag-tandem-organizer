

## Änderungen an der Fallakten-Detailansicht

### Übersicht der Anforderungen

**Entfernen:**
1. Quick-Capture Komponenten (Anrufnotiz, E-Mail, Social-Hinweis) aus der mittleren Spalte
2. Separate Interaktions-Timeline-Komponente (`CaseItemInteractionsTimeline`)
3. Badges bei Personen und Institutionen in der linken Sidebar
4. Button-Leiste unter dem Titel (Notiz, Aufgabe, Termin, Dokument)
5. "Bearbeiten" Option aus dem Drei-Punkte-Menü im Header

**Hinzufügen:**
1. Status-Badge in der Fallakten-Übersichtsliste (MyWorkCasesWorkspace)
2. Interaktionsleiste in der mittleren Spalte (ähnlich wie bei Vorgängen)
3. "Löschen" als direkten Button im Header

**Anpassen:**
1. Interaktionen in die Chronologie/Zeitstrahl integrieren
2. Kategorien-System aus Vorgängen übernehmen

---

## 1. Quick-Capture & Interaktions-Timeline entfernen

**Datei:** `src/features/cases/files/components/CaseFileDetail.tsx`

- Zeilen 24-26: Imports für `CallNoteQuickCapture`, `EmailQuickCapture`, `SocialHintQuickCapture` entfernen
- Zeile 27: Import für `CaseItemInteractionsTimeline` entfernen
- Zeilen 135-139: Grid mit Quick-Capture Komponenten entfernen
- Zeilen 141-142: Separate Interaktions-Timeline entfernen

Die mittlere Spalte zeigt dann nur noch die `CaseFileUnifiedTimeline`.

---

## 2. Interaktionsleiste hinzufügen

**Datei:** `src/features/cases/files/components/CaseFileDetail.tsx`

Vor der `CaseFileUnifiedTimeline` (nach Zeile 134) eine Interaktionsleiste einfügen ähnlich wie bei Vorgängen:

```tsx
<div className="rounded-md border bg-background p-3 space-y-2">
  <p className="font-bold">Interaktion erfassen</p>
  <div className="flex flex-wrap gap-2">
    <Button size="sm" variant="outline" onClick={onAddNote}>
      <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
      Notiz
    </Button>
    <Button size="sm" variant="outline" onClick={onAddTask}>
      <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
      Aufgabe
    </Button>
    <Button size="sm" variant="outline" onClick={onAddAppointment}>
      <Calendar className="mr-1.5 h-3.5 w-3.5" />
      Termin
    </Button>
    <Button size="sm" variant="outline" onClick={onAddDocument}>
      <FileText className="mr-1.5 h-3.5 w-3.5" />
      Dokument
    </Button>
  </div>
</div>
```

Icons importieren: `MessageSquare`, `CheckSquare`, `Calendar`, `FileText` von `lucide-react`.

---

## 3. Header-Buttons entfernen

**Datei:** `src/features/cases/files/components/CaseFileDetailHeader.tsx`

- Zeilen 107-116 (props): `onAddNote`, `onAddTask`, `onAddAppointment`, `onAddDocument` Props entfernen
- Zeilen 118-134: "Bottom: Badges left, Quick actions right" Section komplett entfernen
- Nur die Processing Status Badges behalten (aber an anderer Stelle platzieren)

Das neue Layout im Header:
```tsx
{/* Top: Title + Actions */}
<div className="flex items-start justify-between gap-4">
  <div className="flex-1 min-w-0">
    <h1 className="text-xl font-bold">{caseFile.title}</h1>
    {caseFile.reference_number && (
      <p className="text-sm text-muted-foreground">
        Aktenzeichen: {caseFile.reference_number}
      </p>
    )}
    {caseFile.description && (
      <p className="text-sm text-muted-foreground mt-1">{caseFile.description}</p>
    )}
  </div>
  <div className="flex items-center gap-2 shrink-0">
    {/* Processing Status Badges */}
    {activeProcessingStatuses.map((ps: any) => {
      const PIcon = getIconComponent(ps?.icon);
      return (
        <Badge key={ps.name} style={{ backgroundColor: ps.color || undefined, color: '#fff' }}>
          {PIcon && <PIcon className="h-3 w-3 mr-1" />}
          {ps.label}
        </Badge>
      );
    })}
    <Button variant="destructive" size="sm" onClick={onDelete}>
      <Trash2 className="mr-1.5 h-4 w-4" />
      Löschen
    </Button>
  </div>
</div>
```

Das Drei-Punkte-Menü wird komplett entfernt, da "Bearbeiten" nicht mehr benötigt wird und "Löschen" jetzt ein direkter Button ist.

---

## 4. Badges in Sidebar entfernen

**Datei:** `src/features/cases/files/components/CaseFileLeftSidebar.tsx`

In der `renderContactList` Funktion (Zeilen 77-126):
- Zeilen 102-104: Badge für Rolle entfernen

```tsx
// Vorher:
<Badge variant="secondary" className="text-[10px] mt-1 h-5">
  {getRoleLabel(item.role)}
</Badge>

// Nachher: Badge komplett entfernen
```

Die Rolle kann optional als Text unter dem Namen angezeigt werden:
```tsx
{item.role && (
  <div className="text-xs text-muted-foreground truncate">
    {getRoleLabel(item.role)}
  </div>
)}
```

---

## 5. Interaktionen in Chronologie integrieren

**Datei:** `src/features/cases/files/components/CaseFileUnifiedTimeline.tsx`

Die Interaktionen sind bereits im Hook `useCaseFileDetails` verfügbar. Diese müssen in die `unifiedItems` eingebunden werden:

```tsx
// In der unifiedItems Berechnung nach Zeile 60 hinzufügen:
...interactions.map((i) => ({
  id: `interaction-${i.id}`,
  category: "interaction" as const,
  event_date: i.created_at,
  title: `${i.interaction_type}: ${i.subject}`,
  description: i.details,
  meta: { 
    type: i.interaction_type, 
    direction: i.direction,
    isResolution: i.is_resolution 
  },
})),
```

Im `CATEGORY_CONFIG` einen neuen Eintrag für "interaction" hinzufügen:
```tsx
interaction: { icon: MessageSquare, label: "Interaktion", color: "bg-indigo-500" },
```

Die Komponente muss die `interactions` Prop vom Parent erhalten:
```tsx
interface CaseFileUnifiedTimelineProps {
  // ... existing props
  interactions: CaseFileInteraction[];
}
```

---

## 6. Status in Fallakten-Übersicht anzeigen

**Datei:** `src/components/my-work/MyWorkCasesWorkspace.tsx`

In der Fallakten-Liste (Zeilen 1492-1532 und 1550-1590) Status-Badge hinzufügen:

```tsx
<div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
  <div className="flex items-center gap-2">
    {cf.reference_number && <span>{cf.reference_number}</span>}
    {caseFileStatusBadge(cf.status)}
  </div>
  {linkedCount > 0 && (
    <span>
      <FileText className="inline h-3 w-3 mr-0.5" />
      {linkedCount} {linkedCount === 1 ? "Vorgang" : "Vorgänge"}
    </span>
  )}
</div>
```

Die `caseFileStatusBadge` Funktion ist bereits definiert (Zeile 218).

---

## 7. Kategorien-System übernehmen

**Überlegung:** Die Vorgänge verwenden ein einfaches String-Array für Kategorien:
```tsx
const categoryOptions = ["Allgemein", "Bürgeranliegen", "Anfrage", "Beschwerde", "Termin", "Sonstiges"];
```

Fallakten verwenden bereits ein konfigurierbares System mit `case_file_types` aus der Datenbank. Diese sind flexibler und haben Icons/Farben.

**Empfehlung:** Das bestehende `case_file_types` System beibehalten, da es mächtiger ist. Falls gewünscht, können die Typen in der Datenbank an die Vorgänge-Kategorien angepasst werden.

Alternative: Ein zusätzliches `category` Feld in `case_files` hinzufügen (getrennt von `case_type`), das die gleichen Werte wie bei Vorgängen verwendet.

---

## Technische Details

### Betroffene Dateien:
1. `src/features/cases/files/components/CaseFileDetail.tsx` - Hauptkomponente
2. `src/features/cases/files/components/CaseFileDetailHeader.tsx` - Header
3. `src/features/cases/files/components/CaseFileLeftSidebar.tsx` - Sidebar
4. `src/features/cases/files/components/CaseFileUnifiedTimeline.tsx` - Timeline
5. `src/components/my-work/MyWorkCasesWorkspace.tsx` - Übersicht

### Typen/Interfaces:
- `CaseFileInteraction` aus `src/features/cases/files/hooks` muss exportiert werden
- `CaseFileDetailHeaderProps` Interface anpassen
- `CaseFileUnifiedTimelineProps` Interface erweitern

### Icons zu importieren:
- `MessageSquare`, `CheckSquare`, `Calendar`, `FileText`, `Trash2` (lucide-react)

