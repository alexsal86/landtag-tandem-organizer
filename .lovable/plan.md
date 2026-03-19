

## Problem Analysis

Four issues with the calendar view:

### 1. New appointments not showing immediately
After creating an appointment, `useCreateAppointment.ts` navigates to `/calendar` but never invalidates the `calendar-data` React Query cache. The cache has a 5-minute `staleTime`, so the new appointment won't appear until a manual refresh.

**Fix**: In `useCreateAppointment.ts`, use `useQueryClient` to invalidate the `calendar-data` queries after successful creation.

### 2. First day column (Monday) shifted left
The spacer column CSS (lines 299-303 in `react-big-calendar.css`) applies `margin-left: -8px` to the first day column after the gutter spacer. This causes events in the Monday column to appear shifted.

**Fix**: Review and adjust the margin/padding on `.rbc-time-content > .rbc-time-gutter-spacer-column + .rbc-day-slot.rbc-time-column` so events align properly. The all-day row also has a similar offset (lines 226-229) that needs to match.

### 3. Header row misaligned with day columns
The sticky header (`.rbc-time-header`) doesn't account for the 8px spacer column that exists in `.rbc-time-content`. The day headers are therefore offset from their corresponding columns below.

**Fix**: Add matching left-margin/padding to the header's content area (`.rbc-time-header-content` or `.rbc-row.rbc-time-header-cell`) so headers align with the columns that include the spacer offset.

### 4. Month view events not visible
The month view cells have `min-height: 80px` and events use `overflow: hidden` with `text-overflow: ellipsis`, but the row content area likely clips events. The `.rbc-month-row` and `.rbc-row-content` need to allow overflow or have sufficient height.

**Fix**: Adjust `.rbc-month-row` and `.rbc-row-content` CSS to ensure events are visible within cells. May need to increase row height or fix overflow settings.

## Files to Change

1. **`src/components/appointments/hooks/useCreateAppointment.ts`** — Add `useQueryClient` and call `queryClient.invalidateQueries({ queryKey: ["calendar-data"] })` after successful appointment creation (before `onOpenChange(false)`).

2. **`src/styles/react-big-calendar.css`** — Fix three CSS issues:
   - Adjust first-day-column margin to prevent Monday shift
   - Add header offset to match the spacer column alignment
   - Fix month view row/event overflow so events are visible

