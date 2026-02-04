
# Plan: UI-Feinabstimmung Entscheidungen-Seite

## Zusammenfassung der Änderungen

| # | Änderung | Datei |
|---|----------|-------|
| 1 | Ersteller-Avatar größer, Name fett | DecisionOverview.tsx |
| 2 | AvatarStack auseinanderziehen | AvatarStack.tsx |
| 3 | Abstimmungsergebnis fett + Kennzeichnung | DecisionOverview.tsx |
| 4 | Kommentar hinter Rückfrage-Button | TaskDecisionResponse.tsx |
| 5 | Sidebar-Titel größer und fett | DecisionSidebar.tsx |
| 6 | Sidebar-Start auf Höhe der Tabs | DecisionOverview.tsx |
| 7 | Archiv-Link in Tab-Leiste integrieren | DecisionOverview.tsx |

---

## 1. Ersteller-Avatar größer, Name fett

**Aktuell (Zeile 895-910):**
```typescript
<Avatar className="h-5 w-5">
...
<span className="text-[10px] text-muted-foreground">
  {decision.creator.display_name || 'Unbekannt'}
</span>
```

**Neu:**
```typescript
<Avatar className="h-6 w-6">
...
<span className="text-xs font-semibold text-foreground">
  {decision.creator.display_name || 'Unbekannt'}
</span>
```

- Avatar: `h-5 w-5` → `h-6 w-6` (größer)
- Name: `text-[10px] text-muted-foreground` → `text-xs font-semibold text-foreground` (größer und fett)
- AvatarFallback Schrift: `text-[8px]` → `text-[9px]`

---

## 2. AvatarStack auseinanderziehen

**Aktuell (Zeile 61):**
```typescript
<div className="flex items-center -space-x-2">
```

**Neu:**
```typescript
<div className="flex items-center -space-x-1">
```

- `-space-x-2` → `-space-x-1` (weniger Überlappung = mehr Abstand)

Optional auch beim Ring:
- `ring-2` → `ring-1` für dünneren Ring, damit mehr vom Avatar sichtbar ist

---

## 3. Abstimmungsergebnis fett und gekennzeichnet

**Aktuell (Zeile 943-949):**
```typescript
<div className="flex items-center gap-1.5 text-[10px]">
  <span className="text-green-600 font-medium">{summary.yesCount}</span>
  <span className="text-muted-foreground">/</span>
  <span className="text-orange-600 font-medium">{summary.questionCount}</span>
  <span className="text-muted-foreground">/</span>
  <span className="text-red-600 font-medium">{summary.noCount}</span>
</div>
```

**Neu:**
```typescript
<div className="flex items-center gap-1 text-xs">
  <span className="text-muted-foreground font-medium">Stand:</span>
  <span className="text-green-600 font-bold">{summary.yesCount}</span>
  <span className="text-muted-foreground">/</span>
  <span className="text-orange-600 font-bold">{summary.questionCount}</span>
  <span className="text-muted-foreground">/</span>
  <span className="text-red-600 font-bold">{summary.noCount}</span>
</div>
```

- Label "Stand:" hinzufügen (kürzer als "Aktueller Stand")
- `text-[10px]` → `text-xs` (größer)
- `font-medium` → `font-bold` (fetter)

---

## 4. Kommentar hinter Rückfrage-Button

**Aktuell in TaskDecisionResponse.tsx:**
Das Collapsible "Kommentar hinzufügen" ist UNTER den Buttons als separates Element.

**Neu:**
Das "Kommentar hinzufügen" Element soll INLINE neben/nach dem Rückfrage-Button stehen.

**Änderung (Zeile 329-443):**
```typescript
<div className="flex items-center flex-wrap gap-2">
  {responseOptions.map((option) => {
    // ... Button-Rendering
  })}
  
  {/* Kommentar-Trigger DIREKT in der Button-Reihe */}
  <Collapsible open={showCommentField} onOpenChange={setShowCommentField}>
    <CollapsibleTrigger asChild>
      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
        <MessageCircle className="h-3 w-3 mr-1" />
        Kommentar
        <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${showCommentField ? 'rotate-180' : ''}`} />
      </Button>
    </CollapsibleTrigger>
  </Collapsible>
  
  {showEdit && (
    // Abbrechen Button...
  )}
</div>

{/* Kommentarfeld unter den Buttons wenn geöffnet */}
{showCommentField && (
  <div className="mt-2">
    <SimpleRichTextEditor ... />
  </div>
)}
```

Alternativ: Den Text kürzen von "Kommentar hinzufügen" zu "Kommentar", damit es in die Reihe passt.

---

## 5. Sidebar-Titel größer und fett

**Aktuell (Zeile 95):**
```typescript
<CardTitle className="text-sm font-medium">Was liegt für mich an?</CardTitle>
```

**Neu:**
```typescript
<CardTitle className="text-base font-bold">Was liegt für mich an?</CardTitle>
```

- `text-sm` → `text-base` (größer)
- `font-medium` → `font-bold` (fett)

---

## 6. Sidebar-Start auf Höhe der Tabs

**Aktuell:** Die Sidebar beginnt bei `sticky top-6`, während der Hauptinhalt mit Suchleiste + Tabs beginnt.

**Problem:** Die Sidebar-Card beginnt auf Höhe des Seitentitels, nicht auf Höhe der Tab-Leiste.

**Lösung:** Das Grid-Layout so anpassen, dass Suchleiste und Tabs VOR dem Grid kommen, und die Sidebar erst mit dem Tab-Content beginnt.

**Neue Struktur in DecisionOverview.tsx:**

```typescript
<div className="min-h-screen bg-gradient-subtle p-6">
  {/* Header */}
  <div className="mb-6">
    <h1>...</h1>
    <p>...</p>
  </div>
  
  {/* Search */}
  <div className="flex items-center gap-3 mb-4">
    <Input ... />
    <StandaloneDecisionCreator ... />
  </div>
  
  {/* Tabs + Grid Layout */}
  <Tabs ...>
    {/* TabsList AUSSERHALB des Grids */}
    <TabsList className="grid w-full grid-cols-5 h-9 mb-4">
      ...
    </TabsList>
    
    {/* Grid: Content + Sidebar auf GLEICHER HÖHE */}
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
      {/* Main Content */}
      <TabsContent value={activeTab} className="mt-0 space-y-3">
        ...
      </TabsContent>
      
      {/* Right Sidebar */}
      <DecisionSidebar ... />
    </div>
  </Tabs>
</div>
```

**Wichtig:** `mt-4` bei TabsContent entfernen (→ `mt-0`), damit Content und Sidebar auf gleicher Höhe starten.

---

## 7. Archiv-Link in Tab-Leiste integrieren

**Aktuell:**
- 4 Tabs: Für mich, Von mir, Öffentlich, Rückfragen
- Separater Link unter der Liste: "Archiviert (X)"

**Neu:**
- 5 Tabs: Für mich, Von mir, Öffentlich, Rückfragen, Archiviert

**Änderung (Zeile 1104-1127):**
```typescript
<TabsList className="grid w-full grid-cols-5 h-9">
  <TabsTrigger value="for-me" className="text-xs">
    Für mich
    {tabCounts.forMe > 0 && (
      <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0">
        {tabCounts.forMe}
      </Badge>
    )}
  </TabsTrigger>
  <TabsTrigger value="my-decisions" className="text-xs">
    Von mir ({tabCounts.myDecisions})
  </TabsTrigger>
  <TabsTrigger value="public" className="text-xs">
    Öffentlich ({tabCounts.public})
  </TabsTrigger>
  <TabsTrigger value="questions" className="text-xs">
    Rückfragen
    {tabCounts.questions > 0 && (
      <Badge variant="outline" className="ml-1.5 text-orange-600 border-orange-600 text-[10px] px-1.5 py-0">
        {tabCounts.questions}
      </Badge>
    )}
  </TabsTrigger>
  {/* NEU: Archiviert Tab */}
  <TabsTrigger value="archived" className="text-xs">
    <FolderArchive className="h-3 w-3 mr-1" />
    Archiviert ({tabCounts.archived})
  </TabsTrigger>
</TabsList>
```

**Entfernen:** Den separaten "Archiviert"-Button/Link (Zeile 1149-1158) entfernen.

---

## Zusammenfassung der Dateiänderungen

| Datei | Änderungen |
|-------|------------|
| `DecisionOverview.tsx` | 1) Avatar größer + Name fett, 3) Stand-Label + fette Zahlen, 6) Layout-Umstrukturierung für Sidebar-Höhe, 7) Archiv als 5. Tab |
| `AvatarStack.tsx` | 2) Spacing von `-space-x-2` auf `-space-x-1` |
| `TaskDecisionResponse.tsx` | 4) Kommentar-Button in die Button-Reihe verschieben |
| `DecisionSidebar.tsx` | 5) Titel größer und fetter |

---

## Technische Details

### Layout-Struktur nach Änderung 6:

```
+----------------------------------------------------------+
| Header: Entscheidungen                                   |
| Subheader: Beschreibung                                  |
+----------------------------------------------------------+
| [🔍 Suche...                              ] [+ Neu]      |
+----------------------------------------------------------+
| [Für mich] [Von mir] [Öffentlich] [Rückfragen] [Archiv]  |
+---------------------------+------------------------------+
|                           |                              |
|  Entscheidungskarten      |  Was liegt für mich an?      | ← Gleiche Höhe
|  ...                      |  (Sidebar)                   |
|                           |                              |
+---------------------------+------------------------------+
```
