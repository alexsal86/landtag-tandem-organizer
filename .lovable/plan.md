# Code-Quality-Audit & Refactoring-Plan

## Befunde (objektiv gemessen)

| Metrik | Wert | Bewertung |
|---|---|---|
| TS/TSX-Dateien | 1.215 | groß, ok |
| Zeilen Code (ohne types.ts) | ~253k | groß |
| Dateien > 800 Zeilen | **32** | zu viele Mega-Komponenten |
| `as any` Vorkommen | **24** in 19 Dateien | bricht eure Core-Regel |
| `useEffect` gesamt | 711 in 435 Dateien | viel manuelles State-Sync |
| Komponenten mit direktem `supabase.from(...)` | **38** | Datenzugriff in der UI-Schicht |
| Komponenten mit `useEffect`+Supabase-Fetch (Anti-Pattern) | **90** | sollten React-Query nutzen |
| Hardcodierte Tailwind-Farben (`text-white`, `bg-gray-…`) | **1.040** in 220 Dateien | bricht Design-Token-Regel |
| `console.log/debug/warn` in src | 15 in 6 Dateien | ok, wenig |
| Error Boundaries | 11 | dünn für 24 Features |
| Migrationen | **640** | extrem fragmentiert |
| Edge Functions | 71 | viele |

## Konkrete Befunde

### 1. Mega-Komponenten (>800 LOC)
Top-Brocken laut Component-Decomposition-Memory (>1500 splitten, aber auch 800+ ist Risiko):
- `AppNavigation.tsx` 1.469
- `MyWorkCasesWorkspace.tsx` 1.283
- `FocusModeView.tsx` 1.182
- `SuperadminTenantManagement.tsx` 1.149
- `TaskDecisionDetails.tsx` 1.084
- `MatrixClientProvider.tsx` 1.037
- `AutomationRuleWizard.tsx` 1.030
- `AppointmentDetailsSidebar.tsx` 1.000
- `DIN5008LetterLayout.tsx` 983
- … insgesamt 32 Dateien >800 Zeilen

### 2. Verstöße gegen Core-Regeln
- **`as any` in 19 Dateien** — direkt gegen TypeScript-Core-Regel
- **1.040 hardcodierte Farb-Klassen** — gegen Design-Token-Regel
- Beispiele: `text-white`, `bg-gray-100`, `border-blue-500` statt `text-foreground`, `bg-muted`, `border-primary`

### 3. Datenfluss-Architektur
- **38 Komponenten** rufen direkt `supabase.from(...)` auf statt über Hook/Service
- **90 Dateien** verwenden `useEffect` + manuellen Fetch statt React-Query (`useQuery` nur in 62 Dateien — viel weniger als nötig)
- Konsequenzen: doppelte Requests, kein Caching, kein Stale-Time-Schutz (widerspricht eurer Egress-Optimierungsstrategie)

### 4. Migrations-Wildwuchs
640 Migrationen für 1 Projekt. Schwer zu auditieren. Kein Konsolidierungs-Schnitt.

### 5. Doppelte Komponenten
- `StructuredHeaderEditor.tsx` 2× (unterschiedliche Pfade)
- `DecisionDialogs.tsx`, `DecisionCardActivity.tsx`, `UnicornAnimation.tsx` jeweils 2×

### 6. Bundle / Dependencies
125 Runtime-Dependencies — vermutlich Dead Weight. Nicht geprüft, aber lohnt einen `depcheck`.

### 7. Resilienz
Nur **11 Error Boundaries** für 24 Features. Kritische Routen (Briefe, Vorgänge, Kalender) sollten je eigene Boundary haben.

---

## Vorgeschlagenes Refactoring (priorisiert)

### Phase A — Quick Wins (geringe Risiken, großer Aufwand-Ertrag)
1. **`as any` eliminieren** (19 Dateien): durch konkrete Types oder `@ts-expect-error` mit Begründung ersetzen.
2. **Tailwind-Farb-Audit-Skript**: `scripts/audit-color-tokens.mjs`, das hardcodierte Farben listet und bei CI als Warning ausgibt. Dann die ~50 schlimmsten Dateien manuell auf semantische Tokens umstellen.
3. **Doppelte Dateien zusammenführen** (4 Files).
4. **`depcheck` laufen lassen**, ungenutzte Dependencies entfernen.
5. **3 zusätzliche Error Boundaries** an den lazy-geladenen Routen-Containern (Briefe, Vorgänge, Redaktion).

### Phase B — Datenzugriff zentralisieren
1. **`supabase.from()` aus 38 Komponenten herausziehen** in dedizierte Hooks unter `src/hooks/queries/`.
2. **90 Komponenten mit `useEffect`+Fetch** schrittweise auf `useQuery` migrieren — beginnen mit hochfrequenten (Dashboard, MyWork, Sidebar-Panels).
3. Konvention dokumentieren: Komponenten dürfen Supabase nur über Hook benutzen. Lint-Regel via custom ESLint-Rule oder `no-restricted-imports`.

### Phase C — Mega-Komponenten zerlegen
Die 6 größten Dateien (>1.000 LOC) in Sub-Module nach euer bestehender Komposition-Konvention (types/constants/use*Interactions/sub-components):
1. `AppNavigation.tsx` → in Sidebar-Sektionen aufteilen
2. `MyWorkCasesWorkspace.tsx` → Workspace-Skelett + Tab-Module
3. `FocusModeView.tsx`
4. `SuperadminTenantManagement.tsx`
5. `TaskDecisionDetails.tsx`
6. `AutomationRuleWizard.tsx`

### Phase D — Migrations-Konsolidierung
- Snapshot-Migration erzeugen (`pg_dump` des aktuellen Schemas), neue Baseline einchecken, alte 640 Migrationen archivieren in `supabase/migrations/_archive/`.
- Ab da nur noch additive Migrationen.
- Vorsicht: nur durchführen, wenn keine Branch-/Forks-Workflow blockiert ist.

### Phase E — Performance-Sweep
- Bundle-Size-Report (vorhandenes `report-bundle-size.mjs`) gegen Budget durchsetzen — fail bei Überschreitung.
- React-Profiler an den Mega-Routen, `React.memo`/Selektoren für Listen-Items.
- `useEffect`-Audit: jeden Effect ohne klares Cleanup oder mit Dependency-Lücke flaggen (custom Skript).

---

## Was ich konkret als nächstes umsetzen würde

Falls du grünes Licht gibst, schlage ich vor mit **Phase A komplett + Phase B Migration der 10 hochfrequentesten Komponenten** zu starten. Das ist:
- 19 `as any`-Stellen sauber typisieren
- 4 Duplikate zusammenführen
- 50 Dateien auf Design-Tokens umstellen (semi-automatisches Skript + manuelle Kontrolle)
- 3 Error-Boundaries ergänzen
- 10 Komponenten von `useEffect`-Fetch auf React-Query
- depcheck-Bericht als Datei

Größere Refactorings (Mega-Komponenten zerlegen, Migrations-Konsolidierung) sind eigene Loops — das wären jeweils 2–4 Stunden Arbeit pro Komponente und sollten einzeln freigegeben werden.

## Außerhalb des Scopes
- Funktionale Änderungen (kein neues Feature)
- Visuelle Re-Designs
- Auth-/RLS-Änderungen
- Edge-Function-Konsolidierung (separate Initiative)

## Risiken
- **Tailwind-Token-Migration** kann subtile visuelle Diffs erzeugen — pro Datei prüfen.
- **React-Query-Migration** kann doppeltes Fetching verursachen, wenn alter `useEffect` parallel weiterläuft — atomar pro Komponente.
- **Migrations-Snapshot** ist destruktiv im Sinne der History — nur mit explizitem Go.
