

## Plan: Heutige Fristen automatisch in den Tageszettel injizieren + bei Erledigung entfernen

### Kontext
Der Tageszettel nutzt bereits ein Injektionsmuster: Recurring Items und Wochenplan-Einträge werden per `useEffect` einmalig pro Tag eingefügt (mit Flags wie `recurringInjected`, `weekPlanInjected`). Dasselbe Muster wird für heutige Fristen angewandt.

Zusätzlich gibt es einen Build-Fehler in `RealTimeSync.tsx` (TypeScript-Generics in TSX-Datei), der zuerst behoben werden muss.

### Änderungen

**1. Build-Fehler in `RealTimeSync.tsx` beheben**
- Die generische Funktion `isBroadcastPayloadEnvelope<TPayload>` wird vom TSX-Parser als JSX-Tag interpretiert. Lösung: Die Funktion ohne Inline-Generics umschreiben (Type Assertion statt generischem Parameter) oder in eine `.ts`-Datei auslagern.

**2. `DaySlipDayData` um Flag erweitern** (`dayslipTypes.ts`)
- Neues optionales Feld `deadlinesInjected?: boolean` hinzufügen, analog zu `recurringInjected` und `weekPlanInjected`.

**3. Deadline-Injection in `useDaySlipStore.ts`**
- Neuer `useEffect` (analog zum Recurring/Week-Plan-Pattern):
  - Prüft `todayData.deadlinesInjected` – wenn `true`, nichts tun.
  - Lädt heutige Fristen via Supabase (Tasks mit `due_date = today` + `status != completed`, Quick Notes mit `follow_up_date = today`, Case Items mit `due_at = today` + `status != erledigt`, Decisions mit `response_deadline = today` + `status != resolved`, Planning-Assignments mit `due_date = today`).
  - Formatiert sie als Textzeilen (z.B. `📋 Aufgabentitel` / `📝 Notiztitel` / `📁 Vorgangsbetreff` / `⚖️ Entscheidungstitel` / `📅 Planungstitel`).
  - Ruft `appendLinesToToday(lines)` auf und setzt `deadlinesInjected: true`.

**4. Auto-Entfernung erledigter Elemente**
- Realtime-Subscription im `useDaySlipStore` auf relevante Tabellen (`tasks`, `case_items`, `task_decisions`) für Status-Änderungen.
- Wenn ein Element als erledigt markiert wird (`status = completed/erledigt/resolved`), wird die zugehörige Zeile im Tageszettel per `toggleStrike` durchgestrichen (oder per `deleteLine` entfernt).
- Matching erfolgt über den Zeilentext (Titel-Vergleich) oder über ein neues optionales Feld `sourceId` in den `lineTimestamps`, das bei der Injection gespeichert wird.

### Technische Details

- **Injection-Mapping**: Beim Injizieren wird eine Map `{sourceType}:{sourceId} → lineId` in `lineTimestamps` oder einem neuen Feld `deadlineLineMap` auf `DaySlipDayData` gespeichert, damit erledigte Elemente sicher der richtigen Zeile zugeordnet werden können.
- **Realtime-Listener**: Drei Subscriptions (tasks, case_items, task_decisions) mit `postgres_changes` auf UPDATE-Events, gefiltert auf den aktuellen User/Tenant. Bei Statuswechsel zu "erledigt" wird `deleteLine` für die gemappte `lineId` aufgerufen.
- **Idempotenz**: Das `deadlinesInjected`-Flag verhindert doppeltes Einfügen. Bei neuen Fristen, die nach dem ersten Laden hinzukommen, werden diese nicht automatisch nachinjiziert (konsistent mit dem bestehenden Verhalten bei Recurring Items).

### Dateien
| Datei | Änderung |
|---|---|
| `src/components/dashboard/RealTimeSync.tsx` | Generics-Syntax-Fix |
| `src/components/dayslip/dayslipTypes.ts` | `deadlinesInjected` + `deadlineLineMap` Felder |
| `src/components/dayslip/hooks/useDaySlipStore.ts` | Deadline-Injection-Effect + Realtime-Subscription für Auto-Entfernung |

