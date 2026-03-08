

## Problem

Die RPC-Funktion `get_my_work_new_counts` zählt für den Team-Tab **alle** ungelesen Benachrichtigungen (`notifications`), unabhängig vom `navigation_context`. Zeile 148:

```sql
SELECT count(*) FROM notifications n 
WHERE n.user_id = p_user_id 
  AND n.is_read = false 
  AND n.created_at > v_team_last_visit
```

Das bedeutet: Jede neue Benachrichtigung (Aufgaben, Entscheidungen, etc.) die nach dem letzten Besuch des Team-Tabs erstellt wurde, erhöht den Team-Badge — auch wenn sie nichts mit Team zu tun hat.

## Lösung

Die SQL-Query muss auf `navigation_context = 'mywork_team'` filtern, damit nur Team-relevante Benachrichtigungen gezählt werden:

```sql
SELECT count(*) FROM notifications n 
WHERE n.user_id = p_user_id 
  AND n.is_read = false 
  AND n.navigation_context = 'mywork_team'
  AND n.created_at > v_team_last_visit
```

### Änderung

**RPC `get_my_work_new_counts`** (Supabase-Migration): Zeile 148 um `AND n.navigation_context = 'mywork_team'` ergänzen. Die Bedingung `n.created_at > v_team_last_visit` kann dabei entfallen, da `is_read = false` bereits ausreicht und konsistenter ist — aber optional beibehalten werden kann als zusätzlicher Filter.

