
# Plan: Aufgaben-Sichtbarkeit korrigieren

## Problem

Auf der **Aufgaben-Seite** und in **Meine Arbeit > Aufgaben** werden nicht alle Aufgaben angezeigt, die dem Benutzer gehören oder zugewiesen sind.

## Ursache

### Problem 1: Falscher Filteroperator in TasksView.tsx

Die aktuelle Abfrage (Zeile 711):
```
.or(`user_id.eq.${user.id},assigned_to.cs.{${user.id}},assigned_to.ilike.%${user.id}%`)
```

Der Operator `assigned_to.cs.{uuid}` (contains) ist für **Array**-Spalten gedacht. Die `assigned_to`-Spalte ist aber vom Typ **TEXT**, nicht ARRAY.

### Problem 2: Unvollständige Abfrage in MyWorkTasksTab.tsx

Die aktuelle Abfrage für zugewiesene Aufgaben (Zeile 76):
```
.or(`assigned_to.eq.${user.id},assigned_to.ilike.%${user.id}%`)
```

Diese findet nur Aufgaben, wo der Benutzer zugewiesen ist, aber **nicht** Aufgaben, die der Benutzer selbst erstellt hat und sich selbst zugewiesen hat.

---

## Lösung

### 1. TasksView.tsx - Zeile 711 korrigieren

```typescript
// VORHER (fehlerhaft):
.or(`user_id.eq.${user.id},assigned_to.cs.{${user.id}},assigned_to.ilike.%${user.id}%`)

// NACHHER (korrekt):
.or(`user_id.eq.${user.id},assigned_to.eq.${user.id},assigned_to.ilike.%${user.id}%`)
```

Die Änderung: `assigned_to.cs.{...}` wird zu `assigned_to.eq.${user.id}` - ein direkter Vergleich für exakte UUID-Übereinstimmung.

### 2. MyWorkTasksTab.tsx - Zeile 76 ist bereits korrekt

Die Logik ist tatsächlich korrekt aufgeteilt:
- Zeile 73-78: Lädt Aufgaben, die dem Benutzer **zugewiesen** sind
- Zeile 83-88: Lädt Aufgaben, die der Benutzer **erstellt** hat

Das Problem war nur der falsche Operator in TasksView.

---

## Zusammenfassung der Änderungen

| Datei | Zeile | Änderung |
|-------|-------|----------|
| `src/components/TasksView.tsx` | 711 | `assigned_to.cs.{${user.id}}` → `assigned_to.eq.${user.id}` |

---

## Erwartetes Ergebnis

Nach der Korrektur werden auf der Aufgaben-Seite alle Aufgaben angezeigt, die:
1. Vom Benutzer erstellt wurden (`user_id = current_user`)
2. Dem Benutzer direkt zugewiesen sind (`assigned_to = current_user`)
3. Den Benutzer als Teil einer komma-getrennten Liste enthalten (`assigned_to ILIKE '%user_id%'`)

---

## Technischer Hintergrund

| Operator | Verwendung | Spaltentyp |
|----------|------------|------------|
| `.eq.` | Exakte Übereinstimmung | TEXT, UUID, etc. |
| `.cs.{}` | Contains (Array enthält Wert) | ARRAY[] |
| `.ilike.%...%` | Case-insensitive Pattern-Match | TEXT |

Da `assigned_to` als `TEXT` (nicht `TEXT[]` oder `UUID[]`) definiert ist, muss `.eq.` statt `.cs.` verwendet werden.
