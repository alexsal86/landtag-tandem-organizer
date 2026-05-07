## Backup-Selbsttest aktivieren

Damit `selftest-backup-pointer` täglich echte Backup-Daten aus der Supabase Management API liest (statt Fallback), wird ein Personal Access Token als Edge-Function-Secret hinterlegt.

### Schritte

1. **Secret anlegen**: `SUPABASE_MGMT_TOKEN` über das Lovable-Secret-UI hinzufügen.
2. **Token besorgen** (du): https://supabase.com/dashboard/account/tokens → „Generate new token" → Name z.B. `lovable-backup-selftest` → kopieren und in den Lovable-Dialog einfügen.
3. **Verifikation**: Edge Function `selftest-backup-pointer` einmal manuell triggern; Eintrag in `system_health` muss `details.source = "mgmt_api"` und `age_hours` enthalten.

### Sicherheit

- Token wird ausschließlich in Edge Functions via `Deno.env.get("SUPABASE_MGMT_TOKEN")` gelesen.
- Niemals im Client-Code, niemals in DB-Tabellen.
- Bei Verdacht auf Leak: Token im Supabase-Dashboard widerrufen und neu anlegen.

Keine weiteren Code-Änderungen erforderlich — die Funktion erkennt das Vorhandensein des Tokens automatisch.