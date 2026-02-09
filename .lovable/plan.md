
# Plan: Highlight-Farbe auf Magenta aendern + Web-Push automatisch senden

## 1. Highlight-Farbe auf Magenta (#e60073) aendern

**Problem:** Die Highlight-Animation fuer Deep-Links nutzt `hsl(var(--primary))`, was Gruen (#57ab27) ist.

**Loesung:** In `src/index.css` die `notification-highlight`-Animation auf `hsl(var(--secondary))` umstellen. Die `--secondary`-Variable ist bereits als Magenta definiert (`330 100% 45%` = #E6007E, sehr nah an #e60073).

```text
Zeile 766-768 aendern:
  0% { box-shadow: 0 0 0 0 hsl(var(--secondary) / 0.4); }
  50% { box-shadow: 0 0 0 4px hsl(var(--secondary) / 0.2); }
  100% { box-shadow: 0 0 0 0 hsl(var(--secondary) / 0); }
```

**Datei:** `src/index.css` (3 Zeilen)

---

## 2. Web-Push-Benachrichtigungen automatisch senden

**Problem:** Das gesamte Web-Push-System ist bereits implementiert (Service Worker, VAPID-Keys, Edge Function `send-push-notification`, Subscription-Verwaltung). Aber es wird nur manuell ueber Test-Buttons ausgeloest. Es fehlt ein automatischer Trigger, der bei jeder neuen Benachrichtigung in der Datenbank auch einen Browser-Push sendet.

**Loesung:** Einen PostgreSQL-Trigger auf der `notifications`-Tabelle erstellen, der ueber `pg_net` die Edge Function `send-push-notification` aufruft. So erhaelt der Benutzer automatisch eine Browser-Benachrichtigung, wenn eine neue Notification in der Datenbank angelegt wird.

### DB-Migration

```sql
-- Sicherstellen dass pg_net aktiviert ist
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger-Funktion: Ruft die Edge Function auf
CREATE OR REPLACE FUNCTION notify_push_on_insert()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets 
            WHERE name = 'supabase_url') || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret 
        FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'priority', COALESCE(NEW.priority, 'medium'),
      'data', COALESCE(NEW.data, '{}'::jsonb),
      'from_trigger', true
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger bei jedem INSERT
CREATE TRIGGER trigger_push_on_notification
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_on_insert();
```

Das `from_trigger: true`-Flag ist wichtig, weil die Edge Function bei `from_trigger` KEINE neue Notification in die DB schreibt (sonst gaebe es eine Endlosschleife).

### Vault-Secrets pruefen

Die Trigger-Funktion braucht die Supabase-URL und den Service-Role-Key aus dem Vault. Falls diese nicht vorhanden sind, wird eine alternative Variante mit hartcodierten Werten verwendet (oder die Secrets muessen im Vault angelegt werden).

**Alternative ohne Vault:** Die URL und den Key direkt in der Funktion verwenden (weniger sicher, aber funktioniert sofort):

```sql
CREATE OR REPLACE FUNCTION notify_push_on_insert()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://wawofclbehbkebjivdte.supabase.co/functions/v1/send-push-notification',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <service_role_key>"}'::jsonb,
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'priority', COALESCE(NEW.priority, 'medium'),
      'data', COALESCE(NEW.data, '{}'::jsonb),
      'from_trigger', true
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Automatische Push-Registrierung

Aktuell muss der Benutzer in den Einstellungen manuell "Push aktivieren" klicken. Fuer ein besseres Erlebnis kann optional ein automatischer Prompt beim Login hinzugefuegt werden - das ist aber ein separater Schritt.

---

## Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/index.css` | Highlight-Animation von `--primary` auf `--secondary` (Magenta) umstellen |
| **Neue DB-Migration** | Trigger-Funktion + Trigger auf `notifications`-Tabelle fuer automatische Web-Push-Benachrichtigungen |

## Reihenfolge

1. CSS-Farbe aendern (sofort sichtbar)
2. DB-Migration fuer Push-Trigger (erfordert Vault-Secrets oder direkte URL)
