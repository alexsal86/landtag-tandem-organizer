

## Analysis & Plan

### Bug 1: Systempunkt-Erstellung schlägt fehl

**Root Cause**: The `event_planning_item_actions` table has RLS INSERT policy that checks `user_tenant_memberships`, while the `event_planning_checklist_items` table uses a different RLS approach (owner/collaborator check). When the checklist item insert succeeds but the action insert hits a tenant-based RLS wall, the catch block at line 194-199 fires:
- It deletes the checklist item (line 196)
- Shows the error toast "Systempunkt konnte nicht vollständig angelegt werden"
- But does **NOT** clean up the `topic_backlog` and `social_content_items` entries — which is why the Social Planner item persists

**Fix**:
1. Align the `event_planning_item_actions` INSERT RLS policy to use the same owner/collaborator pattern as `event_planning_checklist_items`, OR add cleanup for `topic_backlog` and `social_content_items` in the catch block
2. Best approach: Update the RLS policy AND add cleanup as a safety net
3. Add rollback logic in the catch block to delete `topic_backlog` and `social_content_items` entries when the action insert fails

### Bug 2: Build Error — `TimelineAssignment` type mismatch

`PlanningTimelineSection.tsx` passes `EventPlanningTimelineAssignment[]` (with `checklist_item_id`) to `useTimelineGeometry`, which expects `TimelineAssignment[]` (with `checklistItemId`). Fix: update `useTimelineGeometry`'s `TimelineAssignment` type to use `checklist_item_id` instead, or map the data before passing.

### Bug 3: Build Errors in test files

- `generate-calendar-invite.utils.test.ts` and `sync-external-calendar.utils.test.ts` use `vitest` imports but run in Deno context. Fix: switch to Deno-compatible test imports or add `.ts` extension to imports.
- `sync-external-calendar.utils.test.ts` has implicit `any` on `item` parameter — add explicit type.
- `run-automation-rule/index.ts` references `npm:resend@2.0.0` — needs `deno.json` or import map entry.

### Feature: RSVP-Systempunkt für Checkliste

Add a new system point type `system_rsvp` that:
1. Adds a new option `rsvp` to `SYSTEM_POINT_OPTIONS` in `useChecklistOperations.ts`
2. When selected, checks if the event has RSVP guests (`event_rsvps` table)
3. Creates a checklist item linked to the RSVP system
4. Creates an `event_planning_item_actions` entry with `action_type: "rsvp"` and config pointing to the RSVP manager
5. Automatically creates a timeline assignment when invitations are sent (via a check on `invitation_sent` status in `event_rsvps`)
6. The UI for the system point selector needs to show the RSVP option alongside the existing Social Media option
7. The checklist item detail view needs to render the RSVP action link/status

**Files to modify**:
- `supabase/migrations/` — new migration to fix `event_planning_item_actions` RLS policy
- `src/components/event-planning/hooks/useChecklistOperations.ts` — fix cleanup, add RSVP system point
- `src/components/event-planning/useTimelineGeometry.ts` — fix `TimelineAssignment` type
- `supabase/functions/generate-calendar-invite/generate-calendar-invite.utils.test.ts` — fix import
- `supabase/functions/sync-external-calendar/sync-external-calendar.utils.test.ts` — fix import + type
- `src/components/event-planning/useEventPlanningData.ts` — handle RSVP action type in `fetchEmailActions`
- Checklist UI component — render RSVP system point option and action display

