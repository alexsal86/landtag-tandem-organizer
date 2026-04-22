

## Tagesbriefing fürs Dashboard

Mitarbeiter (inkl. Büroleitung/Praktikant) verfassen ein freiwilliges Tagesbriefing für „ihren" Abgeordneten. Es erscheint **am Tag der Gültigkeit** als Kachel im Dashboard des Abgeordneten – aber nur, wenn es **mindestens am Vortag** geschrieben wurde. So wird verhindert, dass spontane „Last-Minute"-Briefings den Morgenüberblick stören.

### Verhalten

- **Verfassen**: Mitarbeiter sieht im Dashboard eine kompakte Kachel „Tagesbriefing für morgen" (oder folgenden Werktag, wenn morgen Wochenende ist).
  - Felder: Titel (optional), Freitext (Markdown/Mehrzeilig), Datum-Auswahl (Standard = nächster Werktag, frühestens „heute+1").
  - Mehrere Mitarbeiter können je eigenes Briefing für denselben Tag schreiben (kein Lock, kein Co-Edit – bewusst schlank).
  - Eigenes Briefing bleibt bis Mitternacht des Zieltages editierbar; danach archiviert/read-only.
- **Lesen (Abgeordneter)**: Auf dem Dashboard erscheint ganz oben (über `DashboardHeader`-Grid, unter Begrüßung) eine Sektion **„Briefing für heute"** mit allen für **heute** gültigen Briefings, die **vor dem heutigen Tag** erstellt wurden (`created_at::date < today AND briefing_date = today`).
  - Pro Briefing: Avatar/Name des Autors, Erstellungszeitpunkt („gestern, 18:42"), Titel, Inhalt (kollabierbar bei >300 Zeichen), „Gelesen"-Häkchen.
  - „Gelesen" wird pro (briefing × user) gespeichert; gelesene Briefings rutschen optisch nach unten und werden ausgegraut.
  - Leerer Zustand: dezenter Hinweis „Heute kein Briefing vom Team" – Kachel wird *nicht* angezeigt, wenn keine Briefings existieren (kein Rauschen).
- **Sichtbarkeit**: Tenant-isoliert. Briefing geht an **alle Abgeordneten des Tenants** (analog zu bestehender „Fallback Abgeordneter"-Logik). Kein Empfänger-Picker im MVP.
- **Benachrichtigung**: Keine Push-Notification im MVP – das Dashboard ist der Kanal. (Erweiterbar später.)

### Datenmodell (Migration)

Neue Tabelle `daily_briefings`:
- `id uuid pk`, `tenant_id uuid not null`, `author_id uuid not null` (auth.users)
- `briefing_date date not null` – der Tag, für den es gilt
- `title text null`, `content text not null`
- `created_at timestamptz default now()`, `updated_at timestamptz`
- Constraint via Trigger: `briefing_date > created_at::date` (mindestens Vortag-Regel auf DB-Ebene).
- Index `(tenant_id, briefing_date)`.

Neue Tabelle `daily_briefing_reads`:
- `briefing_id uuid fk`, `user_id uuid`, `read_at timestamptz default now()`, PK `(briefing_id, user_id)`.

**RLS**:
- `daily_briefings` SELECT: Tenant-Mitglieder.
- INSERT/UPDATE/DELETE: nur `author_id = auth.uid()` UND Tenant-Mitglied. UPDATE zusätzlich nur solange `briefing_date >= current_date`.
- `daily_briefing_reads`: nur eigene Reads (user_id = auth.uid()).

### Frontend

**Neue Hooks** (`src/features/briefings/hooks/`):
- `useTodayBriefings()` – lädt für aktuellen Tenant alle Briefings mit `briefing_date = today AND created_at::date < today`, joined Autor-Profile + eigene Read-Status.
- `useMyDraftBriefing(targetDate)` – lädt/legt eigenes Briefing für Zieltag an.
- `useMarkBriefingRead()`.

**Neue Komponenten** (`src/features/briefings/components/`):
- `BriefingComposerCard.tsx` – Mitarbeiter-Kachel mit Datepicker (min = morgen/nächster Werktag), Textarea, Speichern/Verwerfen, Status-Badge („Geplant für Mi, 24.4.").
- `TodayBriefingPanel.tsx` – Abgeordneten-Kachel; Liste der heute gültigen Briefings mit „Gelesen"-Toggle und kollabierbarem Inhalt.

**Integration in `MyWorkDashboardTab.tsx`**:
- Über dem bestehenden 3-Spalten-Grid eine zusätzliche Zeile:
  - **Wenn `isAbgeordneter`** → `<TodayBriefingPanel/>` (rendert nichts bei leerer Liste).
  - **Wenn Mitarbeiter/Büroleitung/Praktikant** → `<BriefingComposerCard/>` (kompakt, ein-/ausklappbar, default eingeklappt mit Button „Tagesbriefing schreiben").
- Rolle wird über bereits vorhandenes `getRoleFlags`/Role-Hook bezogen.

### Out of Scope (bewusst)

- Empfänger-Auswahl, Anhänge, Mentions, Verlinkung zu Dossiers/Terminen → Phase 2.
- Push/E-Mail-Benachrichtigung → Phase 2.
- Mobile-App-Integration → später.

### Technische Dateien

- **Migration**: `daily_briefings`, `daily_briefing_reads`, Trigger, RLS-Policies.
- **Neu**: `src/features/briefings/{types.ts, hooks/useTodayBriefings.ts, hooks/useMyDraftBriefing.ts, hooks/useMarkBriefingRead.ts, components/BriefingComposerCard.tsx, components/TodayBriefingPanel.tsx, index.ts}`.
- **Edit**: `src/components/my-work/MyWorkDashboardTab.tsx` (rollenbasierte Einblendung der neuen Sektion).

