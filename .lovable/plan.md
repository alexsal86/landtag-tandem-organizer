

# Plan: Echtzeit-Benachrichtigungen und Push-Fixes

## Problem-Analyse

### 1. Echtzeit-Benachrichtigungen kommen nicht an
Die Realtime-Subscription fuer Alexander wurde um **11:51:58** erstellt, aber die Notification fuer "fhgfhgfhfghgfhgh" wurde bereits um **11:51:25** eingefuegt -- also **33 Sekunden vorher**. Die Subscription war zu diesem Zeitpunkt noch nicht aktiv (vermutlich durch Seitenwechsel oder Reconnect).

**Kernproblem:** Es gibt keinen Polling-Fallback. Benachrichtigungen werden NUR ueber Realtime empfangen. Wenn die Subscription kurz weg ist, gehen Benachrichtigungen verloren -- bis zum naechsten Seiten-Reload.

### 2. Browser-Push funktioniert nicht
Die Tabelle `push_subscriptions` ist LEER fuer Alexander. Ohne registrierte Subscription kann kein Push gesendet werden. Der User muss Push in den Einstellungen erst aktivieren.

### 3. Drei doppelte Push-Triggers
Auf der `notifications`-Tabelle existieren drei AFTER INSERT Trigger:

| Trigger | Funktion | Status |
|---------|----------|--------|
| `notification_push_trigger` | `handle_notification_push()` | Tut NICHTS (Platzhalter mit `NULL`) |
| `push_notification_trigger` | `trigger_push_notification()` | Hardcoded Anon-Key, prueft push_subscriptions |
| `trigger_push_on_notification` | `notify_push_on_insert()` | Nutzt Vault-Secrets, korrekte Implementierung |

Nur der dritte Trigger (`trigger_push_on_notification`) ist korrekt implementiert. Die anderen beiden sollten entfernt werden.

---

## Loesung

### 1. Polling-Fallback in useNotifications.tsx
Ein Intervall von 30 Sekunden wird eingebaut, das `loadNotifications()` aufruft, um verpasste Echtzeit-Events nachzuholen. Zusaetzlich wird `loadNotifications()` direkt nach erfolgreicher Subscription aufgerufen, um die Luecke zwischen Seiten-Load und Subscription-Aufbau zu schliessen.

**Aenderung in `useNotifications.tsx`:**
- Im Realtime-useEffect: Nach `SUBSCRIBED`-Status sofort `loadNotifications()` aufrufen
- Neuen `setInterval` mit 30 Sekunden Polling hinzufuegen
- Interval im Cleanup aufraemen

### 2. Doppelte Triggers bereinigen (DB-Migration)

```sql
DROP TRIGGER IF EXISTS notification_push_trigger ON public.notifications;
DROP TRIGGER IF EXISTS push_notification_trigger ON public.notifications;
DROP FUNCTION IF EXISTS handle_notification_push();
DROP FUNCTION IF EXISTS trigger_push_notification();
```

Nur `trigger_push_on_notification` mit `notify_push_on_insert()` bleibt bestehen -- dieser nutzt Vault-Secrets und ist die korrekte Implementierung.

### 3. Keine Code-Aenderung fuer Push noetig
Push funktioniert technisch korrekt. Alexander muss in den Benachrichtigungseinstellungen Push aktivieren (Browser-Berechtigung erteilen). Der Trigger + Edge Function sind einsatzbereit.

---

## Technische Zusammenfassung

### DB-Aenderung
Entfernung der zwei redundanten Trigger und ihrer Funktionen.

### Dateien

| Datei | Aenderung |
|-------|-----------|
| `useNotifications.tsx` | 30-Sekunden-Polling-Fallback + loadNotifications nach SUBSCRIBED |
| DB-Migration | Doppelte Push-Trigger + Funktionen entfernen |

