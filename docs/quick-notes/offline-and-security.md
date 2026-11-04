# Quick Notes: storage, synchronization and tenant boundaries

## Behavior

- TanStack Query shares a cache keyed by authenticated user and selected tenant.
  `list_quick_notes` returns the active own/shared notes and display metadata in one
  request. Metadata actions optimistically patch one cached note and roll back
  that note on failure. Realtime reads only the changed note; sharing changes,
  reconnects and explicit external refreshes revalidate access.
- Creation and text edits commit to an IndexedDB outbox before clearing the input.
  They sync on connection recovery, while the app is open, and every 30 seconds.
  This does not promise background execution after the browser has closed.
- Each operation has a stable UUID and a database receipt. A transaction records
  the receipt with the write and version snapshot. Retries return the receipt;
  they cannot create duplicate notes or versions. Dependent offline edits are
  rebased only after acknowledgement, in the same IndexedDB transaction that
  removes the predecessor. Web Locks serialize synchronization across tabs.
- Every existing-note write compares its base revision. Realtime changes do not
  silently advance an open editor's base. Only this device's acknowledged causal
  writes can advance that base. Conflicts retain the local text; “Meinen Text als
  neue Notiz sichern” queues a separate copy before removing failed operations.
- The editor autosaves after 1.2 seconds of inactivity. Enter inserts a paragraph;
  Ctrl/Cmd+Enter commits locally and closes the editor. Local drafts preserve the
  base revision across reloads. Legacy drafts without a revision can be rescued
  as a new note, rather than silently overwriting current server content.
- New checklist nodes use Lexical CheckListPlugin and structured list HTML.
  Existing `[ ]` / `[x]` notes remain readable and are converted on editor import.
  Data attributes preserve list type across HTML sanitization.
- Notes unchanged for strictly more than 30 days are marked and can be archived
  directly, with undo. Future scheduled follow-ups and pending local writes are
  excluded from cleanup suggestions. Nothing is automatically archived.

## Offline application shell

The existing unified push/COI service worker also caches the public application
shell. The build plugin emits a versioned asset list for the entry and notes
route. Other public hashed assets are cached when used. API responses, notes,
tokens and cross-origin responses never enter Cache Storage. Notes are kept in
user/tenant-scoped IndexedDB; authentication remains managed by Supabase.

Offline reload requires a prior successful online visit that installed the shell
and an existing sign-in. It does not bypass login or allow a new sign-in without
network access. Tenant metadata uses a previously verified, user-scoped snapshot
while offline and is revalidated on reconnect. The server rechecks membership,
actor identity, sharing permissions and revisions for every queued write. A
revocation while disconnected cannot retract a local copy already on the device;
on confirmed authorization failure the server-content snapshot is removed, while
unsynced local work remains recoverable. Clearing browser site data removes local
copies and unsynced work.

## Migration and rollout

Apply `20261104120000_delete_quick_note_with_links_atomically.sql`, then
`20261104220000_quick_notes_tenants_and_sync.sql` before deploying the new client.
There is no client fallback to the old unscoped query or write path. Deploy the
new mobile client as well; mobile note entry points now supply their tenant.

The migration derives an existing note's tenant from a single consistent linked
record tenant, then the existing profile tenant, then an unambiguous single
active membership. It never chooses an arbitrary tenant for a multi-tenant user.
The backfill preserves existing edit timestamps for the 30-day review.
Unresolvable notes are retained with NULL tenant and hidden by restrictive RLS;
the migration emits a count warning. Existing invalid/ambiguous global grants are
also retained but inaccessible. Review and map these as an administrator before
considering the migration complete:

```sql
select id, user_id, task_id, meeting_id, decision_id, case_item_id, topic_backlog_id
from public.quick_notes where tenant_id is null;
select id, user_id, shared_with_user_id
from public.quick_note_global_shares where tenant_id is null;
```

For an unresolved note, verify its intended tenant and all linked records, then
assign `tenant_id` with an administrative migration/service role. Do not bulk map
to “the first tenant”. Recreate invalid global grants only after both parties'
active membership and the intended workspace are confirmed.

Restrictive note RLS also constrains older meeting/public-meeting policies.
Owner and tenant cannot be reassigned by clients; shared editors can change only
content and colors, and meeting participants only the meeting result. Related
objects must belong to the same tenant. Shares and versions derive and validate
their tenant server-side. Old unrestricted share helper RPCs are restricted to
the caller. Row-level policies remain authoritative even when a client omits a
filter. The delete-with-links RPC remains atomic and honors these policies.

## Verification

```sh
node node_modules/vitest/vitest.mjs run src/features/quick-notes src/hooks/useQuickNoteDraft.test.tsx src/hooks/useQuickNotes.delete.test.tsx src/components/my-work/MyWorkQuickCapture.test.tsx src/components/shared/quickNoteBoard.test.ts
```

The database harness uses a temporary PGlite database with real RLS, transactions,
triggers and separate actors. The browser harness uses real Chromium IndexedDB
and service workers. Both accept an external module path so they can run without
adding production dependencies:

```sh
npm install --prefix /tmp/notes-db @electric-sql/pglite
node scripts/verify-quick-notes-db.mjs /tmp/notes-db/node_modules/@electric-sql/pglite/dist/index.js
# With Playwright and Chromium installed locally:
QUICK_NOTES_CHROMIUM=/usr/bin/chromium node scripts/verify-quick-notes-browser.mjs /path/to/playwright/index.mjs
```
