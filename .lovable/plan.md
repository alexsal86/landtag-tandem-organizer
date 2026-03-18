

## Analyse

Es gibt zwei separate Probleme: einen Build-Fehler und die unzuverlässige Systempunkt-Erstellung.

### 1. Build-Fehler: PostCSS/Tailwind v4

`postcss.config.js` referenziert `tailwindcss` direkt als Plugin. Tailwind v4 hat das PostCSS-Plugin nach `@tailwindcss/postcss` verschoben (das Paket ist bereits installiert). Einfacher Config-Fix.

### 2. Systempunkt-Erstellung schlägt fehl

Ich habe die tatsächlichen RLS-Policies in der Datenbank geprüft und folgende Probleme identifiziert:

**a) RSVP-Timeline: falscher Spaltenname**
Der Code (Zeile 251-256) fügt `assigned_date` ein, aber die Tabelle `event_planning_timeline_assignments` hat die Spalte `due_date`. Das lässt den RSVP-Systempunkt bei versandten Einladungen fehlschlagen.

**b) RLS-Policies sind korrekt** — die Migration wurde erfolgreich angewandt. Die `event_planning_item_actions`-Policies nutzen jetzt das Owner/Collaborator-Pattern. Die `topic_backlog` und `social_content_items` Policies nutzen `has_active_tenant_role()`, was funktioniert solange der User eine aktive Tenant-Mitgliedschaft hat.

**c) Potentielles Problem: `.select().single()` nach Insert**
Zeile 128-132 macht `.insert([...]).select().single()`. Falls der Insert zwar funktioniert aber das `.select()` durch eine RLS-Race-Condition kein Ergebnis liefert, ist `data` null und der gesamte Folge-Code bricht ab. Lösung: Pre-generierte ID verwenden (wie schon bei topic_backlog/social_content_items).

### Plan

1. **`postcss.config.js`**: `tailwindcss` durch `@tailwindcss/postcss` ersetzen, `autoprefixer` entfernen (Tailwind v4 inkludiert es)
2. **`useChecklistOperations.ts`**:
   - Checklist-Item-ID vorab generieren (`crypto.randomUUID()`) statt auf `.select().single()` zu vertrauen
   - RSVP-Timeline: `assigned_date` → `due_date` korrigieren
   - Bessere Fehlerbehandlung: wenn `data` null ist, sofort abbrechen mit Fehlermeldung

