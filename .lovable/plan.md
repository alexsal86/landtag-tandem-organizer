
# Plan: UI-Verbesserungen fuer Entscheidungen-Seite

## Zusammenfassung

| # | Aenderung |
|---|-----------|
| 1 | Titel groesser und fetter darstellen |
| 2 | Ersteller-Avatar + Name links neben Datum ohne Badge |
| 3 | "Oeffentlich" als Text mit Bindestrich statt Badge |
| 4 | Status-Badge groesser mit ausgefuelltem Hintergrund |
| 5 | Kommentarfeld als ausklappbares Element unter Abstimmungsoptionen |
| 6 | "Entschieden" Badge in gruen bei abgeschlossener Abstimmung |
| 7 | AvatarStack mit echten Profilbildern |
| 8 | Sidebar breiter, Antwortmoeglichkeit direkt einbauen, Titel groesser, HTML rendern |

---

## 1. Titel groesser und fetter

**Aktuelle Zeile (DecisionOverview.tsx ~892):**
```typescript
<h3 className="font-medium text-sm mb-1">{decision.title}</h3>
```

**Neu:**
```typescript
<h3 className="font-semibold text-base mb-1">{decision.title}</h3>
```

- `text-sm` -> `text-base` (groessere Schrift)
- `font-medium` -> `font-semibold` (fetter)

---

## 2. Ersteller-Avatar + Name links neben Datum

**Aktuell:** UserBadge im Header-Bereich mit Badge-Styling

**Neu:** Avatar-Bild + Name ohne Badge, links neben dem Datum in der Footer-Zeile

**Aenderungen:**

1. Avatar_url zum Profile-Fetch hinzufuegen (Zeile ~370):
```typescript
const { data: profiles } = await supabase
  .from('profiles')
  .select('user_id, display_name, badge_color, avatar_url')
  .in('user_id', allUserIds);
```

2. Interface erweitern:
```typescript
creator?: {
  user_id: string;
  display_name: string | null;
  badge_color: string | null;
  avatar_url: string | null;  // NEU
};
```

3. Footer-Zeile umbauen (Zeile ~902-921):
```typescript
<div className="flex items-center gap-3">
  {/* Creator Avatar + Name */}
  {decision.creator && (
    <div className="flex items-center gap-1.5">
      <Avatar className="h-5 w-5">
        <AvatarImage src={decision.creator.avatar_url || undefined} />
        <AvatarFallback 
          className="text-[8px]"
          style={{ backgroundColor: decision.creator.badge_color || undefined }}
        >
          {getInitials(decision.creator.display_name)}
        </AvatarFallback>
      </Avatar>
      <span className="text-[10px] text-muted-foreground">
        {decision.creator.display_name || 'Unbekannt'}
      </span>
    </div>
  )}

  {/* Date */}
  <span className="text-[10px] text-muted-foreground">
    {new Date(decision.created_at).toLocaleDateString('de-DE')}
  </span>

  {/* Visibility as text */}
  {decision.visible_to_all && (
    <span className="text-[10px] text-muted-foreground">
      – Oeffentlich
    </span>
  )}
  
  {/* Attachments */}
  ...
</div>
```

4. UserBadge aus Header-Bereich entfernen (Zeile ~832-839)

---

## 3. "Oeffentlich" als Text statt Badge

**Aktuell (Zeile ~842-847):**
```typescript
{decision.visible_to_all && (
  <Badge variant="secondary" className="text-[10px]">
    <Globe className="h-2.5 w-2.5 mr-1" />
    Oeffentlich
  </Badge>
)}
```

**Neu:** Verschieben in Footer-Zeile als einfacher Text mit Bindestrich:
```typescript
{decision.visible_to_all && (
  <span className="text-[10px] text-muted-foreground">
    – Oeffentlich
  </span>
)}
```

---

## 4. Status-Badge groesser mit ausgefuelltem Hintergrund

**Aktuell (Zeile ~802-824):** Kleine Badges mit `variant="outline"`

**Neu:** Groessere Badges mit ausgefuelltem Hintergrund und intensiverer Farbe

```typescript
{/* Rueckfrage offen - groesser, ausgefuellt */}
{summary.questionCount > 0 ? (
  <Badge className="bg-orange-500 hover:bg-orange-500 text-white text-xs px-3 py-1">
    <MessageCircle className="h-3 w-3 mr-1.5" />
    Rueckfrage offen
  </Badge>
) : summary.pending > 0 && summary.total > 0 ? (
  <Badge className="bg-gray-400 hover:bg-gray-400 text-white text-xs px-3 py-1">
    {summary.pending} ausstehend
  </Badge>
) : summary.pending === 0 && summary.total > 0 ? (
  /* Punkt 6: "Entschieden" Badge */
  <Badge className="bg-green-500 hover:bg-green-500 text-white text-xs px-3 py-1">
    <CheckCircle className="h-3 w-3 mr-1.5" />
    Entschieden
  </Badge>
) : null}
```

- `text-[10px]` -> `text-xs` (groesser)
- `variant="outline"` -> ausgefuellte Hintergrundfarbe
- `px-3 py-1` fuer mehr Platz
- Icons: `h-3 w-3` statt `h-2.5 w-2.5`

---

## 5. Kommentarfeld als ausklappbares Element

**Aktuell:** Kommentarfeld ist immer sichtbar in TaskDecisionResponse

**Neu:** Collapsible mit "Kommentar hinzufuegen" Toggle

**Aenderungen in TaskDecisionResponse.tsx:**

```typescript
const [showCommentField, setShowCommentField] = useState(false);

// In JSX:
<div className="space-y-3">
  {/* Abstimmungsbuttons ZUERST */}
  <div className="flex items-center flex-wrap gap-2">
    {responseOptions.map((option) => {
      // Button-Rendering...
    })}
  </div>

  {/* Kommentar ausklappbar DANACH */}
  <Collapsible open={showCommentField} onOpenChange={setShowCommentField}>
    <CollapsibleTrigger asChild>
      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
        <MessageCircle className="h-3 w-3 mr-1" />
        Kommentar hinzufuegen
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent className="mt-2">
      <SimpleRichTextEditor
        initialContent={questionComment}
        onChange={setQuestionComment}
        placeholder="Ihr Kommentar (optional)..."
        minHeight="80px"
      />
    </CollapsibleContent>
  </Collapsible>
</div>
```

---

## 6. "Entschieden" Badge bei abgeschlossener Abstimmung

Bereits in Punkt 4 integriert:

Wenn `summary.pending === 0 && summary.total > 0`:
- Zeige "Entschieden" statt "Angenommen/Abgelehnt"
- Gruener Hintergrund
- Passend zur gruenen Border

---

## 7. AvatarStack mit echten Profilbildern

**Aktuell:** AvatarStack nutzt nur `badge_color` und Initialen

**Neu:** `avatar_url` hinzufuegen

**Aenderungen in AvatarStack.tsx:**

1. Interface erweitern:
```typescript
interface Participant {
  user_id: string;
  display_name: string | null;
  badge_color: string | null;
  avatar_url?: string | null;  // NEU
  response_type?: 'yes' | 'no' | 'question' | null;
}
```

2. Avatar-Komponente nutzen:
```typescript
<Avatar className={sizeClasses}>
  {participant.avatar_url && (
    <AvatarImage src={participant.avatar_url} />
  )}
  <AvatarFallback
    className="text-foreground font-medium"
    style={{
      backgroundColor: participant.badge_color || 'hsl(var(--muted))',
    }}
  >
    {getInitials(participant.display_name)}
  </AvatarFallback>
</Avatar>
```

3. Profile-Fetch in DecisionOverview erweitern (avatar_url):
```typescript
profile: {
  display_name: profileMap.get(participant.user_id)?.display_name || null,
  badge_color: profileMap.get(participant.user_id)?.badge_color || null,
  avatar_url: profileMap.get(participant.user_id)?.avatar_url || null,  // NEU
},
```

4. avatarParticipants mapping erweitern:
```typescript
const avatarParticipants = (decision.participants || []).map(p => ({
  user_id: p.user_id,
  display_name: p.profile?.display_name || null,
  badge_color: p.profile?.badge_color || null,
  avatar_url: p.profile?.avatar_url || null,  // NEU
  response_type: p.responses[0]?.response_type || null,
}));
```

---

## 8. Sidebar-Verbesserungen

**Aenderungen in DecisionSidebar.tsx:**

### 8.1 Sidebar breiter

**DecisionOverview.tsx (Zeile ~1065):**
```typescript
// Aktuell:
<div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">

// Neu:
<div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
```

### 8.2 Titel groesser und fetter

```typescript
// Aktuell:
<p className="text-xs font-medium truncate">
  {question.decisionTitle}
</p>

// Neu:
<p className="text-sm font-semibold truncate">
  {question.decisionTitle}
</p>
```

### 8.3 HTML in Text uebersetzen (RichTextDisplay nutzen)

```typescript
// Aktuell:
{question.comment && (
  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
    "{question.comment}"
  </p>
)}

// Neu:
{question.comment && (
  <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
    <RichTextDisplay content={question.comment} className="text-[10px]" />
  </div>
)}
```

### 8.4 Antwortmoeglichkeit direkt in Sidebar

Neue State-Variablen und Inline-Antwortfeld:

```typescript
interface DecisionSidebarProps {
  openQuestions: OpenQuestion[];
  newComments: NewComment[];
  onQuestionClick: (decisionId: string) => void;
  onCommentClick: (decisionId: string) => void;
  onResponseSent: () => void;  // NEU: Callback nach Antwort
}

// In Komponente:
const [respondingTo, setRespondingTo] = useState<string | null>(null);
const [responseText, setResponseText] = useState("");
const [isLoading, setIsLoading] = useState(false);

const handleSendResponse = async (responseId: string) => {
  if (!responseText.trim()) return;
  setIsLoading(true);
  
  try {
    const { error } = await supabase
      .from('task_decision_responses')
      .update({ creator_response: responseText.trim() })
      .eq('id', responseId);

    if (error) throw error;
    
    toast.success("Antwort gesendet");
    setResponseText("");
    setRespondingTo(null);
    onResponseSent();
  } catch (error) {
    toast.error("Fehler beim Senden");
  } finally {
    setIsLoading(false);
  }
};
```

**JSX fuer Inline-Antwort:**
```typescript
{openQuestions.map((question) => (
  <div key={question.id} className="...">
    {/* Bestehender Content */}
    
    {respondingTo === question.id ? (
      <div className="mt-2 space-y-2">
        <SimpleRichTextEditor
          initialContent=""
          onChange={setResponseText}
          placeholder="Ihre Antwort..."
          minHeight="60px"
        />
        <div className="flex gap-2">
          <Button 
            size="sm" 
            onClick={() => handleSendResponse(question.id)}
            disabled={isLoading || !responseText.trim()}
          >
            <Send className="h-3 w-3 mr-1" />
            Senden
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => setRespondingTo(null)}
          >
            Abbrechen
          </Button>
        </div>
      </div>
    ) : (
      <Button
        size="sm"
        variant="outline"
        className="mt-2 text-xs"
        onClick={(e) => { e.stopPropagation(); setRespondingTo(question.id); }}
      >
        Antworten
      </Button>
    )}
  </div>
))}
```

---

## Zusammenfassung der Dateiaenderungen

| Datei | Aenderungen |
|-------|-------------|
| `DecisionOverview.tsx` | 1) Titel groesser, 2) Creator-Avatar in Footer, 3) Oeffentlich als Text, 4) Groessere Status-Badges, 6) "Entschieden" Badge, 7) avatar_url zum Profile-Fetch, Sidebar breiter |
| `TaskDecisionResponse.tsx` | 5) Kommentarfeld als Collapsible unter Buttons |
| `AvatarStack.tsx` | 7) avatar_url Support mit AvatarImage |
| `DecisionSidebar.tsx` | 8) Breiter, Titel groesser/fetter, RichTextDisplay, Inline-Antwortmoeglichkeit |

---

## Visuelle Vorschau der neuen Card-Struktur

```
+------------------------------------------------------------------+
|  [████ Rueckfrage offen ████]   [✓ Beantwortet]                  |
|                                                            [...]  |
+------------------------------------------------------------------+
|                                                                  |
|  Kann man hier noch farbtechnisch kennzeichnen...                | <- Groesser, fetter
|                                                                  |
|  Weil ich meine Entscheidung positiv/negativ/...                 | <- Beschreibung grau
|                                                                  |
+------------------------------------------------------------------+
|  👤 Carla  ·  04.02.2026  – Oeffentlich   |  2/0/1  🧑‍🧑‍🧑        |
+------------------------------------------------------------------+
|                                                                  |
|  [✓ Ja]  [✕ Nein]  [💬 Rueckfrage]                              |
|                                                                  |
|  [💬 Kommentar hinzufuegen]  <- Ausklappbar                      |
|                                                                  |
+------------------------------------------------------------------+
```

---

## Sidebar-Vorschau

```
+------------------------------------------+
|  Was liegt fuer mich an?          [3]    |
+------------------------------------------+
|                                          |
|  💬 Offene Rueckfragen            [2]    |
|                                          |
|  ┌────────────────────────────────────┐  |
|  │ Urlaubsplanung fuer Mai            │  | <- Groesser, fetter
|  │ von: 👤 Max                        │  |
|  │                                    │  |
|  │ "Koennte man das auf Juni..."      │  | <- HTML gerendert
|  │                                    │  |
|  │ [Antworten]                        │  | <- NEU: Direktantwort
|  └────────────────────────────────────┘  |
|                                          |
+------------------------------------------+
```
