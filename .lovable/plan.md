
# Plan: 5 Verbesserungen fuer Meine Notizen und Entscheidungen

## Uebersicht der Probleme

| # | Problem | Ursache | Loesung |
|---|---------|---------|---------|
| 1 | Farbmodus "Ganze Card einfaerben" kann nicht gesetzt werden und zeigt nicht den aktuellen Zustand | Checkbox-Event wird moeglicherweise abgefangen, UI zeigt bereits `checked={note.color_full_card ?? false}` | Event-Propagation pruefen, sicherstellen dass handleSetColorMode korrekt aufgerufen wird |
| 2 | Entscheidungserstellung aus Notizen fehlt Features (oeffentlich, Themen, Dateien) | `NoteDecisionCreator` ist eine vereinfachte Version von `StandaloneDecisionCreator` | `NoteDecisionCreator` erweitern um alle Features |
| 3 | Beschreibungstexte von Entscheidungen sind unbegrenzt lang | Keine Laengenbegrenzung in der UI | Beschreibung auf 250 Zeichen kuerzen mit "mehr anzeigen" Button |
| 4 | Globaler Quick Note Dialog speichert nicht | RLS-Policy oder fehlendes tenant_id Problem | Debugging und Korrektur der Insert-Logik |
| 5 | Aufgabe aus abgeschlossener Entscheidung erstellen | Feature existiert noch nicht | Button "Aufgabe erstellen" anzeigen wenn alle abgestimmt haben |

---

## 1. Farbmodus "Ganze Card einfaerben" - Bugfix

### Analyse
Der aktuelle Code sieht korrekt aus:
```typescript
<Checkbox 
  checked={note.color_full_card ?? false}
  onCheckedChange={(checked) => handleSetColorMode(note.id, !!checked)}
/>
```

### Moegliche Ursachen
1. Event-Propagation wird von DropdownMenuSubContent abgefangen
2. Die Checkbox sitzt in einem `<label>` das Click-Events doppelt triggert
3. `loadNotes()` nach dem Update entfernt die Aenderung aufgrund von Timing

### Loesung
**Datei:** `src/components/shared/QuickNotesList.tsx` (Zeilen 1708-1716)

```typescript
<div className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
  <label className="flex items-center gap-2 text-xs cursor-pointer">
    <Checkbox 
      checked={note.color_full_card === true}
      onCheckedChange={(checked) => {
        // Explicitly stop propagation and update
        handleSetColorMode(note.id, checked === true);
      }}
    />
    Ganze Card einfaerben
  </label>
</div>
```

Ausserdem sicherstellen, dass `handleSetColorMode` einen Optimistic-UI-Ansatz verwendet:
```typescript
const handleSetColorMode = async (noteId: string, fullCard: boolean) => {
  if (!user?.id) {
    toast.error("Nicht angemeldet");
    return;
  }

  // Optimistic update
  setNotes(prev => prev.map(n => 
    n.id === noteId ? { ...n, color_full_card: fullCard } : n
  ));

  try {
    const { error } = await supabase
      .from("quick_notes")
      .update({ color_full_card: fullCard })
      .eq("id", noteId)
      .eq("user_id", user.id);

    if (error) {
      // Rollback on error
      setNotes(prev => prev.map(n => 
        n.id === noteId ? { ...n, color_full_card: !fullCard } : n
      ));
      throw error;
    }
    
    toast.success(fullCard ? "Ganze Card eingefaerbt" : "Nur Kante eingefaerbt");
  } catch (error) {
    console.error("Error setting color mode:", error);
    toast.error("Fehler beim Setzen des Farbmodus");
  }
};
```

---

## 2. NoteDecisionCreator mit allen Features erweitern

### Aktueller Unterschied

**StandaloneDecisionCreator hat:**
- Oeffentlich-Checkbox (visibleToAll)
- TopicSelector fuer Themen
- DecisionFileUpload fuer Dateianhaenge

**NoteDecisionCreator fehlt:**
- Oeffentlich-Checkbox (setzt immer `visible_to_all: true`)
- TopicSelector
- DecisionFileUpload

### Loesung
**Datei:** `src/components/shared/NoteDecisionCreator.tsx`

1. Imports hinzufuegen:
```typescript
import { DecisionFileUpload } from "@/components/task-decisions/DecisionFileUpload";
import { TopicSelector } from "@/components/topics/TopicSelector";
import { saveDecisionTopics } from "@/hooks/useDecisionTopics";
import { Checkbox } from "@/components/ui/checkbox";
import { Globe, Paperclip } from "lucide-react";
```

2. State hinzufuegen:
```typescript
const [visibleToAll, setVisibleToAll] = useState(true);
const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
```

3. UI-Elemente hinzufuegen (nach Teilnehmer-Auswahl):
```typescript
{/* Oeffentlich Checkbox */}
<div className="space-y-2">
  <div className="flex items-center space-x-2">
    <Checkbox
      id="visible-to-all"
      checked={visibleToAll}
      onCheckedChange={(checked) => setVisibleToAll(checked === true)}
    />
    <Label htmlFor="visible-to-all" className="flex items-center gap-1 text-sm cursor-pointer">
      <Globe className="h-3.5 w-3.5" />
      Oeffentlich (fuer alle sichtbar)
    </Label>
  </div>
</div>

{/* Themen */}
<div className="space-y-2">
  <Label>Themen (optional)</Label>
  <TopicSelector
    selectedTopicIds={selectedTopicIds}
    onTopicsChange={setSelectedTopicIds}
    compact
    placeholder="Themen hinzufuegen..."
  />
</div>

{/* Dateien */}
<div className="space-y-2">
  <Label>Dateien anhaengen (optional)</Label>
  <DecisionFileUpload
    mode="creation"
    onFilesSelected={(files) => setSelectedFiles(prev => [...prev, ...files])}
    canUpload={true}
  />
</div>
```

4. handleSubmit anpassen:
```typescript
// Bei Insert:
visible_to_all: visibleToAll,

// Nach erfolgreicher Erstellung:
// Upload files
if (selectedFiles.length > 0) {
  for (const file of selectedFiles) {
    const fileName = `${user.id}/decisions/${decision.id}/${Date.now()}-${file.name}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('decision-attachments')
      .upload(fileName, file);
    
    if (!uploadError) {
      await supabase
        .from('task_decision_attachments')
        .insert({
          decision_id: decision.id,
          file_path: uploadData.path,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: user.id
        });
    }
  }
}

// Save topics
if (selectedTopicIds.length > 0) {
  await saveDecisionTopics(decision.id, selectedTopicIds);
}
```

---

## 3. Beschreibungstexte von Entscheidungen kuerzen

### Loesung
**Datei:** `src/components/task-decisions/DecisionOverview.tsx` (renderDecisionCard, Zeilen 779-791)

Neue Komponente fuer gekuerzte Beschreibung:

```typescript
// Am Anfang der Datei oder als separate Komponente:
const TruncatedDescription = ({ content, maxLength = 250 }: { content: string; maxLength?: number }) => {
  const [expanded, setExpanded] = useState(false);
  
  // Strip HTML tags for length calculation
  const plainText = content.replace(/<[^>]*>/g, '');
  const isTruncated = plainText.length > maxLength;
  
  if (!isTruncated || expanded) {
    return (
      <div>
        <RichTextDisplay content={content} className="text-sm" />
        {isTruncated && (
          <Button 
            variant="link" 
            size="sm" 
            onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
            className="text-xs p-0 h-auto"
          >
            weniger
          </Button>
        )}
      </div>
    );
  }
  
  // Truncate at word boundary
  const truncatedPlain = plainText.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
  
  return (
    <div>
      <p className="text-sm text-muted-foreground">{truncatedPlain}</p>
      <Button 
        variant="link" 
        size="sm" 
        onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
        className="text-xs p-0 h-auto"
      >
        mehr anzeigen
      </Button>
    </div>
  );
};
```

Verwendung in renderDecisionCard (Zeile 780-782):
```typescript
{decision.description && (
  <TruncatedDescription content={decision.description} maxLength={250} />
)}
```

---

## 4. Globaler Quick Note Dialog - Fehler beheben

### Analyse
Der Code in `GlobalQuickNoteDialog.tsx` sieht korrekt aus. Er:
- Prueft auf `user?.id`
- Prueft auf `currentTenant?.id`
- Setzt alle erforderlichen Felder

### Moegliche Ursache
Das Problem koennte sein, dass `currentTenant` initial `undefined` ist, wenn der Dialog sehr schnell nach dem Laden geoeffnet wird.

### Loesung
**Datei:** `src/components/GlobalQuickNoteDialog.tsx`

1. Besseres Debugging und Fehlerbehandlung:
```typescript
const handleSave = async () => {
  if (!content.trim() && !title.trim()) {
    toast.error("Bitte Inhalt eingeben");
    return;
  }
  
  if (!user?.id) {
    toast.error("Nicht angemeldet");
    return;
  }

  // Wait for tenant if not loaded yet
  if (!currentTenant?.id) {
    toast.error("Mandant wird geladen, bitte erneut versuchen");
    return;
  }

  setSaving(true);
  
  try {
    console.log('Creating quick note:', { 
      user_id: user.id, 
      tenant_id: currentTenant.id, 
      title: title.trim() 
    });
    
    const insertData = {
      user_id: user.id,
      tenant_id: currentTenant.id,
      title: title.trim() || null,
      content: content.trim() || title.trim(),
      is_pinned: false,
      priority_level: 0,
      is_archived: false
    };
    
    const { data, error } = await supabase
      .from('quick_notes')
      .insert(insertData)
      .select();

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }
    
    console.log('Note created:', data);
    toast.success("Notiz erstellt");
    onOpenChange(false);
  } catch (error: any) {
    console.error("Error creating quick note:", error);
    toast.error(`Fehler beim Erstellen: ${error.message || 'Unbekannter Fehler'}`);
  } finally {
    setSaving(false);
  }
};
```

2. Button deaktivieren wenn Tenant nicht geladen:
```typescript
<Button onClick={handleSave} disabled={saving || !currentTenant?.id}>
  {saving ? "Speichern..." : !currentTenant?.id ? "Laden..." : "Speichern"}
</Button>
```

---

## 5. Aufgabe aus abgeschlossener Entscheidung erstellen

### Logik
Eine Entscheidung ist "abgeschlossen" wenn:
- `summary.pending === 0` (alle haben abgestimmt)
- Keine offenen Rueckfragen (`summary.questionCount === 0` ODER alle beantwortet)

### Loesung
**Datei:** `src/components/task-decisions/DecisionOverview.tsx`

1. State fuer Task-Erstellung:
```typescript
const [creatingTaskFromDecision, setCreatingTaskFromDecision] = useState<string | null>(null);
```

2. Funktion zum Erstellen der Aufgabe:
```typescript
const createTaskFromDecision = async (decision: DecisionRequest) => {
  if (!user?.id) return;
  
  const summary = getResponseSummary(decision.participants);
  
  // Ergebnis bestimmen
  let resultText = 'Ergebnis: ';
  if (summary.yesCount > summary.noCount) {
    resultText += 'Angenommen';
  } else if (summary.noCount > summary.yesCount) {
    resultText += 'Abgelehnt';
  } else {
    resultText += 'Unentschieden';
  }
  
  // Aufgabenbeschreibung zusammenstellen
  const taskDescription = `
    <h3>Aus Entscheidung: ${decision.title}</h3>
    <p><strong>${resultText}</strong> (Ja: ${summary.yesCount}, Nein: ${summary.noCount})</p>
    ${decision.description ? `<p>${decision.description}</p>` : ''}
  `;
  
  try {
    // Get tenant
    const { data: tenantData } = await supabase
      .from('user_tenant_memberships')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
    
    if (!tenantData) throw new Error('Kein Mandant gefunden');
    
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        title: `[Entscheidung] ${decision.title}`,
        description: taskDescription,
        created_by: user.id,
        assigned_to: user.id, // Dem Ersteller zuweisen
        tenant_id: tenantData.tenant_id,
        status: 'to-do',
        decision_id: decision.id // Verknuepfung zur Entscheidung
      })
      .select()
      .single();
    
    if (error) throw error;
    
    toast({
      title: "Aufgabe erstellt",
      description: "Die Aufgabe wurde aus der Entscheidung erstellt.",
    });
    
    setCreatingTaskFromDecision(null);
    loadDecisionRequests(user.id);
  } catch (error) {
    console.error('Error creating task from decision:', error);
    toast({
      title: "Fehler",
      description: "Aufgabe konnte nicht erstellt werden.",
      variant: "destructive"
    });
  }
};
```

3. UI: Button im renderDecisionCard hinzufuegen (nach den Badges, wenn Ersteller):
```typescript
{/* Aufgabe erstellen - nur fuer Ersteller bei abgeschlossenen Entscheidungen */}
{decision.isCreator && summary.pending === 0 && decision.participants && decision.participants.length > 0 && (
  <div className="mt-2 border-t pt-2">
    <Button
      variant="outline"
      size="sm"
      onClick={(e) => { 
        e.stopPropagation(); 
        createTaskFromDecision(decision); 
      }}
      className="w-full"
    >
      <CheckSquare className="h-4 w-4 mr-2" />
      Aufgabe aus Ergebnis erstellen
    </Button>
  </div>
)}
```

4. Optional: Auch im DropdownMenu hinzufuegen:
```typescript
{summary.pending === 0 && decision.participants && decision.participants.length > 0 && (
  <DropdownMenuItem onClick={(e) => { 
    e.stopPropagation(); 
    createTaskFromDecision(decision); 
  }}>
    <CheckSquare className="h-4 w-4 mr-2" />
    Aufgabe erstellen
  </DropdownMenuItem>
)}
```

---

## Zusammenfassung der Dateiaenderungen

| Datei | Aenderungen |
|-------|-------------|
| `src/components/shared/QuickNotesList.tsx` | Farbmodus-Checkbox Event-Handling + Optimistic UI |
| `src/components/shared/NoteDecisionCreator.tsx` | Oeffentlich, Themen, Dateien hinzufuegen |
| `src/components/task-decisions/DecisionOverview.tsx` | Beschreibung kuerzen, Aufgabe aus Entscheidung erstellen |
| `src/components/GlobalQuickNoteDialog.tsx` | Bessere Fehlerbehandlung und Debugging |

---

## Umsetzungsreihenfolge

1. **GlobalQuickNoteDialog bugfix** - Kritischer Fehler beim Speichern
2. **Farbmodus Checkbox** - UI-Bugfix
3. **NoteDecisionCreator erweitern** - Feature-Parität
4. **Beschreibung kuerzen** - UI-Verbesserung
5. **Aufgabe aus Entscheidung** - Neues Feature

