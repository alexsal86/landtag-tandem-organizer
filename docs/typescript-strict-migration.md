# TypeScript Strict Migration Plan (Flow-basiert statt Ordner-basiert)

## Zielbild ab jetzt

Die Strict-Migration wird ab sofort **primär nach fachlichen Kernflows** gesteuert und nicht mehr nach Ordnerzuschnitten. Jeder große fachliche Flow wird als **kleines, reviewbares Migrationspaket** geplant, umgesetzt, getestet und erst dann abgeschlossen, wenn im jeweiligen Scope sowohl

1. `strictNullChecks` als auch
2. `noImplicitAny`

vollständig grün sind.

Erst danach beginnt der nächste große Flow. Ordnerbasierte Batch-Configs bleiben als technische Hilfsmittel erhalten, sind aber **nicht mehr die führende Planungseinheit**.

## Verbindliche Reihenfolge der Kernflows

1. **Auth / Tenant-Wechsel**
2. **Kalender-Sync**
3. **Briefstatus-Workflow**
4. **Benachrichtigungen**
5. **Edge-Auth/Role/Tenant-nahe Frontend-Logik**

Diese Reihenfolge ist fachlich priorisiert und orientiert sich an den Kernflows in `docs/ci-quality-gates.md`.


## Verbindliches Mini-Ziel pro Flow

Für jeden Kernflow wird zu Beginn des Flow-PRs ein Mini-Ziel als Metrik festgelegt:

- **"0 neue `any`, X bestehende `any` entfernt"**

Dabei gilt:

- **0 neue `any`** ist ein harter Gate-Wert (keine Regression).
- **X entfernte `any`** wird pro PR konkret benannt (Startwert/Endwert) und muss im PR nachvollziehbar sein.
- Optional kann je Flow ein Vorher-/Nachher-Lauf über `npm run any-report:flow-…` dokumentiert werden (siehe Tooling-Abschnitt).

## Paket-Regel pro Flow

Für jeden Flow gilt dieselbe Paketstruktur:

- **Hooks / State-Quellen** zuerst migrieren
- danach **Services / Feature-APIs / Domain-Typen**
- danach **Features / Components / Pages**
- danach **flow-spezifische Tests und Coverage** prüfen
- Flow erst als abgeschlossen markieren, wenn der zugehörige Flow-Typecheck für `strictNullChecks` und `noImplicitAny` grün ist

> Leitregel: Kein neuer großer Flow beginnt, bevor der aktuelle Flow als durchgängiges Paket strict-clean ist.

## Flow-Pakete

### 1) Auth / Tenant-Wechsel

**Ziel**
- Session-Wiederherstellung, Tenant-Lookup, Tenant-Persistenz und tenant-sensitive Shell-UI gemeinsam härten.
- Nullability-Grenzen für `user`, `session`, `currentTenant` und Loading-Zustände schließen.

**Hooks**
- `src/hooks/useAuth.tsx`
- `src/hooks/useTenant.tsx`

**Services**
- aktuell keine direkt beteiligten Dateien in `src/services/**`

**Features**
- aktuell keine direkt beteiligten Dateien in `src/features/**`

**Pages**
- `src/pages/Administration.tsx`
- `src/pages/Index.tsx`

**Components**
- `src/components/layout/AppHeader.tsx`
- `src/components/SettingsView.tsx`
- `src/components/account/ActiveSessionsCard.tsx`
- `src/components/administration/SuperadminTenantManagement.tsx`

**Flow-Typecheck**
- `tsconfig.flow-auth-tenant-strict.json`
- `npm run typecheck:flow-auth-tenant`

**Definition of Done**
- kompletter Flow läuft mit `strictNullChecks` und `noImplicitAny`
- Coverage-/Negativpfade aus `docs/ci-quality-gates.md` bleiben sichtbar
- kein Start des nächsten Kernflows vor grünem Paketstatus

### 2) Kalender-Sync

**Ziel**
- Kalenderdaten, manueller Sync-Trigger, Debug-/Admin-Pfade und Settings-Einbettung als zusammenhängender End-to-End-Flow.

**Hooks**
- aktuell keine direkt beteiligten Dateien in `src/hooks/**`

**Services**
- aktuell keine direkt beteiligten Dateien in `src/services/**`

**Features**
- aktuell keine direkt beteiligten Dateien in `src/features/**`

**Pages**
- aktuell keine direkt beteiligten Dateien in `src/pages/**`

**Components**
- `src/components/calendar/hooks/useCalendarData.ts`
- `src/components/ExternalCalendarSettings.tsx`
- `src/components/CalendarSyncDebug.tsx`
- `src/components/SettingsView.tsx`
- `src/components/administration/CalendarSyncSettings.tsx`

**Flow-Typecheck**
- `tsconfig.flow-calendar-sync-strict.json`
- `npm run typecheck:flow-calendar-sync`

**Definition of Done**
- UI-Trigger, Sync-Response und Fehlerdarstellung sind im selben strict-Paket typisiert
- `strictNullChecks` und `noImplicitAny` sind für den kompletten Flow grün

### 3) Briefstatus-Workflow

**Ziel**
- Archivierung, Dokument-Metadaten, Letter-Editor/Wizard und Statusübergänge (`draft` → `sent`) als ein Paket migrieren.

**Hooks**
- `src/hooks/useLetterArchiving.tsx`

**Services**
- aktuell keine direkt beteiligten Dateien in `src/services/**`

**Features**
- `src/features/cases/files/hooks/useCaseFileDetails.tsx`
- `src/features/cases/files/components/tabs/CaseFileLettersTab.tsx`

**Pages**
- aktuell keine direkt beteiligten Dateien in `src/pages/**`

**Components**
- `src/components/LettersView.tsx`
- `src/components/LetterEditor.tsx`
- `src/components/LetterTemplateSelector.tsx`
- `src/components/letters/LetterWizard.tsx`
- `src/components/letters/LetterAttachmentManager.tsx`

**Flow-Typecheck**
- `tsconfig.flow-letter-workflow-strict.json`
- `npm run typecheck:flow-letter-workflow`

**Definition of Done**
- Archivierungs- und Letter-Statuspfade sind ohne implizites `any` und ohne Null-Lücken abgedeckt
- relevante Negativpfade aus `docs/ci-quality-gates.md` bleiben testbar

### 4) Benachrichtigungen

**Ziel**
- Laden, Optimistic Updates, Read/Unread, Navigation-Signale, Settings und Notifications-Page gemeinsam migrieren.

**Hooks**
- `src/hooks/useNotifications.tsx`
- `src/hooks/useNavigationNotifications.tsx`

**Services**
- aktuell keine direkt beteiligten Dateien in `src/services/**`

**Features**
- aktuell keine direkt beteiligten Dateien in `src/features/**`

**Pages**
- `src/pages/NotificationsPage.tsx`
- `src/pages/Index.tsx`

**Components**
- `src/components/NotificationBell.tsx`
- `src/components/NotificationCenter.tsx`
- `src/components/NotificationSettings.tsx`
- `src/components/Navigation.tsx`
- `src/components/MessageComposer.tsx`

**Flow-Typecheck**
- `tsconfig.flow-notifications-strict.json`
- `npm run typecheck:flow-notifications`

**Definition of Done**
- Read/Unread- und Rollback-Pfade sind in einem strict-Paket zusammengefasst
- Hook-, UI- und Page-Grenzen sind gemeinsam auf `strictNullChecks` und `noImplicitAny` angehoben

### 5) Edge-Auth/Role/Tenant-nahe Frontend-Logik

**Ziel**
- Frontend-nahe Aufrufer für auth-, rollen- und tenant-sensitive Edge/RPC-Pfade gemeinsam migrieren.

**Hooks**
- `src/hooks/useAuth.tsx`
- `src/hooks/useTenant.tsx`

**Services**
- aktuell keine direkt beteiligten Dateien in `src/services/**`

**Features**
- `src/features/matrix-widget/api.ts`
- `src/features/matrix-widget/MatrixWebsiteWidget.tsx`
- `src/features/matrix-widget/types.ts`

**Pages**
- `src/pages/Administration.tsx`

**Components**
- `src/components/layout/AppHeader.tsx`
- `src/components/Navigation.tsx`
- `src/components/administration/SuperadminTenantManagement.tsx`
- `src/components/administration/UserRolesManager.tsx`

**Flow-Typecheck**
- `tsconfig.flow-edge-auth-role-tenant-strict.json`
- `npm run typecheck:flow-edge-auth-role-tenant`

**Definition of Done**
- Guard-UI, Rollen-/Tenant-Annahmen und Edge-nahe Frontend-Typen sind gemeinsam strict-clean
- dokumentierte Contract-Negativpfade bleiben referenzierbar

## Flow-Done-Gate (verpflichtend)

Ein Kernflow darf nur dann als **done** markiert werden, wenn alle folgenden Bedingungen erfüllt sind:

1. Mini-Ziel erreicht (`0 neue any`, geplanter Abbauwert erreicht),
2. Flow-PR-Dokumentation vollständig (entfernte/verbleibende `any` + nächster Abbau-Schritt),
3. `strictNullChecks` im Flow-Typecheck grün,
4. `noImplicitAny` im Flow-Typecheck grün.

Fehlt eine dieser Bedingungen, bleibt der Flow im Status **in progress**.

## Technische Umsetzung in den Tooling-Artefakten

Die fachliche Führung wird zusätzlich technisch sichtbar gemacht durch eigene Flow-Typechecks:

- `typecheck:flow-auth-tenant`
- `typecheck:flow-calendar-sync`
- `typecheck:flow-letter-workflow`
- `typecheck:flow-notifications`
- `typecheck:flow-edge-auth-role-tenant`

`npm run typecheck:strict-all` startet mit genau diesen fünf Flow-Checks und führt danach die bestehenden Ordner-/Batch-Checks weiter aus. Dadurch bleiben bestehende Schutznetze erhalten, während die operative Reihenfolge fachlich geführt wird.

Optional stehen je Flow Any-Reports für Vorher-/Nachher-Vergleiche zur Verfügung:

- `npm run any-report:flow-auth-tenant`
- `npm run any-report:flow-calendar-sync`
- `npm run any-report:flow-letter-workflow`
- `npm run any-report:flow-notifications`
- `npm run any-report:flow-edge-auth-role-tenant`

Diese Reports liefern eine reproduzierbare Basis für die PR-Aussage "0 neue any, X entfernt".

## Review-Regel für alle kommenden Strict-Migrations-PRs

Jeder PR, der die Strict-Migration erweitert, dokumentiert explizit:

- **welcher Kernflow** bearbeitet wurde,
- **welches Flow-Paket** abgeschlossen oder weitergeführt wurde,
- **welche Hooks, Services, Features, Components und Pages** Teil des Pakets sind,
- **welche `any`-Stellen entfernt wurden** (Datei + Kontext),
- **welche `any` verbleiben und warum** (begründete Ausnahme),
- **welcher nächste konkrete Abbau-Schritt** für die verbleibenden `any` geplant ist,
- **ob `strictNullChecks` und `noImplicitAny` im gesamten Paket grün sind**,
- und **welcher Kernflow als Nächstes** freigegeben ist.

Damit bleibt die Migration fachlich wirksam, klein genug für Review und entlang echter Nutzer- bzw. Systemflüsse nachvollziehbar.

## ESLint-Regelstufen pro Flow (Any/Unsafe-Migration)

Stand: **2026-03-25**

### Globaler Default (alle `*.ts` / `*.tsx`)

- `@typescript-eslint/no-explicit-any`: **warn**
- `@typescript-eslint/no-unsafe-assignment`: **off** (nur in strikten Flow-Slices aktiv)
- `@typescript-eslint/no-unsafe-member-access`: **off** (nur in strikten Flow-Slices aktiv)
- `@typescript-eslint/no-unsafe-call`: **off** (nur in strikten Flow-Slices aktiv)

### Strikte Flow-Slices (bereits hochgezogen)

#### Auth / Tenant-Wechsel

- Scope analog `tsconfig.flow-auth-tenant-strict.json`
- `@typescript-eslint/no-explicit-any`: **error**
- `@typescript-eslint/no-unsafe-assignment`: **warn**
- `@typescript-eslint/no-unsafe-member-access`: **warn**
- `@typescript-eslint/no-unsafe-call`: **warn**

#### Benachrichtigungen

- Scope analog `tsconfig.flow-notifications-strict.json`
- `@typescript-eslint/no-explicit-any`: **error**
- `@typescript-eslint/no-unsafe-assignment`: **warn**
- `@typescript-eslint/no-unsafe-member-access`: **warn**
- `@typescript-eslint/no-unsafe-call`: **warn**

### Übrige Kernflows (noch auf globalem Default)

- Kalender-Sync
- Briefstatus-Workflow
- Edge-Auth/Role/Tenant-nahe Frontend-Logik

Für diese Flows gilt derzeit noch die globale Stufe (`no-explicit-any: warn`) bis die jeweiligen Slices als stabil migriert markiert sind.

## Ramp-up nach 2–3 grünen Wellen

Nach **2–3 aufeinanderfolgenden grünen Wellen** (Lint + Typecheck ohne neue Any/Unsafe-Rückfälle) wird in zwei Schritten angehoben:

1. Global `@typescript-eslint/no-explicit-any` von **warn** auf **error**.
2. Danach globale Aktivierung von
   - `@typescript-eslint/no-unsafe-assignment`,
   - `@typescript-eslint/no-unsafe-member-access`,
   - `@typescript-eslint/no-unsafe-call`
   zunächst auf **warn**, anschließend ggf. auf **error**.

Damit bleibt die Migration inkrementell, aber mit klarer Zielrichtung auf einen strikten Projektstandard.
