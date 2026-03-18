

## Analyse

Ich habe die relevanten Tabellen, RLS-Policies und den Code in `useChecklistOperations.ts` untersucht. Es gibt zwei konkrete Probleme:

### Problem 1: RSVP-Systempunkt — `notes`-Spalte existiert nicht

In Zeile 258 wird beim RSVP-Pfad ein Insert auf `event_planning_timeline_assignments` mit einem `notes`-Feld gemacht:

```ts
await supabase.from("event_planning_timeline_assignments").insert({
  event_planning_id: selectedPlanningId,
  checklist_item_id: itemId,
  due_date: earliestSent.invited_at.split("T")[0],
  notes: `${sentCount} Einladung(en) versandt`,  // ← Spalte existiert nicht!
} as any);
```

Die Tabelle `event_planning_timeline_assignments` hat nur die Spalten: `id`, `event_planning_id`, `checklist_item_id`, `due_date`, `created_at`, `updated_at`. Es gibt **kein** `notes`-Feld. Das `as any` unterdrückt den TypeScript-Fehler, aber PostgreSQL wirft einen Fehler. Da dies innerhalb des `try`-Blocks (Zeile 214) liegt, löst es den `catch` (Zeile 269) aus, der den gesamten Checklisten-Punkt wieder löscht → "RSVP-Systempunkt konnte nicht angelegt werden".

### Problem 2: Social Media — vermutlich RLS oder FK-Problem

Der Social-Media-Pfad (Zeile 148-210) insertet in `topic_backlog` und `social_content_items`. Beide Tabellen haben RLS-INSERT-Policies, die `has_active_tenant_role(auth.uid(), tenant_id, ARRAY['mitarbeiter','bueroleitung','abgeordneter'])` prüfen. Falls der aktuelle User keine aktive Mitgliedschaft mit einer dieser Rollen hat, schlägt der Insert fehl. Außerdem fehlt im Catch-Block (Zeile 200) die Ausgabe der eigentlichen Fehlermeldung.

### Problem 3: Fehlende Fehlerdetails

Beide Catch-Blöcke loggen den Fehler nur via `debugConsole.error`, aber die Toast-Nachricht gibt keine Details aus. Das macht Debugging unmöglich.

---

## Geplante Änderungen

### 1. `useChecklistOperations.ts` — RSVP-Timeline-Insert fixen
- `notes`-Feld aus dem Insert entfernen, da die Spalte nicht existiert
- ODER: Migration erstellen, die eine `notes`-Spalte zu `event_planning_timeline_assignments` hinzufügt

**Empfehlung:** `notes`-Spalte per Migration hinzufügen, da die Info "X Einladungen versandt" sinnvoll ist.

### 2. `useChecklistOperations.ts` — Bessere Fehlerausgabe
- In beiden Catch-Blöcken (Social Media Zeile 200, RSVP Zeile 269) die tatsächliche Fehlermeldung in den Toast aufnehmen, z.B.:
  ```ts
  toast({ title: "Fehler", description: `Systempunkt konnte nicht angelegt werden: ${systemPointError?.message || "Unbekannter Fehler"}`, variant: "destructive" });
  ```

### 3. Migration: `notes`-Spalte auf `event_planning_timeline_assignments`
```sql
ALTER TABLE public.event_planning_timeline_assignments 
ADD COLUMN notes text;
```

Dies ist eine einfache, nullable Spalte — keine RLS-Änderungen nötig, da die bestehende ALL-Policy bereits greift.

