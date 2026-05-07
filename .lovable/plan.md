## Ziel

Drei große Arbeitspakete, die deutlich Credits verbrauchen und langfristig Stabilität, Kosten und mobilen Mehrwert verbessern:

1. **Performance & Egress** – vollständiger Audit + persistentes Monitoring
2. **Test-Coverage** – kritische Pfade tief + Smoke-Tests breit
3. **Mobile-App** – Offline-Notizen/Sprachmemos, Foto-OCR, Termine/Briefings

Reihenfolge: 1 → 2 → 3 (Performance zuerst, damit neue Tests/Mobile auf optimierter Basis laufen).

---

## 1) Performance & Egress – voll inkl. Monitoring

### 1.1 Audit (read-only, dokumentiert in `docs/performance-audit-2026-05.md`)
- Alle `useQuery`-Hooks scannen: fehlende `staleTime`, `select('*')` statt expliziter Spalten, fehlende Realtime-Filter.
- Bundle-Analyse via `scripts/report-bundle-size.mjs`: Top-20 größter Chunks identifizieren.
- Realtime-Channels prüfen: doppelte Subscriptions, fehlende `tenant_id`-Filter, nicht-eindeutige Channelnamen.
- React-Profiler-Pass auf Dashboard, Kalender, Vorgänge, Meine Arbeit.

### 1.2 Quick Fixes (Top-Treffer aus Audit)
- Explizite Spaltenlisten in den 20 teuersten Queries (Vorgänge, Decisions, Tasks, Letters, Briefings, Contacts, Calendar).
- Einheitliche `staleTime` (60–300 s) und `gcTime` für stabile Daten (profiles, tenant_users, categories, statuses).
- Realtime-Subscriptions: scoped Filter (`tenant_id`, `user_id`) + 250 ms Debounce.
- Lazy-Loading: Lexical-Plugins, Letter-Designer, Map-Layer, Knowledge-Dossier, Charts (recharts) erst on-demand.
- Icon-Tree-Shake: `lucide-react` nur Named-Imports, keine Sammel-Re-Exports.
- Memoization: `useCallback`/`useMemo` für teure Callbacks in Dashboard-Widgets.

### 1.3 Monitoring (neu)
- Tabelle `egress_metrics` (tenant_id, day, requests, bytes_in, bytes_out, slow_query_count, source).
- Edge Function `collect-egress-metrics` (täglicher Cron 02:00) liest pg_stat_statements + storage logs aggregiert pro Tenant.
- Admin-Dashboard `/admin/performance`: Diagramm Egress/Tag, Top-Queries, Top-Tabellen, Realtime-Auslastung, Bundle-History.
- Alerting: Edge Function `check-egress-anomaly` (täglich) erstellt eine Notification an Platform-Admins, wenn ein Tenant 2× Median überschreitet.

### 1.4 Definition of Done
- Audit-Report committet, Top-20 Quick Fixes umgesetzt.
- `/admin/performance` zeigt 14-Tage-Egress live.
- Mindestens 30 % Reduktion der durchschnittlichen Response-Größe der Top-5 Queries (gemessen vorher/nachher).

---

## 2) Test-Coverage – kritische Pfade tief + Smoke breit

### 2.1 Kritische Pfade (Vitest + React Testing Library)
- `useAuth`, `tenant`-Switching, `ProtectedRoute`, Rollen-Guards.
- Vorgänge: Anlage, Status-Wechsel, Verlinkung Decision/Task/Letter.
- Decisions: `get_my_work_decisions`, Antworten, Archivierung, Sync zu Meeting-Archiv.
- Tasks: Multi-Assign, Snooze, Subtask-Logik, Jour-Fixe-Verknüpfung.
- Letters: Workflow Draft → Approval → Versand, DOCX/PDF-Export-Helper.
- Briefings: Vortag-Regel, Empfänger-Auflösung, Read-Tracking.
- Time-Tracking: Soll/Ist, Überstunden, Stellvertreter.

### 2.2 Smoke-Tests breit
- `scripts/e2e-smoke-flows.mjs` ausbauen: jede Hauptseite (Dashboard, Meine Arbeit, Kalender, Vorgänge, Kontakte, Wissen, Briefe, Redaktion, Zeit, Wahlkreise, Admin) lädt fehlerfrei für jede Rolle.
- Edge-Function-Smoke: alle deployten Functions auf 200/401-Verhalten.
- Snapshot-Tests für Empty-States (`MyWorkEmptyState`-Varianten).

### 2.3 Quality Gates
- CI-Schwelle: Coverage kritischer Module ≥ 70 % Lines, ≥ 60 % Branches.
- Pre-merge: Smoke-Suite muss grün sein.
- Report `docs/test-coverage-2026-05.md` mit Heatmap pro Feature.

### 2.4 Definition of Done
- ≥ 60 neue Tests, alle 7 kritischen Pfade abgedeckt.
- Smoke-Suite läuft < 3 min und deckt alle Hauptseiten + alle Rollen ab.
- CI-Gate aktiv.

---

## 3) Mobile-App ausbauen (Capacitor, bestehende `apps/mobile`)

Fokus laut deiner Auswahl: Offline-Notizen/Sprachmemos, Foto-OCR, Termine & Briefings.

### 3.1 Offline-Notizen & Sprachmemos
- Lokaler Store (SQLite via Capacitor-SQLite oder WatermelonDB) für `quick_notes` mit `sync_state` (pending/synced/error).
- Sprachaufnahme via `@capacitor/voice-recorder` → m4a-Datei lokal, Upload + Transkription per Edge Function `transcribe-voice-note` (Lovable AI: Gemini 2.5 Flash für Transkription/Zusammenfassung; ElevenLabs Scribe optional, falls bessere Qualität gewünscht).
- Konflikt-Strategie: server-wins mit lokaler Backup-Kopie der überschriebenen Version.
- Sync-Indikator (Sidebar-Footer der Mobile-App): „X ausstehend, zuletzt synchronisiert HH:MM".

### 3.2 Foto-OCR (Visitenkarten / Briefe)
- `@capacitor/camera` Foto → komprimiert (WebP 80 %, max. 1600 px Längsseite).
- Upload nach Storage-Bucket `mobile-captures/${user_id}/...`.
- Edge Function `ocr-extract` ruft Lovable AI (Gemini 2.5 Pro vision) mit Tool-Calling für strukturierte Ausgabe:
  - **Visitenkarte** → Vorschlag `contacts`-Eintrag (Name, Org, Mail, Telefon, Adresse).
  - **Brief/Schreiben** → Vorschlag `case_items` (Betreff, Absender, Datum, Klassifizierung).
- Mobile-Sheet zeigt Vorschau + „Übernehmen / Bearbeiten / Verwerfen".

### 3.3 Termine & Briefings
- Heute-View: nächste 5 Termine, jeweils mit „Check-in", „Briefing öffnen", „Rückmeldung erfassen".
- Briefings: Read-Only Lexical-Renderer + Sprachmemo-Anhang als Rückmeldung.
- Rückmeldung: Kurzformular (Erfolg 1–5, Stichworte, optional Sprachnotiz) → schreibt in bestehendes `appointment_feedback`.
- Push: bestehende `create_notification`-RPC nutzt FCM-Token → 30 min vor Termin Reminder.

### 3.4 Infrastruktur
- Neuer Bucket `mobile-captures` (private, Pfad `${user_id}/...`).
- Neue Tabelle `mobile_capture_drafts` (id, user_id, tenant_id, type, raw_url, parsed_jsonb, status, created_at).
- RLS: nur Owner liest/schreibt eigene Drafts; Admins lesen tenant-weit.
- Edge Functions: `transcribe-voice-note`, `ocr-extract`, `mobile-sync-pull`, `mobile-sync-push`.

### 3.5 Definition of Done
- Mobile-App zeigt Heute-Briefing, kann offline Notizen/Sprachmemos erfassen und syncen.
- Foto-OCR erstellt brauchbare Vorschläge für mind. 80 % der Test-Visitenkarten.
- Push-Reminder für Termine funktioniert in Android-Emulator.

---

## Reihenfolge & Lieferschritte

1. **Performance-Audit + Quick Fixes** (kein DB-Schema)
2. **Egress-Monitoring** (Tabelle + Edge Functions + `/admin/performance`)
3. **Test-Suite kritische Pfade**
4. **Smoke-Suite breit + CI-Gate**
5. **Mobile: Offline-Notizen + Sprachmemos** (Bucket, Tabelle, Edge Functions, UI)
6. **Mobile: Foto-OCR**
7. **Mobile: Termine/Briefings + Push**

Jeder Schritt wird einzeln implementiert und getestet, bevor der nächste beginnt – so behältst du Kontrolle über Credits und kannst nach jedem Schritt stoppen.

---

## Technische Details

- **AI-Provider**: Lovable AI Gateway, Default `google/gemini-3-flash-preview`; Vision/OCR `google/gemini-2.5-pro`. Kein Direkt-Call vom Client, alles via Edge Functions.
- **Mobile-Stack**: bestehender Capacitor-Setup unter `apps/mobile`, Expo Router, Supabase-JS bereits eingerichtet.
- **Storage**: alle Uploads `${user_id}/...` (Memory-Regel).
- **Realtime**: `crypto.randomUUID()`-Channelnamen, Debounce 250 ms.
- **TypeScript**: kein `as any`, JSX-Imports gemäß Memory-Regeln.
- **Sync-Bibliothek Mobile**: vorzugsweise SQLite + eigene Push/Pull-Edge-Functions (kein WatermelonDB-Lock-in).