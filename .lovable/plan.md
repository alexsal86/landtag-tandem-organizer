

# Plan: Entscheidungsanzeige verbessern - Ersteller anzeigen und öffentliche Entscheidungen korrekt darstellen

## Gefundene Probleme

### Problem 1: Ersteller nicht sichtbar in "Meine Arbeit/Entscheidungen"
In `MyWorkDecisionsTab.tsx` wird der Ersteller (`created_by`) zwar geladen, aber es fehlt die Profil-Information (Name) und die Anzeige in der UI.

### Problem 2: Öffentliche Entscheidungen als "unbeantwortet" dargestellt
Wenn der Benutzer weder Ersteller noch Teilnehmer ist (nur Viewer bei `visible_to_all = true`):
- `hasResponded` wird auf `true` gesetzt (Zeile 220), aber...
- `responseType` wird als `dominantResponse` berechnet (Zeile 205-210)
- **Das Problem:** Bei `pendingCount > 0` wird `dominantResponse` auf `null` gesetzt
- Das führt dazu, dass `getBorderColor()` grau zurückgibt und kein Icon angezeigt wird

### Problem 3: DecisionOverview zeigt rote Badges für alle öffentlichen Entscheidungen
In `DecisionOverview.tsx`:
- Die Funktion `getBorderColor(summary)` (Zeilen 665-682) zeigt rot, wenn `yesCount <= noCount`
- Für öffentliche Entscheidungen ohne Teilnehmer ist `summary` leer (0/0/0)
- `0 <= 0` ergibt `true`, daher wird rot angezeigt

### Problem 4: TaskDecisionDetails zeigt keine Ergebnisübersicht für Viewer
Im Details-Dialog wird nur der "Ersteller" das Archivieren-Button angeboten, aber es gibt keine klare visuelle Zusammenfassung für normale Viewer.

---

## Technische Änderungen

### Änderung 1: MyWorkDecisionsTab.tsx - Ersteller-Name laden und anzeigen

**Zeilen 57-127** (loadDecisions Funktion erweitern):

1. Ersteller-Profile separat laden für alle geladenen Entscheidungen
2. `creator` Objekt zu jeder Decision hinzufügen

```typescript
// Nach dem Laden aller Decisions: Creator-Profile laden
const allCreatorIds = [...new Set([
  ...participantDecisions.map(d => d.task_decisions.created_by),
  ...creatorDecisions.map(d => d.created_by),
  ...publicDecisions.map(d => d.created_by)
])];

const { data: creatorProfiles } = await supabase
  .from('profiles')
  .select('user_id, display_name, badge_color')
  .in('user_id', allCreatorIds);

const creatorProfileMap = new Map(creatorProfiles?.map(p => [p.user_id, p]) || []);
```

**Zeilen 332-374** (Karten-Rendering erweitern):

Ersteller-Badge unter dem Datum anzeigen:

```tsx
<div className="flex items-center gap-2 flex-wrap">
  {decision.creator && (
    <span className="text-xs text-muted-foreground flex items-center gap-1">
      Von: 
      <UserBadge 
        userId={decision.creator.user_id}
        displayName={decision.creator.display_name}
        badgeColor={decision.creator.badge_color}
        size="sm"
      />
    </span>
  )}
  <p className="text-xs text-muted-foreground">
    {format(new Date(decision.created_at), "dd.MM.yyyy", { locale: de })}
  </p>
</div>
```

### Änderung 2: MyWorkDecisionsTab.tsx - Farblogik für öffentliche Entscheidungen

**Zeilen 271-291** (getBorderColor Funktion):

Die Logik muss unterscheiden zwischen:
- Benutzer ist Teilnehmer: Farbe basiert auf eigener Antwort
- Benutzer ist nur Viewer (öffentlich): Farbe basiert auf Gesamtergebnis

```typescript
const getBorderColor = (decision: Decision) => {
  // Wenn User Teilnehmer ist: basiert auf eigener Antwort
  if (decision.participant_id) {
    if (!decision.hasResponded) return 'border-l-gray-400';
    if (decision.responseType === 'question') return 'border-l-orange-500';
    if (decision.responseType === 'yes') return 'border-l-green-500';
    if (decision.responseType === 'no') return 'border-l-red-600';
  }
  
  // Wenn User Ersteller ist: basiert auf Gesamtergebnis
  if (decision.isCreator) {
    if (decision.responseType === 'question') return 'border-l-orange-500';
    if (decision.pendingCount > 0) return 'border-l-gray-400';
    if (decision.responseType === 'yes') return 'border-l-green-500';
    if (decision.responseType === 'no') return 'border-l-red-600';
  }
  
  // Öffentliche Entscheidung als Viewer: basiert auf Gesamtergebnis
  if (decision.isPublic) {
    if (decision.responseType === 'question') return 'border-l-orange-500';
    if (decision.responseType === 'yes') return 'border-l-green-500';
    if (decision.responseType === 'no') return 'border-l-red-600';
    // Grau nur wenn noch Antworten ausstehen
    if (decision.pendingCount > 0) return 'border-l-gray-400';
  }
  
  return 'border-l-gray-400';
};
```

### Änderung 3: DecisionOverview.tsx - Border-Farbe korrigieren

**Zeilen 665-682** (getBorderColor Funktion):

Das Problem: Bei 0 Teilnehmern ist `summary = {yes: 0, no: 0, question: 0, pending: 0}` und `0 > 0` ist `false`, daher wird rot gezeigt.

```typescript
const getBorderColor = (summary: ReturnType<typeof getResponseSummary>) => {
  const hasResponses = summary.yesCount + summary.noCount + summary.questionCount > 0;
  const allResponsesReceived = summary.pending === 0;
  const hasQuestions = summary.questionCount > 0;
  
  // Orange: Rückfragen vorhanden
  if (hasQuestions) {
    return 'border-l-orange-500';
  }
  
  // Grau: Noch Antworten ausstehend ODER keine Teilnehmer
  if (!allResponsesReceived || !hasResponses) {
    return 'border-l-gray-400';
  }
  
  // Alle haben geantwortet: Grün wenn mehr Ja, sonst Rot
  if (summary.yesCount > summary.noCount) {
    return 'border-l-green-500';
  } else {
    return 'border-l-red-600';
  }
};
```

### Änderung 4: DecisionOverview.tsx - Ersteller-Badge für öffentliche Entscheidungen

Der Creator-Badge wird bereits in Zeile 866-873 angezeigt, das ist korrekt.

### Änderung 5: TaskDecisionDetails.tsx - Ergebnisübersicht verbessern

Die Abstimmungsübersicht (Zeilen 299-322) wird bereits angezeigt, aber wir können ein visuelles Ergebnis-Badge hinzufügen:

```tsx
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-sm">Abstimmungsübersicht</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="flex items-center space-x-4 text-sm">
      {/* Bestehende Zähler */}
      <span className="flex items-center text-green-600">
        <Check className="h-4 w-4 mr-1" />
        {summary.yesCount} Ja
      </span>
      {/* ... */}
    </div>
    
    {/* NEU: Ergebnis-Badge wenn alle geantwortet haben */}
    {summary.pending === 0 && summary.total > 0 && (
      <div className="mt-3 pt-3 border-t">
        <Badge 
          variant="outline" 
          className={cn(
            "text-sm",
            summary.yesCount > summary.noCount 
              ? "text-green-600 border-green-600 bg-green-50" 
              : summary.questionCount > 0
                ? "text-orange-600 border-orange-600 bg-orange-50"
                : "text-red-600 border-red-600 bg-red-50"
          )}
        >
          Ergebnis: {
            summary.yesCount > summary.noCount 
              ? "Angenommen" 
              : summary.questionCount > 0
                ? "Rückfragen offen"
                : "Abgelehnt"
          }
        </Badge>
      </div>
    )}
  </CardContent>
</Card>
```

---

## Zusammenfassung der Änderungen

| Datei | Problem | Lösung |
|-------|---------|--------|
| `MyWorkDecisionsTab.tsx` | Ersteller nicht sichtbar | Creator-Profile laden und als UserBadge anzeigen |
| `MyWorkDecisionsTab.tsx` | Öffentliche Entscheidungen alle grau | getBorderColor-Logik für Viewer-Rolle anpassen |
| `DecisionOverview.tsx` | Rote Badges bei 0 Teilnehmern | hasResponses-Check hinzufügen |
| `TaskDecisionDetails.tsx` | Kein Ergebnis-Badge | Visuelles Ergebnis-Badge bei abgeschlossener Abstimmung |

---

## Erwartete Ergebnisse

1. **Ersteller sichtbar**: Unter "Meine Arbeit/Entscheidungen" wird der Ersteller als UserBadge dezent unter dem Datum angezeigt
2. **Korrekte Farben für Viewer**: Öffentliche Entscheidungen zeigen das tatsächliche Ergebnis (grün/orange/rot) statt grau
3. **Keine falschen roten Badges**: Entscheidungen ohne Teilnehmer werden grau angezeigt, nicht rot
4. **Ergebnis in Details**: Der Details-Dialog zeigt ein klares "Angenommen/Abgelehnt/Rückfragen offen" Badge

