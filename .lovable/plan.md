

## Plan: Fix Karten-Ansicht (6 Issues + Build Errors)

### Issues Identified

1. **Map resets zoom when interacting** — In `SimpleLeafletMap.tsx` (line 429), `zoomLevel` is a dependency of the main rendering effect. Every zoom triggers `setZoomLevel`, which re-runs the effect that calls `fitBounds`, resetting the view.

2. **Popup/info hidden behind polygons** — The Leaflet popup z-index is being overridden. The `leaflet-overrides.css` sets aggressive z-index values but the popup pane still gets clipped by polygon layers.

3. **Map disappears when no layer selected** — In `SimpleLeafletMap.tsx` lines 431-436, when `!districts.length && !showPartyAssociations`, the component returns a "no data" placeholder instead of showing the empty map. When both checkboxes are unchecked, `displayedDistricts` is empty.

4. **Show old representatives per legislature** — The `election_representatives` table has no `legislature_period` column. Need to add it and update the UI to show historical mandate holders.

5. **Verwaltungsgrenzen count mixed with Wahlkreise** — In `ElectionDistrictsView.tsx` line 86-89, filtering is correct, but in `SimpleLeafletMap.tsx` line 452, the info overlay shows `districts.length` which includes both types when both are displayed. The statistics card in `ElectionDistrictsView.tsx` correctly separates them, but the map overlay text is wrong.

6. **Verwaltungsgrenzen missing population/area data** — All 44 Verwaltungsgrenzen have `NULL` for population and area_km2. Need to populate with real data for all 44 BW Landkreise/Stadtkreise.

### Build Errors (pre-existing, unrelated to map)
- `JSX` namespace errors in 4 files — need explicit React JSX import
- `PreparationDataCards.tsx` type error — cast unknown to ReactNode
- Edge function parse errors — pre-existing, separate from this task

---

### Implementation Steps

#### Step 1: Fix zoom reset (Issue 1)
**File: `src/components/SimpleLeafletMap.tsx`**
- Remove `zoomLevel` from the main rendering effect's dependency array (line 429)
- Only call `fitBounds` on initial render or when districts data actually changes (not on zoom)
- Move marker size updates to a separate effect that only updates marker icons without clearing/re-adding all layers

#### Step 2: Fix popup z-index (Issue 2)
**File: `src/styles/leaflet-overrides.css`**
- Ensure `.leaflet-popup-pane` z-index is higher than `.leaflet-overlay-pane` (polygon pane)
- Add `.leaflet-overlay-pane { z-index: 2 !important; }` to keep polygons below popups

#### Step 3: Keep map visible when no layers selected (Issue 3)
**File: `src/components/SimpleLeafletMap.tsx`**
- Remove the early return at lines 431-436 that hides the map when no districts
- Instead, just show the empty map (tiles only) when no layers are active
- In the rendering effect (line 133-134), skip clearing/rendering if no data, but don't prevent map display

#### Step 4: Add legislature period support (Issue 4)
**Database migration:**
- Add `legislature_period` column (text, e.g. "17. Legislatur", "18. Legislatur") to `election_representatives`
- Default existing records to current legislature

**File: `src/hooks/useElectionDistricts.tsx`**
- Include `legislature_period` in representative type and query

**File: `src/components/ElectionDistrictsView.tsx`**
- Group representatives by legislature period in the sidebar info card
- Show current and historical mandate holders

#### Step 5: Separate Verwaltungsgrenzen statistics (Issue 5)
**File: `src/components/SimpleLeafletMap.tsx`**
- Update the overlay text (lines 449-453) to show election districts and Verwaltungsgrenzen counts separately
- Only count `district_type !== 'verwaltungsgrenze'` for the "Wahlkreise" label

**File: `src/components/ElectionDistrictsView.tsx`**
- Add separate statistics for Verwaltungsgrenzen (population, area) in the Statistics card

#### Step 6: Populate Verwaltungsgrenzen data (Issue 6)
- Use the Supabase insert tool to UPDATE all 44 Verwaltungsgrenzen with real population and area_km2 data from official BW statistics (Statistisches Landesamt BW, Stand 2023):
  - e.g., Stuttgart: 632,743 Einwohner, 207.35 km²
  - Karlsruhe Stadt: 313,092 Einwohner, 173.46 km²
  - All 44 Landkreise/Stadtkreise

#### Step 7: Fix build errors
- Add `import type { JSX } from 'react'` to `FloatingTextFormatToolbar.tsx`, `ComponentPickerPlugin.tsx`, `DraggableBlockPlugin.tsx`, `NotificationContext.tsx`
- Fix type cast in `PreparationDataCards.tsx`

### Technical Notes
- The zoom-reset bug is the most impactful UX issue — caused by `zoomLevel` state triggering full layer re-render
- Population/area data for BW Landkreise will be sourced from Statistisches Landesamt Baden-Württemberg (2023 figures)
- Legislature period feature requires a DB migration

