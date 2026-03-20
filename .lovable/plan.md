

## Plan: Fix Case Files Not Loading on Akten Page

### Problem Analysis

Two separate issues are reported:
1. **Meine Arbeit/Vorgänge**: Error appears but case files still display — uses `useCaseWorkspaceData` which queries `case_files` table directly
2. **Akten page (`/?section=casefiles`)**: No case files at all — uses `useCaseFiles` which calls the `get_case_files_with_counts` RPC

The RPC function, database data, and hook code all appear structurally correct. Without console logs or network requests visible, the most likely cause is a **silent runtime error** being swallowed by the catch block (which shows a toast but leaves `caseFiles` as `[]`).

### Root Cause Candidates

1. **RPC may be failing silently** — the catch block shows a toast ("Fallakten konnten nicht geladen werden") but the user may not notice it among other toasts
2. **`useDocumentsData` fix side-effect** — the `document_folders` select is now missing `color`, `icon`, `user_id`, and `updated_at` columns that the `DocumentFolder` type expects. While this uses `as` cast, downstream code accessing `folder.color` or `folder.icon` could cause undefined-related crashes in shared layout components
3. **Race condition** — `useAuth` or `useTenant` may return null briefly, causing the early return to fire and `setLoading(false)` before the context is ready

### Plan

#### Step 1: Fix `useDocumentsData` incomplete select (potential cascade fix)
The `document_folders` select is missing columns used by the UI (`color`, `icon`, `user_id`, `updated_at`). Add these back to prevent undefined access errors in shared components.

**File**: `src/components/documents/hooks/useDocumentsData.ts`
- Change select from: `'id, name, description, parent_folder_id, order_index, tenant_id, created_at'`
- To: `'id, name, description, parent_folder_id, order_index, tenant_id, created_at, updated_at, user_id, color, icon'`

#### Step 2: Add robust error logging to `useCaseFiles`
Replace `debugConsole.error` with explicit `console.error` in the catch block so errors are always visible. Add a `console.log` at mount time to confirm the hook is executing.

**File**: `src/features/cases/files/hooks/useCaseFiles.tsx`
- Ensure `fetchCaseFiles` logs both entry and any errors with `console.error` (not `debugConsole`)

#### Step 3: Add defensive guard for loading state
Ensure the hook doesn't permanently stay in `loading: true` if the context arrives late — add a re-fetch trigger when `user`/`currentTenant` transition from null to defined.

**File**: `src/features/cases/files/hooks/useCaseFiles.tsx` — already handled by `useEffect([fetchCaseFiles])`, but verify the `useCallback` deps don't prevent re-execution.

### Technical Details

- The `useCaseFiles` hook's `fetchCaseFiles` depends on `[user, currentTenant, toast]`. When `user` or `currentTenant` change from null → defined, the callback identity changes, triggering the `useEffect`. This is correct.
- The `document_folders` missing columns are the most likely cascade cause — if any component tries to render `folder.color` or `folder.icon` before the Akten page loads, it could crash a shared parent.
- All changes are additive/safe — no schema or RPC modifications needed.

