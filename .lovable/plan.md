
# Plan: 7 Fehler beheben in Zeiterfassung, Notizen und Datenbank

## Zusammenfassung der Probleme

| # | Problem | Ursache | Lösung |
|---|---------|---------|--------|
| 1 | Krankmeldung nicht beim Admin sichtbar | DB-Trigger `notify_on_leave_request` verwendet `'admin'` statt `'abgeordneter'` | Trigger-Funktion korrigieren |
| 2 | Urlaub/Arzttermin/Überstunden prüfen | Gleiche Ursache wie #1 | Mit #1 behoben |
| 3 | `invalid input value for enum app_role: "admin"` | Zeile 35: `WHERE ur.role IN ('admin', 'bueroleitung')` | Ändern zu `'abgeordneter'` |
| 4 | Brutto = Netto (Pause nicht abgezogen) | Trigger existiert, aber bestehende Daten nicht korrigiert | UPDATE-Query ausführen |
| 5 | Text bei Zeiteinträgen wird abgeschnitten | `truncate` Klasse ohne Tooltip/Hover-Anzeige | Tooltip oder expandierbare Anzeige hinzufügen |
| 7 | Notiz-Titel zu lang, kein Umbruch | `truncate` Klasse verwendet, aber zu kurz | `break-words` und `line-clamp-2` verwenden |

---

## 1. Datenbank-Trigger korrigieren (Probleme 1, 2, 3)

**Ursache:** Die Funktion `notify_on_leave_request()` verwendet `'admin'` als Rolle, aber das `app_role` enum enthält nur:
- `abgeordneter`
- `bueroleitung`
- `mitarbeiter`
- `praktikant`

**SQL-Migration:**
```sql
-- Korrigiere die notify_on_leave_request Funktion
CREATE OR REPLACE FUNCTION notify_on_leave_request()
RETURNS TRIGGER AS $$
DECLARE
  admin_user_record RECORD;
  notification_type_id UUID;
  requester_name TEXT;
  leave_type_label TEXT;
BEGIN
  IF NEW.status = 'pending' THEN
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
    
    -- KORREKTUR: 'abgeordneter' statt 'admin'
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
        tenant_id
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
        NEW.tenant_id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

---

## 2. Bestehende Zeiteinträge korrigieren (Problem 4)

**Ursache:** Der Trigger `time_entries_calculate_net` existiert, aber bestehende Daten haben immer noch `minutes = brutto`.

**SQL-Migration:**
```sql
-- Korrigiere alle bestehenden Einträge
UPDATE time_entries
SET minutes = ROUND(EXTRACT(EPOCH FROM (ended_at - started_at))/60) - COALESCE(pause_minutes, 0)
WHERE started_at IS NOT NULL 
  AND ended_at IS NOT NULL
  AND minutes = ROUND(EXTRACT(EPOCH FROM (ended_at - started_at))/60);
```

---

## 3. Notizen-Text bei Zeiteinträgen (Problem 5)

**Aktuell (Zeile 669):**
```typescript
<TableCell className="max-w-[200px] truncate">{entry.notes || "-"}</TableCell>
```

**Lösung:** Tooltip hinzufügen für lange Texte

```typescript
<TableCell className="max-w-[200px]">
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block truncate cursor-help">
          {entry.notes || "-"}
        </span>
      </TooltipTrigger>
      {entry.notes && entry.notes.length > 30 && (
        <TooltipContent className="max-w-md whitespace-pre-wrap">
          {entry.notes}
        </TooltipContent>
      )}
    </Tooltip>
  </TooltipProvider>
</TableCell>
```

**Zusätzlich Import hinzufügen:**
```typescript
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
```

---

## 4. Notiz-Titel Umbruch (Problem 7)

**Aktuell (QuickNotesList.tsx, Zeile 1088-1091):**
```typescript
{note.title && (
  <h4 className="font-semibold text-base truncate mb-1">
    {note.title}
  </h4>
)}
```

**Lösung:** `truncate` durch `break-words` und `line-clamp-2` ersetzen

```typescript
{note.title && (
  <h4 className="font-semibold text-base break-words line-clamp-2 mb-1">
    {note.title}
  </h4>
)}
```

---

## Zusammenfassung der Datei-Änderungen

| Datei | Änderung |
|-------|----------|
| **SQL-Migration** | 1) `notify_on_leave_request` korrigieren (`'admin'` → `'abgeordneter'`), 2) Bestehende time_entries Netto-Werte korrigieren |
| `src/components/TimeTrackingView.tsx` | Tooltip für Notizen-Spalte hinzufügen |
| `src/components/shared/QuickNotesList.tsx` | Titel-Umbruch mit `break-words line-clamp-2` |

---

## Reihenfolge der Implementierung

1. **Kritisch:** DB-Migration für `notify_on_leave_request` (behebt enum-Fehler)
2. **Kritisch:** DB-Migration für Netto-Werte (korrigiert bestehende Daten)
3. **UI:** TimeTrackingView Notizen-Tooltip
4. **UI:** QuickNotesList Titel-Umbruch

---

## Technische Details

### Warum funktioniert Arzttermin/Überstunden nicht?
Der Trigger `notify_on_leave_request` wird bei jedem `INSERT` auf `leave_requests` ausgelöst. Wenn der Antrag eingereicht wird, versucht der Trigger, Administratoren zu benachrichtigen mit:

```sql
WHERE ur.role IN ('admin', 'bueroleitung')
```

Da `'admin'` kein gültiger Wert im `app_role` enum ist, schlägt die gesamte Trigger-Ausführung fehl, was auch den INSERT abbricht - daher die Fehlermeldung beim Einreichen.

### Warum ist Netto = Brutto?
Der Trigger `ensure_net_minutes` berechnet:
```sql
NEW.minutes := ROUND(EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))/60) - COALESCE(NEW.pause_minutes, 0);
```

Der Trigger existiert und funktioniert für NEUE Einträge. Aber alle bestehenden Einträge, die VOR der Trigger-Erstellung eingefügt wurden, haben noch die alten Werte. Ein einmaliges UPDATE ist erforderlich.

