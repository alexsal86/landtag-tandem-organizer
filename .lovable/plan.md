## Umsetzung Paket 5 (Sicherheit & DSGVO) + Paket 6 (Performance/Egress)

Beide Pakete laufen rein deterministisch (keine KI), nutzen vorhandene Infrastruktur (Workflow-Engine, Audit-Log, Cron, Edge Functions, Admin-Bereich) und greifen tief ins Backend.

---

### Paket 5 — Sicherheit, DSGVO & Resilienz

#### 5.1 RLS-Re-Audit (Datenbank)
- View `v_rls_coverage`: listet alle Tabellen in `public` mit Status (RLS an/aus, Anzahl Policies, `tenant_id`-Spalte vorhanden).
- RPC `audit_rls_gaps()`: liefert kritische Lücken (Tabelle hat `tenant_id` aber keine Policy darauf).
- Tägliches Cron `rls-coverage-snapshot` schreibt Resultate nach `security_audit_snapshots`.

#### 5.2 Security-Cockpit (Admin-UI)
Neuer Eintrag **Administration → Sicherheit**.
- Tab **RLS-Coverage**: Tabelle aller Public-Tabellen, Filter „nur Probleme", Severity-Badges.
- Tab **Linter-Findings**: Live-Abruf via `supabase--linter` über Edge Function `security-linter-snapshot`.
- Tab **Audit-Trail**: Filterbare Liste aus bestehender `audit_log`-Tabelle (User, Aktion, Tabelle, Zeitfenster).
- Tab **Aktive Sessions**: Liste aktiver Sessions je User mit Force-Logout.

#### 5.3 DSGVO-Werkzeuge
- Tabelle `gdpr_requests` (`subject_email`, `subject_contact_id`, `type` enum: `export|delete`, `status`, `requested_by`, `tenant_id`).
- Edge Function `gdpr-export`: sammelt für Person alle `contacts`, `case_items`, `case_item_interactions`, `letters`, `appointments`, `call_logs`, `contact_briefing_memory`, `notifications`. Schreibt ZIP (JSON + PDFs der Briefe) in `documents/{tenant}/gdpr-exports/{request_id}.zip` und liefert Signed URL.
- Edge Function `gdpr-delete`: kaskadierende Anonymisierung (Name → „Gelöscht", E-Mail/Telefon `NULL`, freie Texte → `[entfernt nach DSGVO]`); Vorgänge bleiben strukturell erhalten, Bezug auf Person wird gekappt; Audit-Eintrag pflicht.
- Vier-Augen-Prinzip: Lösch-Request muss von zweitem Admin via Workflow-Engine 2.0 freigegeben werden.
- UI **Administration → Datenschutz**: Request-Liste, „Neue Anfrage", Download-Link nach Export, Genehmigungs-Workflow.

#### 5.4 Resilienz
- `disaster-recovery.md` im Repo (`docs/`) mit Restore-Runbook (Backup-Quellen, Reihenfolge, Smoke-Tests).
- Edge Function `selftest-backup-pointer` prüft täglich, dass mindestens 1 Backup < 24 h existiert (über Supabase Management API), schreibt Status nach `system_health`.

#### 5.5 Akzeptanzkriterien Paket 5
- RLS-Coverage-View funktioniert, alle aktuellen Critical-Findings sind sichtbar.
- DSGVO-Export für Test-Kontakt liefert ZIP < 30 s.
- DSGVO-Lösch-Workflow erzeugt Audit-Einträge und Vier-Augen-Freigabe.
- Security-Cockpit zeigt Linter-Findings + Audit-Trail.

---

### Paket 6 — Performance- & Egress-Cockpit

#### 6.1 Metriken-Sammler
- Tabelle `egress_metrics` (`tenant_id`, `metric_date`, `table_name`, `bytes_egress`, `row_reads`, `realtime_subscribers`, `top_queries jsonb`).
- Tabelle `query_perf_snapshots` (`captured_at`, `tenant_id`, `query_fingerprint`, `mean_exec_ms`, `calls`, `total_rows`).
- Edge Function `collect-egress-metrics` (täglich 03:15 UTC):
  - liest `pg_stat_statements` (Top-50 Queries je Tenant via `tenant_id` aus `current_setting`-Kontext bzw. Tabellen-Heuristik),
  - liest `pg_stat_user_tables` (`seq_tup_read + idx_tup_fetch` als Proxy für Row-Reads),
  - schätzt Bytes-Egress aus Avg-Row-Size × Reads.
- Cron via `pg_cron`.

#### 6.2 Anomalie-Erkennung (deterministisch)
- Edge Function `check-egress-anomaly` (täglich 04:00 UTC):
  - berechnet 7-Tage-Median je `(tenant_id, table_name)`,
  - flaggt Werte > 1,3 × Median **und** absoluter Schwellwert,
  - schreibt Befund nach `egress_anomalies` und triggert `create_notification` an Tenant-Admins.

#### 6.3 Performance-Cockpit (Admin-UI)
Neuer Eintrag **Administration → Performance**.
- **Übersicht** (Karten): Egress letzte 24 h, Egress letzte 7 Tage, aktive Realtime-Channels, langsamste 5 Queries.
- **Tenants-Tab**: Tabelle mit Tenant, Egress 7 d, Trend-Sparkline, Status (OK / Warnung / Anomalie).
- **Tabellen-Tab**: Top-Tabellen nach Bytes, Liniendiagramm 30 Tage.
- **Queries-Tab**: Top-Queries nach `total_rows`, Vorschlag „Index prüfen" wenn `seq_scan` dominiert.
- **Anomalien-Tab**: Liste offener Anomalien, Aktion „Bestätigt/Ignoriert".

#### 6.4 Tenant-Hinweise
- Auf Tenant-Detailseite (Superadmin) Block „Performance-Status" mit aktuellem Wert vs. Median und ggf. Hinweistext.
- Optionaler Push/Notification an `bueroleitung` des Tenants bei Warnung.

#### 6.5 Akzeptanzkriterien Paket 6
- Sammler läuft täglich, `egress_metrics` füllt sich.
- Cockpit lädt < 1 s, zeigt Diagramme über 30 Tage sobald Daten existieren.
- Anomalien werden nach Schwellwert-Überschreitung sichtbar erzeugt.
- Keine Service-Role-Keys oder Roh-SQL im Frontend.

---

### Reihenfolge

1. **Paket 5.1 + 5.2** (RLS-Audit + Cockpit) — sofortiger Mehrwert, keine Drittabhängigkeit.
2. **Paket 5.3** (DSGVO-Tools) — nutzt Workflow-Engine 2.0 für Freigaben.
3. **Paket 5.4** (Resilienz-Doku & Backup-Selftest).
4. **Paket 6.1–6.2** (Sammler + Anomalie).
5. **Paket 6.3–6.4** (Cockpit + Tenant-Hinweise).

### Technische Notizen
- Alle neuen Tabellen mit `tenant_id` + RLS, Zugriff nur für Rollen `superadmin`/`bueroleitung` (5.x) bzw. `superadmin` (6.x globale Sicht).
- Nutzt bestehende Patterns: `is_tenant_member`, `has_role`, `create_notification`, Workflow-Engine 2.0.
- Keine externen Dienste, keine KI-Abhängigkeit.
- ZIP-Erzeugung in Edge Function via `jszip` (NPM-kompatibel via `npm:` import).