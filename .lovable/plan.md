

# Code-Qualitatsverbesserungsplan

## Analyse-Ergebnisse

Basierend auf dem Scan des gesamten Projekts gibt es 6 Hauptbereiche mit Verbesserungspotenzial:

| Kategorie | Umfang | Prioritat |
|---|---|---|
| `as any` Type-Casts | ~1.237 Stellen in 100 Dateien | Hoch |
| `: any` Typ-Deklarationen | ~2.487 Stellen in 200 Dateien | Hoch |
| Repetitives Error-Handling | ~3.735 catch-Blocke mit identischem Muster | Mittel |
| Supabase Security Findings | 64 Findings (RLS, Funktionen) | Hoch |
| TODO/FIXME-Kommentare | 15 Stellen (gering) | Niedrig |
| Uberdimensionierte Dateien | Mehrere Hooks >600 Zeilen | Mittel |

---

## Plan: 5 Arbeitspakete

### Paket 1: Zentrales Error-Handling-Utility (hohster Impact)

Aktuell wird in ~262 Dateien dasselbe Muster wiederholt:
```typescript
} catch (error) {
  debugConsole.error('Error doing X:', error);
  toast({ title: 'Fehler', description: '...', variant: 'destructive' });
}
```

**Aktion**: Eine Utility-Funktion `handleError` erstellen:
```typescript
// src/utils/errorHandler.ts
export function handleError(error: unknown, context: string, toast?: ToastFn) {
  debugConsole.error(`${context}:`, error);
  toast?.({ title: 'Fehler', description: context, variant: 'destructive' });
}
```
Danach schrittweise in den Dateien mit den meisten Duplikaten einsetzen (~50 hoch-frequentierte Dateien zuerst).

---

### Paket 2: `as any` Eliminierung (Top-20-Dateien)

Die schlimmsten Falle konzentrieren sich auf:
- **`LettersView.tsx`**: `setLetters(data as any)`, `letter={letter as any}` -- fehlende Letter-Typen aus Supabase
- **`MyWorkView.tsx`**: `counts as any` -- fehlende Typ-Properties in Counts-Interface
- **`QuickNotesWidget.tsx`**: `task as any` -- Task-Typ passt nicht zum Sidebar-Interface
- **`DocumentsView.tsx`**: `selectedLetter as any` -- Letter-Erstellung ohne vollstandigen Typ
- **`Navigation.tsx`**: `notification as any` -- fehlendes Property im Notification-Typ

**Aktion**: In den Top-20-Dateien die `as any`-Casts durch korrekte Typen oder Type-Guards ersetzen. Dabei ggf. Interfaces erweitern statt casten.

---

### Paket 3: Supabase-Sicherheit (kritisch)

Der Security-Scan zeigt:
- **1x RLS Disabled in Public** (Error-Level) -- eine Tabelle ohne RLS
- **1x Sensitive Columns Exposed** (Error-Level) -- sensible Daten ohne RLS
- **6x RLS Policy Always True** (Warn) -- `USING (true)` oder `WITH CHECK (true)` bei INSERT/UPDATE/DELETE
- **~50x Function Search Path Mutable** -- Funktionen ohne `SET search_path`
- **1x Leaked Password Protection Disabled**
- **1x Auth OTP Long Expiry**

**Aktion**:
1. Tabelle ohne RLS identifizieren und RLS aktivieren + Policy erstellen
2. Die 6 overly-permissive Policies durch tenant-basierte Policies ersetzen
3. Die kritischsten DB-Funktionen mit `SET search_path = public` absichern
4. Leaked Password Protection in Supabase Auth-Settings aktivieren (manuell)

---

### Paket 4: Uberdimensionierte Hooks aufteilen

Kandidaten:
- `useEventPlanningData.ts` (1142 Zeilen)
- `useMeetingsData.ts` (619 Zeilen)
- `useLetterOperations.ts` (bereits 230+ Zeilen, aber noch handhabbar)

**Aktion**: Die grossten Hooks in Unter-Hooks aufteilen (z.B. `useEventPlanningData` -> `useEventPlanningQueries` + `useEventPlanningMutations` + `useEventPlanningState`).

---

### Paket 5: Verbleibende `console.*`-Aufrufe bereinigen

Ein finaler Sweep um sicherzustellen, dass wirklich alle `console.log/error/warn`-Aufrufe migriert sind (ausser den bewussten Ausnahmen in `main.tsx` und `debugConsole.ts`).

---

## Empfohlene Reihenfolge

1. **Paket 3** (Sicherheit) -- kritischste Findings zuerst
2. **Paket 1** (Error-Handler-Utility) -- grosster Code-Reduktions-Impact
3. **Paket 2** (`as any` Top-20) -- Typ-Sicherheit
4. **Paket 4** (Hook-Splitting) -- Wartbarkeit
5. **Paket 5** (Finaler Console-Sweep) -- Abschluss

Soll ich mit Paket 3 (Sicherheit) beginnen, oder bevorzugst du eine andere Reihenfolge?

