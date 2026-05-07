## Aufräum-Roadmap: 7 Baustellen, 4 Phasen

Reihenfolge nach Hebelwirkung × Risiko. Jede Phase liefert messbaren Nutzen und ist unabhängig committable.

---

### Phase 1 — Egress-Sweep (Geld & Tempo, sofortiger Effekt)

**Ziel:** Datentransfer um ≥40 % senken, Performance-Cockpit-Hotlist abarbeiten.

1. **Audit-Hook bauen:** Script (`scripts/audit-queries.ts`) scannt alle `supabase.from(...).select(...)` Aufrufe und meldet:
   - `select('*')` ohne Spaltenliste
   - Fehlende `.limit()` bei Listen-Queries
   - `useQuery` ohne `staleTime`
2. **Top-20 Hotspots fixen:** Cockpit liefert Tabellen-Ranking → explizite Spaltenlisten + `staleTime` (default 30 s, Listen 60 s).
3. **Realtime-Filter schärfen:** Alle `postgres_changes`-Subscriptions bekommen `filter: tenant_id=eq.…` (heute oft fehlend).
4. **ESLint-Regel** (custom) gegen `select('*')` und gegen `useQuery` ohne `staleTime`.

**Erfolgskriterium:** `egress_metrics`-Tagesbytes −40 % nach 7 Tagen.

---

### Phase 2 — Work-Items-Vereinheitlichung (größter Code-Schuldenabbau)

**Ziel:** `tasks`, `decisions`, `cases`, `vorgänge` teilen Hooks/Typen/UI-Bausteine, ohne die Tabellen zu mergen.

1. **Gemeinsame Typen** in `src/types/work-item.ts`: `WorkItemStatus`, `WorkItemAssignment`, `WorkItemPriority`.
2. **Adapter-Schicht** `src/hooks/work-items/`: `useWorkItem(kind, id)`, `useWorkItems(kind, filter)` — kapselt Spalten-Drift (`updated_at` vs. `completed_at` etc.).
3. **Geteilte UI-Bausteine:** `WorkItemStatusBadge`, `WorkItemAssigneePicker`, `WorkItemPriorityChip` ersetzen 4 Varianten.
4. **Migration step-by-step:** zuerst `tasks` + `decisions` (höchste Frequenz), dann `cases` + `vorgänge`. Jede Migration einzeln review-bar.

**Erfolgskriterium:** −30 % LOC in den vier Modulen, identische UX über alle Work-Item-Listen.

---

### Phase 3 — RLS- & Security-Audit-Findings abarbeiten

**Ziel:** 0 Tabellen ohne RLS, 0 Policies ohne `tenant_id`-Check, alle Edge Functions hinter `requireAuth`/`requireRole`.

1. **Security-Cockpit-Snapshot lesen** (täglich vorhanden) → CSV-Export der Findings.
2. **Migrationen in Themenpaketen** (max 5 Tabellen pro Migration): RLS aktivieren, fehlende Policies mit `has_role()` + `tenant_id`-Filter.
3. **Edge-Function-Audit:** Skript prüft, dass jede Function `requireAuth` aufruft; fehlende nachrüsten.
4. **CI-Check:** GitHub Action ruft `audit_rls_gaps()` und schlägt PRs ab, wenn neue Lücken auftauchen.

**Erfolgskriterium:** `v_rls_coverage` zeigt 100 % Coverage; Linter-Warnungen = 0.

---

### Phase 4 — Realtime + Notifications + Komponenten-Hygiene

#### 4a Realtime-Abstraktion
1. `useTenantRealtime(table, { filter, onChange, debounceMs })` — kapselt unique channel name (`crypto.randomUUID()`), tenant-filter, 250 ms debounce, Reconnect.
2. Bestehende ~20 ad-hoc Subscriptions migrieren.

#### 4b Notification Single-Source-of-Truth
1. Ein Hook `useUnreadCounts()` liefert Sidebar **und** MyWork dieselben Zahlen via einer RPC `get_unread_counts(user_id)`.
2. Alte Hooks deprecaten, Pulse-Dots bleiben.

#### 4c Komponenten-Decomposition
1. Kandidaten via `cloc` / `wc -l` listen (>1500 LOC).
2. Top 5 splitten nach Memory-Standard (`types.ts`, `constants.ts`, `useInteractions.ts`, Sub-Components).

#### 4d Editor-Konsolidierung (optional, nach 4a–c)
1. Gemeinsamer Lexical-Provider mit Plug-in-Sets (Letters, Tageszettel, Notion-Block teilen Basis-Plugins).
2. Load-once-on-mount Pattern in einen `useLexicalContent`-Hook auslagern.

**Erfolgskriterium:** keine Duplikat-Channel-Bugs mehr, Badges synchron, kein Component-File >1500 LOC.

---

### Reihenfolge & Aufwand (grob)

| Phase | Aufwand | Liefert |
|-------|---------|---------|
| 1 Egress | 1–2 Sessions | Sofortige Kosten-/Tempo-Wirkung |
| 2 Work-Items | 4–6 Sessions | Massive Code-Reduktion, konsistente UX |
| 3 RLS | 2–3 Sessions | Sicherheit + Compliance |
| 4 Realtime/Notif/Komp | 3–4 Sessions | Stabilität, Wartbarkeit |

### Out of Scope (bewusst)
- Kein Tabellen-Merge der Work-Items (zu riskant, Adapter-Schicht reicht).
- Keine UI-Redesigns (nur strukturelle Refactors).
- Keine neuen Features.

---

**Bitte sag mir, ob ich mit Phase 1 starten soll**, oder ob du eine andere Reihenfolge bevorzugst (z. B. Sicherheit zuerst).