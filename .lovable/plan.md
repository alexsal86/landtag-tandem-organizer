

## Plan: Update lucide-react to Latest Version

### Current State
- `lucide-react` version: **0.544.0** (target: **latest 1.x**)
- **191 files** import from `lucide-react` — all use standard named imports (e.g. `import { Camera } from 'lucide-react'`), which will continue to work without changes
- **3 files** use `import { icons } from 'lucide-react'` (the icons object map) — these need verification

### What Changes

**Step 1: Update the package**
- Update `lucide-react` to latest version in `package.json`

**Step 2: Verify/fix `icons` object usage (3 files)**
In lucide-react 1.x, the `icons` object keys changed from PascalCase (`MapPin`) to kebab-case (`map-pin`). These files need adjustment:

1. **`src/utils/lucideIconToSvg.ts`** — uses `icons[iconName]` to dynamically render icons. Will update key lookup to handle the new kebab-case format.
2. **`src/components/karlsruhe/MapFlagTypeManager.tsx`** — uses `icons` for icon picker display. Will update accordingly.
3. **`src/components/karlsruhe/MapFlagLayerToggle.tsx`** — uses `icons` for rendering dynamic icons. Will update accordingly.

**Step 3: Build verification**
- Run build to catch any other breaking import issues across all 191 files

### Risk Assessment
- Standard named imports (`import { X } from 'lucide-react'`) are **not affected** — these remain the same in v1.x
- Only the dynamic `icons` object access pattern needs updating
- No icon removals expected for the icons used in this project

