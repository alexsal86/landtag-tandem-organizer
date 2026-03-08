

## Notification-Transparenz: "Warum diese Notification?"

### Was wird gebaut

Ein kleiner "Warum?"-Link unter Benachrichtigungen, die von einer Automation-Regel ausgelöst wurden. Der Link führt direkt zur entsprechenden Regel und zum Run-Log im Admin-Bereich.

### Erkennung

Notifications, die von Automations stammen, haben bereits `data.source === "automation_rule"` mit `data.rule_id` und `data.run_id` im JSON (siehe `run-automation-rule/index.ts` Zeile 245-249). Es sind **keine DB-Änderungen** nötig.

### Änderungen

**1. `src/components/NotificationCenter.tsx` — NotificationItem erweitern**

Unter dem Zeitstempel einen dezenten Link anzeigen, wenn `notification.data?.source === 'automation_rule'`:

```tsx
{notification.data?.source === 'automation_rule' && notification.data?.rule_id && (
  <button
    className="text-xs text-muted-foreground underline hover:text-primary"
    onClick={(e) => {
      e.stopPropagation();
      navigate(`/admin?tab=automation&highlight=${notification.data.run_id || notification.data.rule_id}`);
      onClose?.();
    }}
  >
    Warum diese Benachrichtigung?
  </button>
)}
```

**2. `src/pages/NotificationsPage.tsx`** — Gleiche Logik für die Vollansicht der Notifications.

**3. `src/utils/notificationDeepLinks.ts`** — Keine Änderung nötig (der bestehende `automation_run_failed`-Case deckt bereits Admin-Deep-Links ab; der neue "Warum?"-Link nutzt direkte Navigation statt `buildDeepLinkPath`).

### Umfang

- ~20 Zeilen Code in 2 Dateien
- Keine DB-Migration
- Keine neuen Abhängigkeiten

