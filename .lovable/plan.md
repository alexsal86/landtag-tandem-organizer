
# Plan: Checklisten-Fehler endgültig beheben

## Problemanalyse

**Die eigentliche Ursache wurde jetzt identifiziert:**

1. Der Benutzer klickt auf eine Checkbox
2. Das Datenbank-Update wird erfolgreich durchgeführt (Beweis: `updated_at:2026-01-27 11:42:09`)
3. Aber bevor die HTTP-Response ankommt, wird der Request clientseitig abgebrochen
4. Der Supabase-Client gibt diesen Abbruch als `error`-Objekt zurück (nicht als Exception!)
5. Mein `if (error)` Block wird ausgeführt → Rollback + Fehler-Toast

**Das Problem:** Der Supabase-Client unterscheidet nicht zwischen echten Datenbank-Fehlern und Netzwerk-Abbrüchen. Beides kommt als `error`-Objekt zurück.

## Warum der try/catch nicht funktioniert

```text
try {
  const { error } = await supabase.update()  ← Kein Throw bei "Failed to fetch"!
  if (error) {                                 ← Error ist ein Objekt, kein Throw
    rollback()                                 ← Hier landet der Fehler
  }
} catch (fetchError) {                         ← Wird NIE erreicht
}
```

Supabase fängt den Netzwerkfehler intern ab und gibt ihn als `error`-Objekt zurück. Es wird keine Exception geworfen.

## Lösung

Die einzige zuverlässige Lösung ist, **den Fehlertyp zu erkennen** und bei "Failed to fetch" Netzwerkfehlern NICHT zu rollbacken, sondern den Server-Stand zu verifizieren.

**Änderung in `toggleChecklistItem` (Zeile 1222-1231):**

```typescript
if (error) {
  // UNTERSCHEIDUNG: "Failed to fetch" = Netzwerkabbruch, kein echter DB-Fehler
  const isNetworkError = error.message?.includes("Failed to fetch") || 
                         error.message?.includes("NetworkError") ||
                         error.message?.includes("TypeError");
  
  if (isNetworkError) {
    // Bei Netzwerk-Abbruch: Server-Stand nach kurzer Pause verifizieren
    console.warn("Network interruption detected, verifying server state...", error);
    
    setTimeout(async () => {
      if (selectedPlanning) {
        const { data: freshItems } = await supabase
          .from("event_planning_checklist_items")
          .select("*")
          .eq("event_planning_id", selectedPlanning.id)
          .order("order_index", { ascending: true });
        
        if (freshItems) {
          setChecklistItems(freshItems.map(item => ({
            ...item,
            sub_items: (item.sub_items || []) as { title: string; is_completed: boolean }[]
          })));
        }
      }
    }, 500);
    
    // KEIN Rollback, KEIN Fehler-Toast!
    return;
  }
  
  // Nur bei echten Supabase-Fehlern (z.B. RLS-Verletzung) rollbacken
  console.error("Checklist update error:", error);
  setChecklistItems(previousItems);
  toast({
    title: "Fehler",
    description: "Checkliste konnte nicht aktualisiert werden.",
    variant: "destructive",
  });
  return;
}
```

## Zusammenfassung

| Vorher | Nachher |
|--------|---------|
| Jeder Fehler führt zu Rollback + Toast | Unterscheidung nach Fehlertyp |
| "Failed to fetch" = Fehler-Toast | "Failed to fetch" = Stille Server-Verifizierung |
| Datenbank-Fehler = Fehler-Toast | Datenbank-Fehler = Rollback + Fehler-Toast |
| `try/catch` nützt nichts | Fehler-String-Analyse |

## Zu ändernde Datei

| Datei | Änderung |
|-------|----------|
| `src/components/EventPlanningView.tsx` | Zeile 1222-1231: Fehlertyp-Unterscheidung und keine Rollback bei Netzwerk-Abbrüchen |

## Technischer Hintergrund

Der Fehler tritt auf, weil die Lovable-Preview-Umgebung (lovable.js) die `window.fetch`-Funktion instrumentiert. Bei schnellen Re-renders der React-Komponente werden laufende Requests abgebrochen. Der Supabase-Client interpretiert dies als Fehler und gibt ein Error-Objekt zurück - obwohl die Datenbank bereits aktualisiert wurde.

**Geschätzter Aufwand:** ~10 Minuten
