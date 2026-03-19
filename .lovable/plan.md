

## Problem

Die Browser-Push-Benachrichtigungen sind kaputt, weil die Edge Function `send-push-notification` **alle Anfragen** zuerst durch `requireServiceRole()` prüft (Zeile 302). Das blockiert:

1. **VAPID Public Key abrufen (GET)**: Der Client braucht den VAPID-Schlüssel, um sich für Push-Notifications zu registrieren. Der GET-Handler (Zeile 309) wird nie erreicht, weil die Service-Role-Prüfung vorher mit 401 abweist. Der Client sendet nur den Anon-Key.

2. **Direkte Push-Aufrufe aus dem Client**: `MessageComposer.tsx` und die Test-Komponenten rufen die Funktion mit dem Anon-Key auf → 401.

Der **Datenbank-Trigger** (`trigger_push_on_notification`) funktioniert korrekt, da er den Service-Role-Key aus dem Vault verwendet. Aber ohne VAPID-Key-Zugang kann sich kein Browser überhaupt für Push registrieren.

## Lösung

### 1. Edge Function `send-push-notification/index.ts` anpassen

Den GET-Handler für den VAPID Public Key **vor** die `requireServiceRole`-Prüfung verschieben. Für GET reicht eine einfache Auth-Prüfung (angemeldeter User) oder gar keine (der Public Key ist öffentlich):

```
// CORS → GET (VAPID key, kein Service-Role nötig) → requireServiceRole für POST
```

Konkret:
- Zeile 301-306: Die `requireServiceRole`-Prüfung erst **nach** dem GET-Handler ausführen
- GET-Anfragen brauchen nur einen gültigen Auth-Header (oder gar keinen, da der VAPID Public Key per Definition öffentlich ist)

### 2. MessageComposer.tsx - Direkten Push-Aufruf entfernen

Der direkte Aufruf von `send-push-notification` in `MessageComposer.tsx` (Zeile 104-118) ist redundant: Wenn eine Nachricht erstellt wird, wird eine Notification in die DB eingefügt, was den Trigger auslöst, der wiederum die Push-Notification sendet. Der direkte Aufruf würde ohnehin mit 401 scheitern.

→ Den `try`-Block (Zeilen 101-123) entfernen.

## Dateien

1. **`supabase/functions/send-push-notification/index.ts`** — GET-Handler vor `requireServiceRole` verschieben
2. **`src/components/MessageComposer.tsx`** — Redundanten direkten Push-Aufruf entfernen

