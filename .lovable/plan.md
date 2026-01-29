
# Plan: 3 kritische Fehler in Zeiterfassung beheben

## Zusammenfassung der Probleme

| # | Problem | Ursache | Lösung |
|---|---------|---------|--------|
| 1 | Brutto = Netto (Pause nicht abgezogen) | UPDATE-Statement nicht ausgeführt oder Migration fehlgeschlagen | Einmaliges UPDATE für alle bestehenden Einträge |
| 2 | Krankmeldungen/Arzttermine/Überstundenabbau werden nicht eingetragen | Trigger `notify_on_leave_request` verwendet `NEW.tenant_id`, aber `leave_requests` hat diese Spalte nicht | Trigger korrigieren: `tenant_id` über User-Tenant-Mapping ermitteln |
| 3 | Krankmeldungen werden nicht beim Admin angezeigt | Gleiche Ursache wie #2 - der Trigger schlägt fehl, der INSERT wird rollbacked | Mit #2 behoben |

---

## Technische Analyse

### Problem 1: Brutto = Netto in der Datenbank

Die Datenbankabfrage zeigt:
- **139 von 139 Einträgen** haben `minutes = brutto` (Pause nicht abgezogen)
- Nur **16 Einträge** wären bei korrekter Berechnung als Netto korrekt

**Beispiel aus der DB:**
```
work_date: 2026-01-28
started_at: 08:15
ended_at: 17:08
pause_minutes: 60
minutes: 533      ← FALSCH (das ist brutto!)
calculated_net: 473  ← DAS sollte in minutes stehen
```

### Problem 2 & 3: Trigger-Fehler mit tenant_id

Der aktuelle Trigger versucht:
```sql
INSERT INTO notifications (..., tenant_id) VALUES (..., NEW.tenant_id)
```

Aber `leave_requests` hat KEINE `tenant_id`-Spalte! Die Spalten sind:
- id, user_id, type, start_date, end_date, status, reason, created_at, updated_at, medical_reason, start_time, end_time, minutes_counted

**Fehlermeldung in den Logs:**
```
ERROR: record "new" has no field "tenant_id"
```

---

## Lösung

### SQL-Migration

```sql
-- 1. KORREKTUR: notify_on_leave_request - tenant_id über user_tenant_memberships ermitteln
CREATE OR REPLACE FUNCTION notify_on_leave_request()
RETURNS TRIGGER AS $$
DECLARE
  admin_user_record RECORD;
  notification_type_id UUID;
  requester_name TEXT;
  leave_type_label TEXT;
  user_tenant UUID;
BEGIN
  IF NEW.status = 'pending' THEN
    -- Ermittle tenant_id des Users über user_tenant_memberships
    SELECT tenant_id INTO user_tenant
    FROM user_tenant_memberships 
    WHERE user_id = NEW.user_id 
    LIMIT 1;
    
    SELECT display_name INTO requester_name
    FROM profiles WHERE user_id = NEW.user_id LIMIT 1;
    
    IF NEW.type = 'vacation' THEN
      SELECT id INTO notification_type_id FROM notification_types 
      WHERE name = 'vacation_request_pending' LIMIT 1;
      leave_type_label := 'Urlaubsantrag';
    ELSIF NEW.type = 'sick' THEN
      SELECT id INTO notification_type_id FROM notification_types 
      WHERE name = 'sick_leave_request_pending' LIMIT 1;
      leave_type_label := 'Krankmeldung';
    ELSIF NEW.type = 'medical' THEN
      SELECT id INTO notification_type_id FROM notification_types 
      WHERE name = 'vacation_request_pending' LIMIT 1;
      leave_type_label := 'Arzttermin';
    ELSIF NEW.type = 'overtime_reduction' THEN
      SELECT id INTO notification_type_id FROM notification_types 
      WHERE name = 'vacation_request_pending' LIMIT 1;
      leave_type_label := 'Überstundenabbau';
    ELSE
      SELECT id INTO notification_type_id FROM notification_types 
      WHERE name = 'vacation_request_pending' LIMIT 1;
      leave_type_label := 'Antrag';
    END IF;
    
    FOR admin_user_record IN 
      SELECT DISTINCT ur.user_id FROM user_roles ur 
      WHERE ur.role IN ('abgeordneter', 'bueroleitung')
      AND ur.user_id != NEW.user_id
    LOOP
      INSERT INTO notifications (
        user_id, 
        notification_type_id, 
        title, 
        message, 
        navigation_context,
        data,
        tenant_id  -- Jetzt mit ermittelter tenant_id
      ) VALUES (
        admin_user_record.user_id,
        notification_type_id,
        leave_type_label || ' von ' || COALESCE(requester_name, 'Mitarbeiter'),
        COALESCE(requester_name, 'Ein Mitarbeiter') || ' hat einen ' || leave_type_label || ' eingereicht (' || 
          TO_CHAR(NEW.start_date, 'DD.MM.YYYY') || ' bis ' || TO_CHAR(NEW.end_date, 'DD.MM.YYYY') || ')',
        'employee',
        jsonb_build_object(
          'leave_request_id', NEW.id,
          'requester_id', NEW.user_id,
          'leave_type', NEW.type,
          'start_date', NEW.start_date,
          'end_date', NEW.end_date
        ),
        user_tenant  -- ← KORREKTUR: Variable statt NEW.tenant_id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Korrigiere ALLE bestehenden Zeiteinträge (Netto = Brutto - Pause)
UPDATE time_entries
SET minutes = ROUND(EXTRACT(EPOCH FROM (ended_at - started_at))/60) - COALESCE(pause_minutes, 0)
WHERE started_at IS NOT NULL 
  AND ended_at IS NOT NULL;
```

---

## Erwartetes Ergebnis nach der Migration

### Zeiteinträge (Problem 1)
**Vorher:**
| Datum | Start | Ende | Pause | Brutto | Netto |
|-------|-------|------|-------|--------|-------|
| 28.01. | 08:15 | 17:08 | 60 Min | 8:53 | 8:53 ← FALSCH |

**Nachher:**
| Datum | Start | Ende | Pause | Brutto | Netto |
|-------|-------|------|-------|--------|-------|
| 28.01. | 08:15 | 17:08 | 60 Min | 8:53 | 7:53 ← KORREKT |

### Krankmeldungen/Arzttermine (Probleme 2 & 3)
- Neue Einträge werden erfolgreich gespeichert
- Benachrichtigungen werden an Abgeordnete/Büroleitung gesendet
- Anträge erscheinen in der Admin-Übersicht

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| **SQL-Migration** | 1) `notify_on_leave_request` korrigieren: tenant_id über user_tenant_memberships ermitteln, 2) Bestehende time_entries Netto-Werte korrigieren |

---

## Warum ist das bisher fehlgeschlagen?

Die vorherige Migration (20260129152654) enthielt denselben Fehler mit `NEW.tenant_id`. Da PostgreSQL-Migrationen atomar sind, wurde vermutlich:
1. Die Funktion erfolgreich erstellt (aber mit dem Fehler)
2. Das UPDATE möglicherweise ausgeführt - aber die Daten zeigen, dass es nicht funktioniert hat

Die neue Migration korrigiert beide Probleme gleichzeitig.
