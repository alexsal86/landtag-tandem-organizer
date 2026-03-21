

## Problem

The timeline uses proportional time-based spacing with `TARGET_TIMELINE_HEIGHT_PX = 560` and `MIN_ENTRY_GAP_PX = 18`. When entries are close in time (e.g. March 17 and March 18 on a timeline spanning to April 15), they get only ~19px margin — but each entry card is ~60px tall, causing visual overlap and misalignment with the "Heute" marker.

The "Heute" marker position is computed from DOM measurements (correct), but the entry spacing logic doesn't account for actual card heights.

## Solution

Replace the fixed `MIN_ENTRY_GAP_PX = 18` with a value that accounts for card height (~64px including padding/border), and increase `TARGET_TIMELINE_HEIGHT_PX` accordingly so the timeline stretches to accommodate entries without collapsing them.

### Changes in `src/components/event-planning/PlanningTimelineSection.tsx`

1. **Increase minimum gap** — Change `MIN_ENTRY_GAP_PX` from `18` to `72` (approximate card height + small gap). This ensures entries never visually overlap.

2. **Make timeline height dynamic** — Instead of a fixed `TARGET_TIMELINE_HEIGHT_PX = 560`, compute it as `Math.max(560, entries.length * 80)` so longer timelines get more room for proportional spacing.

3. **Group same-day entries** — Entries on the same date should be rendered as a stacked group with minimal internal spacing (8px), sharing a single timeline dot. This handles the "multiple events on one day" case naturally.

### Implementation detail for grouping

```text
entries grouped by date string (dd.MM.yyyy)
  ├── Group "17.03.2026" → single dot, 1 card
  ├── Group "18.03.2026" → single dot, 1 card  
  ├── Group "26.03.2026" → single dot, 2 cards stacked
  └── Group "15.04.2026" → single dot, 1 card
```

- Group entries by date (day-level, ignoring time for grouping)
- Each group gets one timeline dot and proportional spacing is computed per group, not per entry
- Within a group, entries stack vertically with 8px gap
- The "Heute" marker stays based on the full timestamp proportion, positioned between groups correctly
- `entrySpacings` computed per group using group timestamps, with `MIN_ENTRY_GAP_PX = 80` to accommodate card height

