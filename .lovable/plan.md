

## Plan: Tagessimulation-Flicker, Zeitfenster-Korrektur und Push-Diagnose

### 1. Flicker in der Tagessimulation beheben (`MyWorkDecisionCard.tsx`)

**Ursache**: `shouldShowTimeline` hängt von `isScheduleHoverOpen` ab (Zeile 80). Jede Mausbewegung über den Info-Button toggled den State, was den `useEffect` (Zeile 216) neu triggert und die Daten neu lädt → Flicker.

**Fix**:
- Daten-Loading von Sichtbarkeit trennen: Neuer State `hasLoadedTimeline` + separate Bedingung `shouldLoadTimeline` (nur `isAppointmentRequest && isRequestedStartValid && (isSchedulePinnedOpen || isScheduleHoverOpen)` beim ersten Mal, danach gecached)
- `useEffect` Dependency auf ein stabileres Signal umstellen: Daten nur laden wenn `isAppointmentRequest && isRequestedStartValid` und noch nicht geladen. Sichtbarkeit (`shouldShowTimeline`) nur für das Rendering nutzen, nicht für das Laden.
- Alternativ einfacher: Daten laden sobald die Karte gemountet wird (wenn `isAppointmentRequest && isRequestedStartValid`), unabhängig von der Toggle-Sichtbarkeit. Dann kein Re-Fetch bei Hover.

### 2. Zeitfenster: 3h vor Start, 3h nach Ende

**Aktuell** (beide Dateien): `requestedStart - 3h` bis `requestedStart + 3h` (6h Fenster).

**Gewünscht**: `requestedStart - 3h` bis `requestedEnd + 3h`. Da `requestedEnd = requestedStart + APPOINTMENT_REQUEST_DEFAULT_DURATION_MINUTES`, ist das Fenster jetzt `6h + Dauer`.

**Änderungen**:
- `MyWorkDecisionCard.tsx` Zeile 81: `timelineWindowMinutes` dynamisch berechnen: `6 * 60 + APPOINTMENT_REQUEST_DEFAULT_DURATION_MINUTES`
- Zeile 89-94 (`timelineBounds`): `windowEnd = requestedStart + APPOINTMENT_REQUEST_DEFAULT_DURATION_MINUTES + 3h`, aufgerundet auf volle Stunde
- Zeile 221-222 (Query): `contextEndIso` auf `requestedEnd + 3h` setzen
- Zeile 100 (Stunden-Slots): Anzahl dynamisch basierend auf neuem Fenster
- `MyWorkDashboardAppointments.tsx` Zeile 222/229-231/310-311: Identische Anpassung

### 3. Web Push Diagnose und Verbesserung

**Befund**: Die Push-Infrastruktur funktioniert technisch:
- Trigger `trigger_push_on_notification` ist aktiv
- Edge Function `send-push-notification` läuft und sendet erfolgreich (`sent: 1`)
- FCM akzeptiert die Anfrage (Status 200/201)
- Vault-Secrets (`supabase_url`, `service_role_key`) sind vorhanden
- VAPID-Key wird korrekt zurückgegeben

**Mögliche Client-Ursachen**:
- Die aktive Subscription nutzt den Legacy-FCM-Endpoint (`fcm.googleapis.com/fcm/send/`). Dieser wurde von Google deprecated zugunsten von `fcm.googleapis.com/wp/`. Die Push-Nachricht wird zwar vom Server akzeptiert, aber möglicherweise nicht mehr an den Browser zugestellt.
- Browser-Notification-Permission könnte im Browser-Level blockiert sein (OS-Einstellungen)

**Fix**: 
- In `useNotifications.tsx` die Auto-Renewal-Logik (Zeile 694-729) erweitern: Wenn der Endpoint den Legacy-Prefix `fcm.googleapis.com/fcm/send/` enthält, automatisch die alte Subscription unsubscriben und eine neue erstellen
- Besseres Logging wenn die Subscription erneuert wird
- In `coi-serviceworker.js` Push-Handler: Debug-Log hinzufügen, ob `self.registration.showNotification` tatsächlich aufgerufen wird

### Dateien

| Datei | Änderung |
|---|---|
| `src/components/my-work/decisions/MyWorkDecisionCard.tsx` | Flicker fix: Daten unabhängig von Hover laden; Zeitfenster auf Start-3h bis Ende+3h |
| `src/components/my-work/MyWorkDashboardAppointments.tsx` | Zeitfenster auf Start-3h bis Ende+3h |
| `src/hooks/useNotifications.tsx` | Legacy-FCM-Endpoint erkennen und Subscription auto-erneuern |
| `public/coi-serviceworker.js` | Debug-Logging im Push-Handler |

