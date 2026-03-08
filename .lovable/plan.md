

## Plan: Icons für Dashboard-Hinweise

### Überblick
Jeder Dashboard-Hinweis (SpecialDay) bekommt ein optionales `icon`-Feld mit einem Lucide-Icon-Namen. In der Administration kann man das Icon aus einer vordefinierten Auswahl wählen. Im Dashboard wird das Icon statt der Kerze 🕯️ angezeigt.

### Änderungen

**1. `src/utils/dashboard/specialDays.ts`**
- `SpecialDay`-Interface um `icon?: string` erweitern (Lucide-Icon-Name, z.B. `"Leaf"`, `"Heart"`)
- Jedem `DEFAULT_SPECIAL_DAYS`-Eintrag ein passendes Icon zuweisen:
  - Energiesparen → `Zap`, Gedenktag → `Flame`, Frauentag → `Heart`, Rassismus → `Users`, Tag der Erde → `Globe`, Befreiung → `Flag`, Europatag → `Star`, Grundgesetz → `BookOpen`, Umwelttag → `TreePine`, Antikriegstag → `Dove`/`HandHeart`, Weltkindertag → `Baby`, Deutsche Einheit → `Landmark`, Coming-out → `Rainbow`, 9. November → `Candle`, Ehrenamt → `HandHeart`, Menschenrechte → `Scale`
- `getSpecialDayHint` gibt zusätzlich das Icon zurück (Rückgabetyp ändern zu `{ text: string; icon?: string } | null`)
- `parseSpecialDaysSetting` akzeptiert `icon` als optionales Feld
- `emptyEntry()` in DashboardHintSettings bekommt `icon: 'CalendarHeart'` als Default

**2. `src/components/administration/DashboardHintSettings.tsx`**
- Grid um eine Icon-Spalte erweitern (zwischen Tag und Name)
- Select/Dropdown mit ~20 vordefinierten Lucide-Icons (Label + Icon-Preview): `Zap`, `Flame`, `Heart`, `Users`, `Globe`, `Flag`, `Star`, `BookOpen`, `TreePine`, `HandHeart`, `Baby`, `Landmark`, `Rainbow`, `Candle`, `Scale`, `CalendarHeart`, `Megaphone`, `Shield`, `Sparkles`, `Sun`
- Jeder Eintrag zeigt das gewählte Icon als Preview neben dem Select
- `normalizedEntries` im Save inkludiert `icon`

**3. `src/components/dashboard/DashboardAppointments.tsx`**
- Statt `specialDayHint` als String: Objekt mit `text` + `icon` nutzen
- Lucide-Icon dynamisch rendern via `icons[hint.icon]` aus `lucide-react`
- Fallback auf `Candle`-Icon wenn kein Icon gesetzt

**4. `src/components/dashboard/DashboardGreetingSection.tsx`**
- Gleiche Anpassung: Icon aus dem Hint-Objekt nutzen statt Emoji

**Dateien:**
- `src/utils/dashboard/specialDays.ts` — Interface + Defaults + Parser + getSpecialDayHint
- `src/components/administration/DashboardHintSettings.tsx` — Icon-Spalte mit Select
- `src/components/dashboard/DashboardAppointments.tsx` — Icon-Rendering
- `src/components/dashboard/DashboardGreetingSection.tsx` — Icon-Rendering

