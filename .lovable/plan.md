

# Plan: Erstellungs-Fehler in Themenspeicher & Social Planner beheben

## Diagnose

**Hauptproblem:** Die `createFromTopic`-Funktion in `ThemenspeicherPanel.tsx` (Zeile 183-198) umgeht den Hook `useSocialPlannerItems.createItem` und macht einen direkten Supabase-INSERT mit `.select("id").single()`. Obwohl die RLS-Policies korrekt konfiguriert sind (INSERT via `has_active_tenant_role`, SELECT via `user_has_tenant_access`), kann `.single()` fehlschlagen wenn die Antwort nicht exakt eine Zeile enthält.

Die Hooks (`useTopicBacklog.createTopic` und `useSocialPlannerItems.createItem`) wurden bereits auf client-seitige UUIDs umgestellt — aber `ThemenspeicherPanel.createFromTopic` wurde **nicht** aktualisiert und nutzt noch das alte Pattern.

Zusätzlich: Fehler werden über `debugConsole.error` geloggt, das standardmäßig **deaktiviert** ist. Fehler sind für den User unsichtbar.

## Fixes

### 1. `ThemenspeicherPanel.tsx` — `createFromTopic` reparieren
- Client-seitige UUID generieren (`crypto.randomUUID()`)
- `.select("id").single()` entfernen, nur `.insert()` verwenden
- `createdItem.id` durch die lokale UUID ersetzen (für die Channel-Verknüpfung in Zeile 209)

### 2. Fehler sichtbar machen
- In beiden Hooks und im Panel: bei Mutations-Fehlern zusätzlich `console.error` (nicht nur `debugConsole.error`) verwenden, damit Fehler im Browser sichtbar sind
- In catch-Blöcken den tatsächlichen Fehlertext im Toast anzeigen

### Betroffene Dateien
- `src/components/my-work/ThemenspeicherPanel.tsx` — createFromTopic auf client-side UUID umstellen
- `src/hooks/useTopicBacklog.ts` — `console.error` bei Fehler ergänzen
- `src/hooks/useSocialPlannerItems.ts` — `console.error` bei Fehler ergänzen

