# Büro-Plattform

Digitale Arbeitsplattform für politische Büros – Termine, Kontakte, Vorgänge, Aufgaben, Dokumente, Sitzungen und mehr. Multi-Tenant-fähig mit rollenbasiertem Zugriff.

**Lovable-Projekt:** [https://lovable.dev/projects/7d09a65d-5cbe-421b-a580-38a4fe244277](https://lovable.dev/projects/7d09a65d-5cbe-421b-a580-38a4fe244277)

---

## Architektur

```
┌─────────────────────────────────────────────┐
│  React SPA (Vite + TypeScript + Tailwind)   │
│  ├── shadcn/ui + Radix Primitives           │
│  ├── React Query (Server-State)             │
│  ├── Lexical (Rich-Text-Editor)             │
│  └── Leaflet (Karten)                       │
├─────────────────────────────────────────────┤
│  Supabase                                   │
│  ├── PostgreSQL (RLS + Tenant-Isolation)    │
│  ├── Auth (Email/Password + MFA)            │
│  ├── Storage (Dokumente, Anhänge)           │
│  ├── Realtime (Notifications, Chat)         │
│  └── Edge Functions (50+ Funktionen)        │
└─────────────────────────────────────────────┘
```

---

## Lokales Setup

```bash
# Repository klonen
git clone <GIT_URL>
cd <PROJEKT>

# Dependencies installieren
npm install

# Entwicklungsserver starten
npm run dev
```

Alternativ direkt in Lovable entwickeln – Änderungen werden automatisch committet.

---

## Ordnerstruktur

```
src/
├── App.tsx                    # Einstiegspunkt (~10 Zeilen)
├── providers/
│   └── AppProviders.tsx       # QueryClient + Auth + Tenant + Settings + Notifications
├── router/
│   ├── AppRouter.tsx          # BrowserRouter + Suspense + globale Overlays
│   └── routes.tsx             # Alle Route-Definitionen (lazy-loaded)
├── components/
│   ├── layout/                # Header, Navigation, GlobalOverlays
│   ├── ui/                    # shadcn/ui Basis-Komponenten
│   ├── my-work/               # "Meine Arbeit" Dashboard
│   ├── meetings/              # Sitzungsverwaltung
│   ├── letters/               # Briefeditor + Templates
│   ├── tasks/                 # Aufgabenverwaltung
│   ├── contacts/              # Kontaktverwaltung
│   ├── documents/             # Dokumentenverwaltung
│   ├── appointments/          # Terminverwaltung
│   ├── employees/             # Mitarbeiterverwaltung
│   ├── timetracking/          # Zeiterfassung
│   ├── chat/                  # Matrix-Chat
│   ├── admin/                 # Admin-Ansichten
│   └── ...                    # Weitere Feature-Module
├── features/
│   ├── cases/                 # Vorgänge (Files + Items) – Feature-First-Struktur
│   └── matrix-widget/         # Matrix-Widget
├── hooks/                     # Globale Custom Hooks (80+)
├── contexts/                  # React Contexts (Notifications, Matrix)
├── integrations/supabase/     # Generierte Types + Client
├── lib/                       # Utilities (lazyWithRetry, coiRuntime)
├── utils/                     # Hilfsfunktionen (errorHandler, debugConsole, sanitize)
├── services/                  # Service-Layer
└── pages/                     # Seiten-Komponenten (Auth, ContactDetail, etc.)

supabase/
├── functions/                 # 50+ Edge Functions
└── migrations/                # DB-Migrationen (read-only)

docs/                          # Fachliche Dokumentation
├── rollenrechte-matrix.md     # Rollen- und Rechtemodell
├── security-function-matrix.md # Auth-/Sicherheitsmodell je Edge Function
├── dangerouslysetinnerhtml-inventory.md # XSS-relevante Rendering-Inventur
├── automation-no-code-umsetzung.md
└── ...
```

---

## Wichtige Patterns

### `lazyWithRetry`
Alle Seiten und schwere Komponenten werden über `lazyWithRetry()` geladen – Lazy Loading mit automatischem Retry bei Chunk-Fehlern.

### `debugConsole`
Wrapper um `console.*` der im Production-Build stumm bleibt. Immer `debugConsole.log()` statt `console.log()` verwenden.

### `handleAppError` / `getErrorMessage`
Zentraler Error-Handler in `src/utils/errorHandler.ts`. Einheitliches Logging + optionaler Toast + optionales Rethrow:
```ts
catch (error: unknown) {
  handleAppError(error, {
    context: 'useLetters.save',
    toast: { fn: toast, title: 'Speichern fehlgeschlagen' },
  });
}
```

### Multi-Tenant-System
- Jeder Datensatz gehört zu einem `tenant_id`
- RLS-Policies nutzen `get_user_tenant_ids(auth.uid())` für Zugriffskontrolle
- Tenant-Wechsel über `useTenant()` Hook
- `localStorage` speichert den aktiven Tenant pro User (`currentTenantId_<userId>`)

### Rollen & Rechte
Rollen werden in einer separaten `user_roles`-Tabelle gespeichert (nicht auf `profiles`). Details: [`docs/rollenrechte-matrix.md`](docs/rollenrechte-matrix.md)

---

## Edge Functions (Auswahl)

| Funktion | Zweck | Auth |
|----------|-------|------|
| `sync-external-calendar` | iCal-Kalender synchronisieren | JWT |
| `create-daily-appointment-feedback` | Tägliche Rückmeldungs-Erstellung (Cron) | Cron |
| `send-decision-email` | Entscheidungs-E-Mails versenden | JWT |
| `process-decision-response` | Gast-Antworten verarbeiten | Public |
| `log-audit-event` | Audit-Log-Einträge schreiben | JWT |
| `run-automation-rule` | No-Code-Automatisierungen ausführen | JWT |
| `suggest-case-escalations` | Eskalationsvorschläge für Vorgänge | JWT |
| `global-logout` | Alle Sessions eines Users beenden | JWT |
| `manage-tenant-user` | Tenant-Mitglieder verwalten | JWT |
| `send-push-notification` | Web-Push-Benachrichtigungen | JWT |

Vollständige Liste: `supabase/functions/`

---

## Testing

```bash
# Tests ausführen
npx vitest run

# Tests im Watch-Mode
npx vitest
```

- Framework: **Vitest** + **@testing-library/react**
- Tests liegen neben den Quelldateien oder in `__tests__/`-Unterordnern
- Supabase-Client wird per `vi.mock('@/integrations/supabase/client')` gemockt

---

## Deployment

**Via Lovable:** Share → Publish

**Custom Domain:** Project → Settings → Domains → Connect Domain. Siehe [Lovable Docs](https://docs.lovable.dev/tips-tricks/custom-domain).

---

## Tech-Stack

| Kategorie | Technologie |
|-----------|------------|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS + shadcn/ui |
| State | React Query (TanStack) |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions) |
| Editor | Lexical |
| Karten | Leaflet + React-Leaflet |
| Chat | Matrix SDK |
| Testing | Vitest |
