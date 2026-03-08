

## Plan: Plattform-Qualität verbessern (3 Maßnahmen + App.tsx Refactoring)

---

### 1. App.tsx aufteilen (Architektur & Modularität)

**Problem:** `App.tsx` enthält aktuell Routing (~30 Routes), Provider-Stack (6 Provider), globale Dialoge, QueryClient-Konfiguration und Keyboard-Shortcuts in einer Datei.

**Neue Dateistruktur:**

```text
src/
  App.tsx                          ← nur noch: <AppProviders><AppRouter /></AppProviders>
  providers/
    AppProviders.tsx                ← QueryClient + Auth + Tenant + AppSettings + Notification + Tooltip
  router/
    AppRouter.tsx                   ← BrowserRouter + MatrixUnreadProvider + Routes + globale Overlays
    routes.tsx                      ← alle <Route> Definitionen + lazy imports
  components/layout/
    GlobalOverlays.tsx              ← GlobalSearchCommand + GlobalQuickNoteDialog + GlobalDaySlipPanel + Keyboard-Shortcut
```

**Ergebnis `App.tsx`** (ca. 10 Zeilen):
```tsx
const App = () => (
  <AppProviders>
    <AppRouter />
  </AppProviders>
);
```

**`AppProviders.tsx`**: QueryClientProvider, AuthProvider, TenantProvider, AppSettingsProvider, NotificationProvider, TooltipProvider. QueryClient-Instanz wird hier erstellt.

**`AppRouter.tsx`**: BrowserRouter, MatrixUnreadProvider, Toaster/Sonner, GlobalOverlays, Suspense + Routes.

**`routes.tsx`**: Alle lazy imports und `<Route>`-Definitionen als exportiertes Array oder JSX-Fragment.

---

### 2. TypeScript strenger konfigurieren (Codequalität)

**Schritt 1 – Sofort umsetzbar** (kein Breaking Change):
- `tsconfig.app.json`: `strictNullChecks: true` aktivieren
- Erwartbar ~50-100 Compile-Fehler, die mit `?.` und `?? ''` Null-Guards fixiert werden

**Schritt 2 – `catch (error: any)` systematisch ersetzen** (720 Vorkommen in 57 Dateien):
- Der zentrale `handleAppError()` + `getErrorMessage()` existiert bereits in `src/utils/errorHandler.ts`
- Batch-weise die verbleibenden 57 Dateien auf `catch (error: unknown)` + `handleAppError()` umstellen
- Priorisierung nach Dateigröße/Nutzung: Hooks zuerst, dann Komponenten

**Schritt 3 – `as any` auf Supabase-Daten** (1335 Vorkommen in 110 Dateien):
- Weiterführung der bereits begonnenen Arbeit
- Fokus auf `(planning as any).is_completed`, `(profile as any)?.badge_color` etc. – hier fehlen Felder in den lokalen Interfaces, nicht in der DB

**Was wir NICHT ändern:** `strict: true` komplett aktivieren wäre zu disruptiv (tausende Fehler). `strictNullChecks` allein bringt den größten Sicherheitsgewinn.

---

### 3. Testabdeckung erhöhen (aktuell: 5 Testdateien)

**Ist-Zustand:** Tests existieren nur für `speechToTextAdapter`, `speechCommandUtils`, `errorHandler`, `letter/types`. Kein einziger Hook oder Supabase-Query ist getestet.

**Strategie: Unit-Tests für die 10 kritischsten Hooks:**

| Priorität | Datei | Was testen |
|-----------|-------|------------|
| 1 | `useAuth.tsx` | Login/Logout-Flow, Session-Handling |
| 2 | `useTasksData.ts` (bzw. useTaskOperations) | CRUD-Operationen, Optimistic Updates |
| 3 | `useMeetingsData.ts` | Daten-Laden, Filtering |
| 4 | `useDocumentsData.ts` | Upload, Delete |
| 5 | `useTenant.tsx` | Tenant-Switching, Fallback |
| 6 | `useNotifications.tsx` | Mark-as-read, Realtime |
| 7 | `useContactDocuments.tsx` | Verknüpfungen |
| 8 | `useTimeTrackingOperations.ts` | Start/Stop Timer |
| 9 | `useEmployeeOperations.ts` | Status-Updates |
| 10 | `useCaseFileDetails.tsx` | Case-File CRUD |

**Test-Pattern:** Supabase-Client mocken mit `vi.mock('@/integrations/supabase/client')`, keine echte DB. Jeder Hook-Test prüft: Success-Case, Error-Case, Loading-State.

**Dateistruktur:**
```text
src/hooks/__tests__/useAuth.test.ts
src/hooks/__tests__/useTenant.test.ts
src/components/tasks/hooks/__tests__/useTaskOperations.test.ts
...
```

---

### 4. README modernisieren

**Aktuell:** Generisches Lovable-Template mit 0 projektspezifischem Inhalt.

**Neue README-Struktur:**

1. **Projektname & Beschreibung** – Was ist die Plattform, wer nutzt sie
2. **Architektur-Übersicht** – ASCII-Diagramm der Schichten (Frontend → Supabase → Edge Functions)
3. **Lokales Setup** – Schritt-für-Schritt mit Env-Variablen, Supabase-Projekt verlinken
4. **Ordnerstruktur** – Erklärung von `src/features/`, `src/hooks/`, `src/components/`, `src/services/`
5. **Wichtige Patterns** – `lazyWithRetry`, `debugConsole`, `handleAppError`, Tenant-System
6. **Edge Functions** – Liste mit Zweck und verify_jwt Status
7. **Testing** – Wie Tests ausführen, wo neue Tests hingehören
8. **Deployment** – Via Lovable oder manuell
9. **Rollen & Rechte** – Verweis auf `docs/rollenrechte-matrix.md`

---

### Umsetzungsreihenfolge

1. **App.tsx aufteilen** (sofort, keine funktionale Änderung)
2. **README modernisieren** (sofort, keine Code-Änderung)
3. **TypeScript strictNullChecks** (erfordert Fixes, aber hoher Impact)
4. **Testabdeckung** (fortlaufend, Batch-weise)

