# TypeScript Strict Migration Plan (Flow-basiert statt Ordner-basiert)

## Ziel & Priorisierung

Die Strict-Migration wird **nicht mehr primär nach Verzeichnissen**, sondern nach echten End-to-End-Flows organisiert. So werden Typverbesserungen entlang kompletter Datenflüsse wirksam — vom Hook über Feature-/Component-Schichten bis zu tenant- und rollenabhängigen UI-Pfaden.

Die fünf priorisierten Pakete orientieren sich an den bereits definierten Kernflows in `docs/ci-quality-gates.md`:

1. Auth / Tenant-Wechsel
2. Kalender-Sync
3. Briefstatus-Workflow
4. Benachrichtigungen
5. Edge-Auth/Role/Tenant-nahe Frontend-Logik

## Migrationsprinzip: Flow als zusammenhängendes Paket

Jeder Flow wird als **ein zusammenhängendes Migrationspaket** bearbeitet:

- erst Hooks/State-Quellen härten,
- dann Feature-spezifische Datenzugriffe typisieren,
- anschließend UI-Komponenten im selben Flow strict-clean machen,
- danach Tests/Coverage für denselben Flow nachziehen.

Damit vermeiden wir, dass z. B. `useAuth` oder `useTenant` isoliert verbessert werden, aber die nachgelagerten Komponenten weiter `any`- oder Nullability-Lücken transportieren.

## Flow-Pakete mit beteiligten Dateien

> Scope der Dateiliste: nur `src/hooks/**`, `src/services/**`, `src/features/**` und `src/components/**`.
>
> Hinweis: In `src/services/**` ist aktuell nur `src/services/headerRenderer.ts` vorhanden; für die unten priorisierten Flows ist dort derzeit keine direkte Beteiligung erkennbar.

### 1) Auth / Tenant-Wechsel

**Ziel des Pakets**
- Session-Wiederherstellung, Benutzerkontext, Tenant-Lookup und Tenant-Persistenz pro User gemeinsam typisieren.
- Nullability-Grenzen (`user`, `currentTenant`, Loading-Zustände) an den Übergängen zwischen Hook und UI schließen.

**Beteiligte Dateien**

**Hooks**
- `src/hooks/useAuth.tsx`
- `src/hooks/useTenant.tsx`

**Services**
- aktuell keine direkt beteiligten Dateien in `src/services/**`

**Features**
- aktuell keine direkt priorisierten Dateien in `src/features/**`

**Components**
- `src/components/layout/AppHeader.tsx`
- `src/components/SettingsView.tsx`
- `src/components/account/ActiveSessionsCard.tsx`
- `src/components/administration/SuperadminTenantManagement.tsx`

**Verknüpfung zu Coverage / CI**
- Entspricht Kernflow **„Auth / Tenant-Wechsel“** in `docs/ci-quality-gates.md`.
- Explizite Coverage-Schwellen existieren bereits für:
  - `src/hooks/useAuth.tsx`
  - `src/hooks/useTenant.tsx`
- Negativpfade laut CI-Doku:
  - kein User in Session,
  - keine Tenant-Zuordnung,
  - kein persistierter Tenant-Wechsel.

**Migrationsreihenfolge im Paket**
1. `useAuth.tsx`
2. `useTenant.tsx`
3. Header/Settings/Superadmin-/Session-Komponenten
4. Flow-Tests und Coverage gegen die CI-Gates spiegeln

### 2) Kalender-Sync

**Ziel des Pakets**
- Externe Kalender-Konfiguration, manuellen Sync-Trigger, Debug-/Admin-Pfade und Kalenderdarstellung gemeinsam migrieren.
- Typen für Kalenderobjekte, Sync-Responses und Tenant-Bezug entlang des kompletten Flows vereinheitlichen.

**Beteiligte Dateien**

**Hooks**
- aktuell keine direkt beteiligten Dateien in `src/hooks/**`

**Services**
- aktuell keine direkt beteiligten Dateien in `src/services/**`

**Features**
- aktuell keine direkt priorisierten Dateien in `src/features/**`

**Components**
- `src/components/ExternalCalendarSettings.tsx`
- `src/components/CalendarSyncDebug.tsx`
- `src/components/SettingsView.tsx`
- `src/components/administration/CalendarSyncSettings.tsx`
- `src/components/calendar/hooks/useCalendarData.ts`

**Verknüpfung zu Coverage / CI**
- Entspricht Kernflow **„Kalender-Sync-Trigger“** in `docs/ci-quality-gates.md`.
- Explizite Coverage-Schwelle existiert bereits für:
  - `src/components/ExternalCalendarSettings.tsx`
- Relevante Negativpfade aus der CI-Doku:
  - `missing-jwt`
  - `invalid-payload-schema`
  - `role-tenant-violation`
- Für die Strict-Migration sollte derselbe Flow als Contract-/Integrationstest sichtbar bleiben: UI-Trigger → Edge-Function-Aufruf → Fehlerdarstellung in der UI.

**Migrationsreihenfolge im Paket**
1. `useCalendarData.ts` als Datengrundlage typisieren
2. `ExternalCalendarSettings.tsx` und `CalendarSyncDebug.tsx`
3. Admin-/Settings-Einbettungen
4. Contract-/Integrationstests an den dokumentierten CI-Negativpfaden ausrichten

### 3) Briefstatus-Workflow

**Ziel des Pakets**
- Archivierung, PDF-/Dokument-Metadaten, Letter-Editor-/Wizard-Zustände und Verknüpfung zum Status `sent` als ein Flow behandeln.
- Typen für archivierungsrelevante Payloads, Attachments und Statusübergänge vereinheitlichen.

**Beteiligte Dateien**

**Hooks**
- `src/hooks/useLetterArchiving.tsx`

**Services**
- aktuell keine direkt beteiligten Dateien in `src/services/**`

**Features**
- `src/features/cases/files/hooks/useCaseFileDetails.tsx`
- `src/features/cases/files/components/tabs/CaseFileLettersTab.tsx`

**Components**
- `src/components/LettersView.tsx`
- `src/components/LetterEditor.tsx`
- `src/components/LetterTemplateSelector.tsx`
- `src/components/letters/LetterWizard.tsx`
- `src/components/letters/LetterAttachmentManager.tsx`

**Verknüpfung zu Coverage / CI**
- Entspricht Kernflow **„Briefstatus-Workflow“** in `docs/ci-quality-gates.md`.
- Explizite Coverage-Schwelle existiert bereits für:
  - `src/hooks/useLetterArchiving.tsx`
- Relevante Negativpfade aus der CI-Doku:
  - fehlender User,
  - fehlender Tenant,
  - destruktive Fehlermeldung statt stiller Teilfehler.

**Migrationsreihenfolge im Paket**
1. `useLetterArchiving.tsx`
2. fallaktennahe Letter-Verknüpfung (`useCaseFileDetails.tsx`, `CaseFileLettersTab.tsx`)
3. Editor-/Wizard-/Attachment-Komponenten
4. Tests für Statuswechsel `draft`/`sent`, Dokumenteintrag und Archivierungsfehler

### 4) Benachrichtigungen

**Ziel des Pakets**
- Laden, Optimistic Updates, Read/Unread-Status, Cross-Tab-Signale und Push-/Realtime-nahe UI gemeinsam migrieren.
- Typen für Notification-Entitäten, Optimistic-Rollback und Browser-Permission-Status entlang des kompletten Flows stabilisieren.

**Beteiligte Dateien**

**Hooks**
- `src/hooks/useNotifications.tsx`
- `src/hooks/useNavigationNotifications.tsx`

**Services**
- aktuell keine direkt beteiligten Dateien in `src/services/**`

**Features**
- aktuell keine direkt priorisierten Dateien in `src/features/**`

**Components**
- `src/components/NotificationBell.tsx`
- `src/components/NotificationCenter.tsx`
- `src/components/NotificationSettings.tsx`
- `src/components/Navigation.tsx`
- `src/components/MessageComposer.tsx`

**Verknüpfung zu Coverage / CI**
- Entspricht Kernflow **„Benachrichtigungen (Read/Unread)“** in `docs/ci-quality-gates.md`.
- Explizite Coverage-Schwelle existiert bereits für:
  - `src/hooks/useNotifications.tsx`
- Relevante Negativpfade aus der CI-Doku:
  - Rollback nach Fehler,
  - Reload-Verhalten,
  - Persistenzfehler bei `markAllAsRead`.

**Migrationsreihenfolge im Paket**
1. `useNotifications.tsx`
2. `useNavigationNotifications.tsx`
3. Bell/Center/Navigation
4. Settings- und Composer-Pfade
5. Hook- und Integrationstests gegen Optimistic-Update-/Rollback-Szenarien absichern

### 5) Edge-Auth/Role/Tenant-nahe Frontend-Logik

**Ziel des Pakets**
- Frontend-nahe Aufrufer für auth-, rollen- und tenant-sensitive Edge- oder RPC-Pfade gemeinsam migrieren.
- Typen für Berechtigungsannahmen, Tenant-Kontext und Guard-UI so setzen, dass Contract-Fehler möglichst früh im Frontend sichtbar werden.

**Beteiligte Dateien**

**Hooks**
- `src/hooks/useAuth.tsx`
- `src/hooks/useTenant.tsx`

**Services**
- aktuell keine direkt beteiligten Dateien in `src/services/**`

**Features**
- `src/features/matrix-widget/api.ts`
- `src/features/matrix-widget/MatrixWebsiteWidget.tsx`
- `src/features/matrix-widget/types.ts`

**Components**
- `src/components/layout/AppHeader.tsx`
- `src/components/Navigation.tsx`
- `src/components/administration/SuperadminTenantManagement.tsx`
- `src/components/administration/UserRolesManager.tsx`

**Verknüpfung zu Coverage / CI**
- Entspricht Kernflow **„Edge-Functions Auth/Role/Tenant“** in `docs/ci-quality-gates.md`.
- Inhaltlich an dieselben Contract-Hinweise koppeln:
  - `missing-jwt`
  - `invalid-payload-schema`
  - `role-tenant-violation`
  - `idempotency-repeat` für Trigger-Funktionen
- Dieses Paket profitiert indirekt von den Coverage-Gates für `useAuth.tsx` und `useTenant.tsx`, auch wenn für die übrigen Frontend-Dateien aktuell noch keine expliziten Einzel-Schwellen definiert sind.

**Migrationsreihenfolge im Paket**
1. `useAuth.tsx` und `useTenant.tsx` als Guard-Basis
2. Matrix-/Edge-nahe Feature-API und Widget-Typen
3. Rollen-/Tenant-sensitive Admin- und Navigationskomponenten
4. Contract-Tests und UI-Gegenprüfungen gegen die dokumentierten Edge-Negativpfade

## Ownership & Review-Konventionen für die laufende Migrationsarbeit

In Anlehnung an `docs/architecture-guidelines.md` erhält **jede Migrationswelle** der Strict-Migration eine klar dokumentierte fachliche und technische Zuständigkeit. Für die laufende Migrationsarbeit gilt deshalb dieselbe Ownership-Konvention wie für neue Hooks und Edge Functions — erweitert um Flow-Verantwortung, Review-Kreis und PR-Pflichtangaben.

### Verbindliche Ownership-Angaben pro Migrationswelle

Jede Welle dokumentiert mindestens:

1. **Primary Owner** für fachliche Priorisierung, Scope-Zuschnitt und Merge-Freigabe.
2. **Secondary Owner / Vertretung** für Review- oder Freigabe-Vertretung bei Abwesenheit.
3. **Feature-/Flow-Zuordnung** analog zur Ownership-Konvention aus `docs/architecture-guidelines.md`.
4. **Review-Kreis**, der bei Strict-PRs mit Änderungen im jeweiligen Flow verbindlich eingebunden wird.

Empfohlene Kennzeichnung in PRs, Tickets und Migrationsnotizen:

```md
- Primary Owner: team-...
- Secondary Owner: team-...
- Flow: ...
- Review-Kreis: ...
```

### Ownership-Matrix der aktuellen Migrationswellen

| Migrationswelle / Kernbereich | Primärer Scope | Primary Owner | Vertretung | Verbindlicher Review-Kreis |
| --- | --- | --- | --- | --- |
| 1. Auth / Tenant-Wechsel | Session-Wiederherstellung, Tenant-Lookup, Guard-UI, rollen-/tenant-sensitive Navigation | `team-platform` | `team-office` | Auth/Tenant Review-Kreis (`team-platform`, `team-security`, `team-office`) |
| 2. Kalender-Sync | Kalenderdaten, Sync-Trigger, Admin-/Debug-Pfade, Fehlerdarstellung | `team-office` | `team-platform` | Kalender Review-Kreis (`team-office`, `team-platform`, `team-security`) |
| 3. Briefstatus-Workflow | Letter-Archiving, Editor/Wizard, Attachments, `draft`/`sent`-Übergänge | `team-office` | `team-cases` | Letters Review-Kreis (`team-office`, `team-cases`, `team-platform`) |
| 4. Benachrichtigungen | Laden, Read/Unread, Optimistic Updates, Realtime-/Push-nahe UI | `team-platform` | `team-office` | Notifications Review-Kreis (`team-platform`, `team-office`) |
| 5. Cases-/Edge-nahe Frontend-Logik | Fallakten, Owner-/Role-/Tenant-Guards, Matrix-/Edge-nahe Feature-API | `team-cases` | `team-platform` | Cases Review-Kreis (`team-cases`, `team-platform`, `team-security`) |

### Review-Kreise der laufenden Migration

Für Änderungen an den folgenden Bereichen ist der jeweilige Review-Kreis **verbindlich** in Strict-PRs anzugeben oder zu pingen:

- **Auth/Tenant:** `team-platform`, `team-security`, `team-office`
- **Notifications:** `team-platform`, `team-office`
- **Letters:** `team-office`, `team-cases`, `team-platform`
- **Kalender:** `team-office`, `team-platform`, `team-security`
- **Cases:** `team-cases`, `team-platform`, `team-security`

Wenn eine PR mehrere Kernbereiche berührt, müssen alle betroffenen Review-Kreise sichtbar genannt werden. Der Primary Owner des dominanten Flows koordiniert in diesem Fall die Reihenfolge der Reviews und dokumentiert, welcher Flow die Merge-Entscheidung führt.

### Zusätzliche PR-Pflichtangaben für Strict-PRs

Jede PR, die einen Strict-Batch erweitert, eine Migrationswelle vorzieht oder neue Dateien in ein aktives Flow-Paket aufnimmt, enthält zusätzlich einen kurzen Abschnitt `Strict-Migrationskontext` mit mindestens diesen drei Angaben:

1. **Betroffener Flow** — welcher Kernflow oder welche Migrationswelle konkret geändert wird.
2. **Reduziertes Risiko** — welches fachliche oder technische Risiko durch die Änderung konkret gesenkt wird.
3. **Vorbereitete Folge-Batches** — welche nachfolgenden Batches, Dateien oder Teilflüsse dadurch als Nächstes strict-clean gezogen werden können.

Empfohlenes PR-Schema:

```md
## Strict-Migrationskontext
- Flow: Auth / Tenant-Wechsel
- Reduziertes Risiko: Nullability-Lücken zwischen `useAuth` und tenant-sensitiver Navigation werden vor Batch-2-Freigabe geschlossen.
- Vorbereitete Folge-Batches: `typecheck:hooks-batch2`, nachgelagerte Header-/Settings-Komponenten, Edge-Guard-UI im Cases-/Matrix-Umfeld.
```

Diese Pflichtangaben ergänzen die bestehenden Review-Checkfragen für Type-Sicherheits-Schulden und sollen sicherstellen, dass Strict-PRs nicht nur technische Compiler-Fortschritte zeigen, sondern ihren fachlichen Nutzen und ihre Batch-Folgen transparent machen.

## Batch-Configs & Commands

Die bestehenden Batch-Konfigurationen bleiben als **technische Ausführungsmechanik** erhalten. Die Auswahl, **welche Dateien als nächstes strict-clean werden**, richtet sich aber ab jetzt nach den oben definierten Flow-Paketen.

### Hooks

- Batch 1: `tsconfig.hooks-batch1-strict.json` → `npm run typecheck:hooks-batch1`
- Batch 2: `tsconfig.hooks-batch2-strict.json` → `npm run typecheck:hooks-batch2`
- Batch 3: `tsconfig.hooks-batch3-strict.json` → `npm run typecheck:hooks-batch3`

### Pages

- Batch 1: `tsconfig.pages-strict.json` → `npm run typecheck:pages-batch1`
- Batch 2: `tsconfig.pages-batch2-strict.json` → `npm run typecheck:pages-batch2`
- Batch 3: `tsconfig.pages-batch3-strict.json` → `npm run typecheck:pages-batch3`

### Services / Features

- Batch 1: `tsconfig.services-features-strict.json` → `npm run typecheck:services-batch1`
- Batch 2: `tsconfig.services-features-batch2-strict.json` → `npm run typecheck:services-batch2`
- Batch 3: `tsconfig.services-features-batch3-strict.json` → `npm run typecheck:services-batch3`

## CI-Integration (schrittweise)

Aktuelle Integration im Job `node-quality-gates`:

- Stage 1 ist aktiv:
  - `npm run typecheck:hooks-batch1`
  - `npm run typecheck:pages-batch1`
  - `npm run typecheck:services-batch1`

Empfohlene Weiterentwicklung mit Flow-Fokus:

1. Für jeden der fünf Kernflows einen sichtbaren Strict-Migrationsstatus in PRs dokumentieren.
2. Batch-2-Checks zunächst nicht-blockierend zuschalten, aber Flow-bezogen auswerten.
3. Nach Stabilisierung Batch-2 pro Flow blockierend machen.
4. Dasselbe Muster anschließend für Batch-3 wiederholen.
5. Coverage-Entwicklung immer zusammen mit Strict-Fortschritt je Flow betrachten, nicht getrennt nach Ordnern.

## Migrationsregel (verbindlich)

- **Neue oder geänderte Dateien in einem aktiven Flow-Paket müssen strict-clean sein.**
- Wenn ein Flow angefasst wird, sollen die direkt nachgelagerten Dateien desselben Datenflusses bevorzugt im selben Paket bereinigt werden.
- Legacy-Dateien außerhalb des aktiven Flow-Scope dürfen vorübergehend abweichen, aber nur mit dokumentierter Ausnahme.

### Ausnahmeregeln für Type-Sicherheits-Schulden in der Migrationsphase

1. **Keine neuen `@ts-ignore`-Kommentare.** Während der Strict-Migration werden neue `@ts-ignore`-Ausnahmen grundsätzlich nicht eingeführt. Wenn ein Compilerproblem nur unter Zeitdruck überbrückt werden kann, muss zuerst geprüft werden, ob `unknown`, ein Guard, ein schmalerer Hilfstyp oder eine lokale Refaktorierung die sauberere Alternative ist.
2. **Technisch unvermeidbare Ausnahmen nur mit vollständiger Begründung.** Falls eine Ausnahme nachweislich unvermeidbar ist, ist sie direkt am Code und zusätzlich im PR zu dokumentieren mit:
   - kurzem fachlich-technischem Grund,
   - Ticket- oder Issue-Referenz,
   - geplantem Entfernungsdatum.
3. **Non-Null-Assertions (`!`) und Typ-Casts (`as ...`) in migrierten Dateien aktiv prüfen.** Für jede neue oder geänderte Non-Null-Assertion bzw. jeden neuen oder geänderten Cast muss klar sein, welche Invariante fachlich gilt und warum sie an dieser Stelle zuverlässig erfüllt ist. Wo möglich, sind Guard, Assertion-Helper oder enger modellierte Typen vorzuziehen.
4. **Strict-Batch-Erweiterungen erhalten einen eigenen Review-Checkpoint für Type-Sicherheits-Schulden.** Jede PR, die Dateien zu einem Strict-Batch hinzufügt oder einen bestehenden Batch erweitert, dokumentiert offen verbliebene Typ-Schulden und deren Abbauplan.

### Ausnahme-Dokumentation (temporär)

Ausnahmen werden in PR-Beschreibungen oder einem technischen Schulden-Log dokumentiert mit:

- Datei
- betroffenem Flow
- Grund
- Ticket-/Issue-Referenz
- geplantem Ziel-Batch
- Entfernungsdatum

## Review-Checkfragen für PRs mit Strict-Batch-Änderungen

Diese Checkfragen sollen in der PR-Beschreibung oder im Review explizit beantwortet werden, sobald eine PR einen Strict-Batch erweitert oder neue Dateien in ein Flow-Paket der Strict-Migration aufnimmt:

1. Welcher **betroffene Flow** bzw. welche **Migrationswelle** wird geändert?
2. Welches **fachliche oder technische Risiko** wird durch diese Strict-PR konkret reduziert?
3. Welche **Folge-Batches, Dateien oder Teilflüsse** werden durch diese PR vorbereitet?
4. Wurden **keine neuen `@ts-ignore`**-Kommentare eingeführt? Falls doch, warum war die Ausnahme technisch unvermeidbar, welches Ticket referenziert sie und bis wann wird sie entfernt?
5. Sind **neue oder geänderte Non-Null-Assertions (`!`)** fachlich begründet und durch nachvollziehbare Invarianten oder Guards abgesichert?
6. Sind **neue oder geänderte Typ-Casts (`as ...`)** auf das notwendige Minimum begrenzt und fachlich/technisch erklärt?
7. Welche **offenen Type-Sicherheits-Schulden** verbleiben nach dieser PR im erweiterten Strict-Batch, und in welchem Folge-Batch oder Ticket werden sie abgebaut?

## Fortschrittsmetrik

Die Metrik bleibt der Anteil strict-geprüfter Dateien pro Verzeichnis und Batch-Stufe, wird aber zusätzlich **pro Flow** interpretiert.

- Command: `npm run report:strict-progress`
- Quelle: Batch-`tsconfig`-Includes gegenüber allen `*.ts`/`*.tsx` im Zielverzeichnis.
- Interpretation künftig in zwei Sichten:
  1. **technisch:** Verzeichnis-/Batch-Abdeckung
  2. **fachlich:** Flow-Abdeckung der fünf priorisierten End-to-End-Pakete
- Aktueller Snapshot: `docs/strict-progress.md`
