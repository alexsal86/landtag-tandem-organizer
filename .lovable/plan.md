

# Plan: Mitarbeitergespraeche -- Fehler beheben und Features ergaenzen

## Kritische Fehler

### A. PGRST200-Fehler beim Laden eines Gespraechs (Punkte 2 + 4)

Der Fehler `Could not find a relationship between 'employee_meetings' and 'profiles'` tritt auf, weil `employee_meetings.employee_id` eine FK auf `auth.users(id)` hat, NICHT auf `profiles(user_id)`. PostgREST kann den impliziten Join `profiles!employee_id` daher nicht aufloesen.

**Betroffen:**
- `EmployeeMeetingProtocol.tsx` Zeile 225: `select("*, employee:profiles!employee_id(...), supervisor:profiles!conducted_by(...)")`
- `EmployeeMeetingDetail.tsx` Zeile 26-30: Access-Check nutzt `.single()` -- wenn der Query darueber fehlschlaegt, wird der User nach `/employee` weitergeleitet

**Loesung:**
- Den Join-Query in `EmployeeMeetingProtocol.tsx` ersetzen: Statt `profiles!employee_id` separate Queries fuer die Profildaten ausfuehren (analog zu `EmployeeMeetingHistory.tsx`, das bereits korrekt separate Profile-Queries nutzt)
- In `EmployeeMeetingDetail.tsx`: `.single()` durch `.maybeSingle()` ersetzen, um PGRST116-Fehler bei fehlenden Ergebnissen zu vermeiden

---

### B. Scheduler-Navigation verursacht Fehler-Toast trotz Erfolg (Punkt 2)

Der `EmployeeMeetingScheduler` navigiert nach erfolgreicher Erstellung zu `/employee-meeting/{id}`. Dort laedt `EmployeeMeetingProtocol` das Meeting mit dem fehlerhaften `profiles!`-Join, der schlaegt fehl, und ein Fehler-Toast erscheint -- obwohl das Meeting korrekt erstellt wurde.

Dies wird durch Fix A automatisch behoben.

---

## Feature-Erweiterungen

### 1. Mitarbeitergespraeche in Team > Mitarbeiter-Info integrieren

Aktuell sind Mitarbeitergespraeche (Beantragen, Historie) nur unter `/employee` (EmployeesView) sichtbar. Der Wunsch ist, sie auch im Tab "Mitarbeiter-Info" in `TimeTrackingView.tsx` verfuegbar zu machen.

**Loesung:**
- In `EmployeeInfoTab.tsx` einen neuen Abschnitt "Mitarbeitergespraeche" hinzufuegen mit:
  - Button "Gespraech beantragen" (oeffnet `EmployeeMeetingRequestDialog`)
  - `EmployeeMeetingHistory` mit `employeeId={user.id}` und `showFilters={false}`
- Die Komponente benoetigt Zugriff auf `useAuth()` fuer die User-ID

**Dateien:** `EmployeeInfoTab.tsx`

---

### 2. Absagen und Umterminieren von Gespraechen (Punkt 3)

Aktuell gibt es keine Moeglichkeit, ein geplantes Gespraech abzusagen oder umzuterminieren.

**Loesung -- Neue Aktionen im Protokoll-Header (`EmployeeMeetingProtocol.tsx`):**

**Fuer Abgeordnete/Vorgesetzte (conducted_by):**
- Button "Absagen" bei Status `scheduled`: Setzt Status auf `cancelled`, fragt nach Begruendung, sendet Benachrichtigung an Mitarbeiter
- Button "Umterminieren": Oeffnet den `EmployeeMeetingScheduler` mit neuem Datum, setzt alten Termin auf `rescheduled`

**Fuer Mitarbeiter (employee_id):**
- Button "Absagen" bei Status `scheduled`: Setzt Status auf `cancelled_by_employee`, erfordert Begruendung, sendet Benachrichtigung an Vorgesetzten
- Button "Umterminierung anfragen": Erstellt eine Benachrichtigung/Anfrage an den Vorgesetzten mit Begruendung

**DB-Aenderung:**
- Neue erlaubte Status-Werte fuer `employee_meetings.status`: `cancelled`, `cancelled_by_employee`, `rescheduled` (per ALTER TABLE ... DROP CONSTRAINT + neues CHECK oder Entfernen des CHECK-Constraints, falls vorhanden)
- Neue Spalte `cancellation_reason` (TEXT, nullable) auf `employee_meetings`

**Dateien:** SQL-Migration, `EmployeeMeetingProtocol.tsx`, `EmployeeMeetingHistory.tsx` (neue Status-Labels/-Badges)

---

### 3. Benachrichtigungen fuer alle Meeting-Ereignisse (Punkt 5)

Aktuell werden nur bei der Terminierung und Ablehnung von Anfragen Benachrichtigungen gesendet. Es fehlen:

| Ereignis | Empfaenger | Nachricht |
|----------|-----------|-----------|
| Gespraech geplant | Mitarbeiter | Bereits vorhanden |
| Gespraech gestartet | Mitarbeiter | "Ihr Mitarbeitergespraech wurde gestartet" |
| Gespraech abgeschlossen | Mitarbeiter | "Ihr Mitarbeitergespraech wurde abgeschlossen" |
| Gespraech abgesagt (Vorgesetzter) | Mitarbeiter | "Ihr Gespraech am XX wurde abgesagt. Grund: ..." |
| Gespraech abgesagt (Mitarbeiter) | Vorgesetzter | "MA XY hat das Gespraech abgesagt. Grund: ..." |
| Umterminierung angefragt | Vorgesetzter | "MA XY moechte das Gespraech umterminieren" |
| Gespraechwunsch eingereicht | Vorgesetzter | Bereits vorhanden |
| Gespraechwunsch abgelehnt | Mitarbeiter | Bereits vorhanden |

**Loesung:** In `EmployeeMeetingProtocol.tsx` bei `updateStatus()` und den neuen Absage-/Umterminierungs-Funktionen jeweils `supabase.rpc("create_notification", ...)` aufrufen.

**Datei:** `EmployeeMeetingProtocol.tsx`

---

## Technische Zusammenfassung

### SQL-Migration

1. Spalte `cancellation_reason` (TEXT, nullable) auf `employee_meetings` hinzufuegen
2. Status-CHECK-Constraint erweitern um `cancelled`, `cancelled_by_employee`, `rescheduled` (oder Constraint entfernen, falls er die Werte einschraenkt)

### Dateien

| Datei | Aenderungen |
|-------|-------------|
| SQL-Migration | cancellation_reason + Status-Erweiterung |
| `EmployeeMeetingProtocol.tsx` | FK-Join-Fix (separate Profile-Queries), Absagen-/Umterminierungs-Buttons, Benachrichtigungen bei Status-Wechsel |
| `EmployeeMeetingDetail.tsx` | `.single()` durch `.maybeSingle()` ersetzen |
| `EmployeeInfoTab.tsx` | Mitarbeitergespraeche-Bereich mit Request-Dialog + Historie einbetten |
| `EmployeeMeetingHistory.tsx` | Neue Status-Labels (cancelled, rescheduled) in Badges |

