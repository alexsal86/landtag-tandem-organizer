## Umbau News-Widget im Dashboard

### Befund

- **Datei:** `src/components/widgets/NewsWidget.tsx`, Compact-Variante (Zeilen 138–212).
- Verwendet auf dem Dashboard via `MyWorkDashboardTab.tsx → NewsWidgetCard → <NewsWidget compact />`. Die Karte trägt bereits Titel + Newspaper-Icon (im äußeren `DashboardWidgetContainer`), also kein Header-Eingriff nötig.
- Aktuell: 2-Spalten-Grid mit gestrichelten Trennern, Datum als `dd. MMM`, Quelle in Primary, Hover-Buttons Share/Task. Keine Subline „Landespolitik BW" — diese existiert im Code nicht und muss daher auch nirgends entfernt werden (war im Mockup nur dekorativ).

### Designvorlage (image-97.png)

- **Einspaltige Liste**, jede Meldung durch dünne `border-b` getrennt.
- Pro Meldung Block aus zwei Zeilen:
  1. Meta-Zeile: `<Quelle>` in **bold + primary-Grün** mit Mono-Font · `<Uhrzeit>` (`HH:MM` für heute, sonst `gestern`/`dd.MM.`) in `text-muted-foreground` Mono.
  2. Titel in normalem `text-foreground`, Größe `text-sm`/`text-[15px]`, `line-clamp-2`.
- **Keine** Kategorie-/Quelle-Sublabels wie „Landespolitik BW".
- Grünton: bestehender Design-Token `--primary` (`#57ab27`) — passt automatisch ins Branding (Light + Dark Mode).

### Änderungen

**Nur** `src/components/widgets/NewsWidget.tsx`, `compact`-Branch (Zeilen 138–212):

1. Grid-Layout (`grid-cols-2` + `getCompactItemClasses` mit `border-r`) ersetzen durch eine einfache `divide-y divide-border` Liste — keine vertikalen Trenner mehr, keine alternierenden Zellen.
2. Pro Article (`filteredArticles.slice(0, 6)` statt 8 — passt visuell besser für die 1-spaltige Variante):
   - Wrapper: `group cursor-pointer py-3 first:pt-0 last:pb-0 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors`.
   - Meta-Zeile (oben): `<span class="font-mono text-xs font-bold text-primary">{source}</span>` · `<span class="font-mono text-xs text-muted-foreground">{relativeTime}</span>`.
   - Titel: `<p class="mt-1 text-[15px] leading-snug text-foreground line-clamp-2">{decodeHtmlEntities(title)}</p>`.
   - Action-Buttons (Share/Task) bleiben erhalten, rutschen rechts in die Meta-Zeile, weiterhin `opacity-0 group-hover:opacity-100`.
3. Neue kleine Helper-Funktion `formatRelativeTime(pub_date)`:
   - Heute → `HH:MM` (z. B. `08:24`).
   - Gestern → `'gestern'`.
   - Älter → `dd.MM.`.
   Lokal in der Datei, keine Hook-Dateien anfassen.
4. `getCompactItemClasses` entfernen (wird ersatzlos überflüssig).
5. Nicht-`compact` Variante (volle Card ab Zeile 214) bleibt unverändert.

### Nicht betroffen

- `MyWorkDashboardTab.tsx` (Header bleibt: Newspaper-Icon + „News").
- Datenfluss / `fetch-rss-feeds` / RLS / Tenant.
- Andere News-Konsumenten (`DashboardWidget`, `CustomizableDashboard`, `WidgetQuickAccess`) — sie nutzen die Nicht-Compact-Variante.

### Verifikation

- Dashboard `/mywork` zeigt News einspaltig mit dünnen horizontalen Trennern.
- Quelle in primary-Grün und Mono, Zeit daneben, Titel darunter.
- Hover zeigt Share + Task-Buttons rechts in der Meta-Zeile.
- Keine Spur von „Landespolitik BW" oder Kategorie-Badges in der Compact-Ansicht.

### Betroffene Dateien

- `src/components/widgets/NewsWidget.tsx` (nur compact-Branch, ~50 Zeilen)
