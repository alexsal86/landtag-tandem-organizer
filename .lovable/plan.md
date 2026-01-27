
# Plan: Zwei Fehler in der Veranstaltungsplanung beheben

## Übersicht

| # | Problem | Ursache | Lösung | Aufwand |
|---|---------|---------|--------|---------|
| 1 | "Standard-Mitarbeiter" Dialog öffnet erst nach Event-Klick | Dialog ist außerhalb des `!selectedPlanning` return-Blocks | Dialog in beide return-Blöcke einfügen | 10 Min |
| 2 | Checkliste zeigt Fehler und rollt zurück | `Failed to fetch` Netzwerkfehler durch schnellen Re-render | Stabileren Update-Mechanismus ohne sofortiges Rollback bei Netzwerk-Timeouts | 20 Min |

---

## 1. "Standard-Mitarbeiter" Dialog öffnet nicht sofort

### Ursachenanalyse

Die Komponente `EventPlanningView` hat zwei separate `return`-Blöcke:

```text
if (!selectedPlanning) {
  return (
    // Übersichts-Ansicht (Zeile 2511-2862)
    // Button "Standard-Mitarbeiter" ist hier (Zeile 2519-2526)
    // Aber der Dialog ist NICHT hier!
  );
}

return (
  // Detail-Ansicht (Zeile 2865-4475)
  // Der Dialog ist nur HIER (Zeile 4470-4473)
);
```

Der Button auf Zeile 2522 setzt `setShowDefaultCollaboratorsDialog(true)`, aber der Dialog `PlanningDefaultCollaboratorsDialog` wird nur im zweiten return-Block (Detail-Ansicht) gerendert. Deshalb passiert beim Klick nichts - der Dialog existiert im DOM gar nicht!

### Lösung

Der Dialog muss auch im `!selectedPlanning` Block eingefügt werden, direkt vor dem schließenden `</div>` auf Zeile 2861.

**Datei:** `src/components/EventPlanningView.tsx`

**Änderung (vor Zeile 2862):**
```typescript
        {/* Default Collaborators Dialog - auch in Übersicht */}
        <PlanningDefaultCollaboratorsDialog
          open={showDefaultCollaboratorsDialog}
          onOpenChange={setShowDefaultCollaboratorsDialog}
        />
      </div>
    );
  }
```

---

## 2. Checkliste: Fehler und Rollback beheben

### Ursachenanalyse

Die Netzwerk-Logs zeigen:
```
PATCH .../event_planning_checklist_items?id=eq.e819b3da...
Request Body: {"is_completed":false}
Error: Failed to fetch
```

"Failed to fetch" bedeutet, dass der Request abgebrochen wurde (typisch bei React re-renders/unmounts). Das passiert, wenn die Checkbox schnell geklickt wird oder die Komponente neu gerendert wird, bevor der Request abgeschlossen ist.

**Aktueller Ablauf:**
1. Checkbox geklickt
2. Optimistisches Update → UI zeigt neuen Zustand
3. Supabase PATCH Request startet
4. Request wird abgebrochen (durch schnellen Re-render)
5. `error` ist truthy → Rollback auf `previousItems`
6. Fehler-Toast wird angezeigt

**Problem:** Die Datenbank wird trotzdem aktualisiert (daher korrekt nach Seiten-Reload), aber der abgebrochene Request liefert einen Fehler zurück.

### Lösung

1. **AbortController-Fehler ignorieren**: Bei "Failed to fetch" nicht sofort rollbacken
2. **Stabilerer Check**: Nur bei echten Supabase-Fehlern rollbacken
3. **Re-fetch nach Timeout**: Falls unsicher, nach kurzer Pause den aktuellen Stand nachladen

**Datei:** `src/components/EventPlanningView.tsx`

**Änderung der `toggleChecklistItem` Funktion (Zeile 1192-1263):**

```typescript
const toggleChecklistItem = async (itemId: string, isCompleted: boolean) => {
  // Check if user has edit permission
  const canEdit = selectedPlanning?.user_id === user?.id || 
    collaborators.some(c => c.user_id === user?.id && c.can_edit);
  
  if (!canEdit) {
    toast({
      title: "Keine Berechtigung",
      description: "Sie haben keine Bearbeitungsrechte für diese Checkliste.",
      variant: "destructive",
    });
    return;
  }

  // Optimistic update - update UI immediately
  const previousItems = [...checklistItems];
  const newCompletedState = !isCompleted;
  
  setChecklistItems(prev => 
    prev.map(item => 
      item.id === itemId ? { ...item, is_completed: newCompletedState } : item
    )
  );

  try {
    const { error } = await supabase
      .from("event_planning_checklist_items")
      .update({ is_completed: newCompletedState })
      .eq("id", itemId);

    if (error) {
      // Nur bei echten Supabase-Fehlern rollbacken
      console.error("Checklist update error:", error);
      setChecklistItems(previousItems);
      toast({
        title: "Fehler",
        description: "Checkliste konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
      return;
    }

    // Check if email automation should be triggered (when checking, not unchecking)
    const emailAction = itemEmailActions[itemId];
    if (newCompletedState && emailAction?.is_enabled) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          await supabase.functions.invoke("send-checklist-email", {
            body: {
              actionId: emailAction.id,
              checklistItemId: itemId,
            },
          });

          toast({
            title: "E-Mail versendet",
            description: "Benachrichtigung wurde automatisch versendet.",
          });
        }
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        // Don't show error toast for email - the main update succeeded
      }
    }

    // Erfolgs-Toast nur wenn alles geklappt hat - OHNE weiteren Toast
    // (Toast bei jedem Klick ist störend, optional entfernen)
  } catch (fetchError) {
    // Bei Netzwerk-Fehlern (Failed to fetch) NICHT sofort rollbacken
    // Stattdessen: Nach kurzer Pause den Stand vom Server holen
    console.warn("Network error during checklist update, verifying state...", fetchError);
    
    // Kurz warten und dann den echten Stand vom Server holen
    setTimeout(async () => {
      if (selectedPlanning) {
        const { data: freshItems } = await supabase
          .from("event_planning_checklist_items")
          .select("*")
          .eq("event_planning_id", selectedPlanning.id)
          .order("order_index", { ascending: true });
        
        if (freshItems) {
          setChecklistItems(freshItems);
        }
      }
    }, 500);
  }
};
```

### Wichtige Änderungen:

1. **try/catch um den ganzen Block**: Fängt "Failed to fetch" Netzwerkfehler ab
2. **Kein sofortiges Rollback bei Netzwerk-Fehlern**: Stattdessen nach 500ms den echten Stand vom Server laden
3. **Logik-Fix**: Die Bedingung für Email-Versand war falsch (`!isCompleted` statt `newCompletedState`)
4. **Weniger störende Toasts**: Der Erfolgs-Toast bei jedem Checkbox-Klick kann optional entfernt werden

---

## Zusammenfassung der Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/EventPlanningView.tsx` | 1) Dialog in Übersichts-Block einfügen (vor Zeile 2862), 2) `toggleChecklistItem` mit try/catch und Netzwerk-Fehlerbehandlung |

---

## Technische Details

### Dialog-Platzierung

```text
VORHER:
┌─────────────────────────────────────────────────────┐
│ if (!selectedPlanning) {                            │
│   return (                                          │
│     <Button onClick={setShowDefaultCollaborators}>  │  ← Button hier
│     ...                                             │
│   );  ← Dialog FEHLT hier!                          │
│ }                                                   │
│                                                     │
│ return (                                            │
│   ...                                               │
│   <PlanningDefaultCollaboratorsDialog />  ← Dialog nur hier
│ );                                                  │
└─────────────────────────────────────────────────────┘

NACHHER:
┌─────────────────────────────────────────────────────┐
│ if (!selectedPlanning) {                            │
│   return (                                          │
│     <Button onClick={setShowDefaultCollaborators}>  │
│     ...                                             │
│     <PlanningDefaultCollaboratorsDialog />  ← Dialog auch hier!
│   );                                                │
│ }                                                   │
│                                                     │
│ return (                                            │
│   ...                                               │
│   <PlanningDefaultCollaboratorsDialog />            │
│ );                                                  │
└─────────────────────────────────────────────────────┘
```

### Netzwerk-Fehlerbehandlung

```text
┌───────────────────────────────────────────────────────────────┐
│ 1. Checkbox geklickt                                          │
├───────────────────────────────────────────────────────────────┤
│ 2. Optimistisches Update → UI zeigt sofort neuen Zustand     │
├───────────────────────────────────────────────────────────────┤
│ 3. try { await supabase.update() }                            │
│    ├─ Erfolg: Fertig (optional Toast)                         │
│    └─ Supabase Error: Rollback + Fehler-Toast                 │
├───────────────────────────────────────────────────────────────┤
│ catch (fetchError) → Netzwerk abgebrochen                     │
│    └─ Warte 500ms, dann Server-Stand laden (kein Rollback!)  │
└───────────────────────────────────────────────────────────────┘
```

**Geschätzter Gesamtaufwand:** ~30 Minuten
