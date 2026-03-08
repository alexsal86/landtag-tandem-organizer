

# Egress-Analyse und Optimierungsplan

## Wo entsteht der hohe Egress?

Nach Analyse des gesamten Codebasis identifiziere ich **5 Hauptquellen** fuer ueberdurchschnittlichen Datenbank-Egress:

---

### 1. Realtime-Channels ohne Filter (Hoechste Prioritaet)

Mehrere Channels lauschen auf **alle** Aenderungen einer Tabelle ohne `filter`, was bedeutet, dass Supabase fuer **jede** Aenderung an der Tabelle Daten an den Client sendet – auch wenn sie den Nutzer gar nicht betreffen:

| Channel | Tabellen ohne Filter |
|---------|---------------------|
| `my-work-tasks-{userId}` | `tasks`, `task_snoozes`, `task_comments` |
| `my-work-decisions-{userId}` | `task_decisions`, `task_decision_participants`, `task_decision_responses` |
| `case-workspace-{tenantId}` | `task_decisions` |
| `shared-messages-realtime` | `message_confirmations` |

**Problem**: In einem Team mit 5 Nutzern, die jeweils Tasks bearbeiten, bekommt **jeder** Client jede Task-Aenderung zugeschickt, obwohl er nur seine eigenen braucht.

**Loesung**: Filter wie `filter: user_id=eq.${userId}` oder `filter: tenant_id=eq.${tenantId}` hinzufuegen. Bei Tabellen wo kein direkter user_id-Filter moeglich ist (z.B. `task_comments`), zumindest `tenant_id`-Filter verwenden.

---

### 2. Doppelte Realtime-Subscriptions (Hohe Prioritaet)

`MyWorkView.tsx` hat einen **eigenen** Realtime-Channel (`my-work-realtime`) der auf `tasks`, `task_decisions`, `task_decision_participants`, `task_decision_responses`, `case_items`, `case_files` lauscht. Gleichzeitig haben die Data-Hooks (`useMyWorkTasksData`, `useMyWorkDecisionsData`, `useCaseWorkspaceData`) **jeweils eigene** Channels fuer dieselben Tabellen.

Das bedeutet: Fuer **eine** Task-Aenderung werden **zwei** Channels benachrichtigt, die **beide** einen vollstaendigen Refetch ausloesen → doppelter Egress.

**Loesung**: Den `my-work-realtime`-Channel in `MyWorkView.tsx` entfernen. Die Data-Hooks verwalten ihre eigenen Subscriptions bereits korrekt.

---

### 3. 901x `select('*')` in 104 Dateien (Mittlere Prioritaet)

Obwohl bereits einige Hooks optimiert wurden (Tags, Kategorien, Contacts), gibt es noch ~900 Stellen mit `select('*')`. Die groessten Einspar-Kandidaten sind:

| Datei / Hook | Tabelle | Geschaetzte Spalten | Gebrauchte Spalten |
|---|---|---|---|
| `LettersView.tsx` | `letters` | ~25+ | ~8 fuer Liste |
| `AutoStatusDetection.tsx` | `appointments` | ~30+ | ~4 (start, end, title, is_all_day) |
| `CalendarView.tsx` (teilw. schon gut) | `appointments` | ~30+ | bereits optimiert |
| `useAppointmentFeedback.tsx` | `appointment_feedback` | ~15 | ~6 |
| `useKarlsruheDistricts.tsx` | `karlsruhe_districts` | ~10+ (inkl. GeoJSON!) | name, id, bounds |
| `useMapFlags.tsx` | `map_flags` | ~10 | meiste noetig |

Besonders `karlsruhe_districts` mit GeoJSON-Geometrien kann pro Zeile **mehrere KB** betragen.

---

### 4. N+1 Queries in `useDecisionComments` (Mittlere Prioritaet)

Der Hook fuehrt **eine separate Query pro Decision-ID** aus, um Kommentar-Counts zu zaehlen. Bei 20 Entscheidungen sind das 20 parallele Requests. Das laesst sich in **eine einzige Query** zusammenfassen mit `.in('decision_id', decisionIds)` und client-seitigem Grouping.

---

### 5. Ueberfluessige console.log-Statements (Niedrige Prioritaet)

`useDashboardLayout.tsx` allein hat ~20 `console.log`-Aufrufe. Diese erzeugen zwar keinen DB-Egress, aber belasten die Laufzeit. Ausserdem loggt `useCounts.tsx` bei jedem Fetch Debug-Informationen. Diese sollten im Production-Build entfernt werden.

---

## Empfohlene Umsetzung

| # | Massnahme | Geschaetzter Egress-Effekt |
|---|-----------|---------------------------|
| 1 | Filter auf alle Realtime-Channels | **-40-60%** Realtime-Egress |
| 2 | Doppelte Subscriptions in MyWorkView entfernen | **-30%** Refetch-Volumen |
| 3 | Top-15 `select('*')` auf Spaltenauswahl umstellen | **-20-30%** Query-Egress |
| 4 | `useDecisionComments` auf Single-Query umstellen | **-95%** fuer diesen Hook |
| 5 | Debug-Logs entfernen | Minimal, aber sauberer Code |

Alle Massnahmen sind **funktionsneutral** – keine Features werden eingeschraenkt, nur der Datentransfer wird praeziser.

