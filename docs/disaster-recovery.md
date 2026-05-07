# Disaster Recovery & Backup Runbook

> Stand: Mai 2026 — gilt für Supabase-Projekt `wawofclbehbkebjivdte`.

## 1. Backup-Quellen

| Quelle | Häufigkeit | Aufbewahrung | Verantwortlich |
|---|---|---|---|
| Supabase Auto-Backups (PITR) | täglich | 7 Tage (Pro Plan) | Supabase |
| Supabase Daily Snapshots | täglich | 7 Tage | Supabase |
| Storage Bucket `documents` | (kein Auto-Backup) | n/a | manuell |

Status der letzten Auto-Backups wird durch die Edge Function `selftest-backup-pointer` täglich um 04:30 UTC geprüft und in `system_health` (check_name=`backup_pointer`) abgelegt.

## 2. Restore-Reihenfolge

1. **Supabase Dashboard** → Project → Backups → gewünschten Snapshot wählen.
2. „Restore" auslösen — erzeugt einen neuen DB-Stand, Connection-String bleibt identisch.
3. **Migrationen**: nach Restore prüfen, ob alle `supabase/migrations/*.sql` angewendet sind (`select * from supabase_migrations.schema_migrations`). Fehlende Migrationen via Lovable-Pipeline nachziehen.
4. **Edge Functions**: per Lovable-Build automatisch redeployt (kein manueller Schritt).
5. **Cron Jobs** (`pg_cron`): kontrollieren mit `select * from cron.job;`. Bei Verlust aus den letzten Migrationen wiederherstellen.
6. **Storage `documents`-Bucket**: aus letztem manuellen Export wiederherstellen (siehe §4).

## 3. Smoke-Tests (Pflicht nach jedem Restore)

| Test | Erwartetes Ergebnis |
|---|---|
| Login eines Test-Tenants | erfolgreich |
| `select count(*) from contacts` | > 0, plausibel |
| Eine Termin-Detailseite öffnen | rendert ohne Fehler |
| Workflow-Engine 2.0: Test-Run starten | grün |
| Performance-Dashboard zeigt aktuelle Metriken | ja |
| `audit_log_entries` letzte 24h | hat Einträge |

## 4. Bucket `documents` — manuelles Backup

Empfohlen alle 7 Tage:

```bash
# CLI mit service_role
supabase storage download --bucket documents --recursive ./backup-$(date -u +%F)
tar czf backup-documents-$(date -u +%F).tgz ./backup-*
```

Aufbewahrung extern (z.B. S3 / Hetzner Storage Box) für mindestens 30 Tage.

## 5. RPO / RTO Ziele

- **RPO**: ≤ 24 h (Tages-Backup).
- **RTO**: ≤ 30 min für DB-Restore + 15 min Smoke-Tests.

## 6. Notfallkontakte

- Supabase Support: support@supabase.io
- Lovable Support: support@lovable.dev

## 7. Selftest

Edge Function `selftest-backup-pointer` ruft täglich die Supabase Management API ab und prüft:
- ist mindestens ein Backup ≤ 24 h vorhanden?
- ist es als „completed" markiert?

Status wird in `public.system_health` geschrieben (`check_name='backup_pointer'`). Bei `status='critical'` erzeugt der Selbsttest eine Notification an alle Superadmins.
