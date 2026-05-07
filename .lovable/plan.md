# Dashboard-Anpassungen

## 1. Layout umbauen (`MyWorkDashboardTab.tsx`)

Neue Spaltenaufteilung (3 Spalten, items-start):

- **Linke Spalte:** Fristen → darunter Entscheidungen
- **Mittlere Spalte:** Termine heute/morgen
- **Rechte Spalte:** Jour fixe → darunter News

## 2. Fristen kompakter & paginiert (`DashboardTasksSection.tsx`)

- Pro Gruppe (Überfällig, Heute, Diese Woche, Später) initial **max. 5 Einträge**.
- Wenn mehr vorhanden: Button „+N weitere anzeigen" am Ende der Gruppe; Klick erhöht den Sichtbarkeits-Counter dieser Gruppe um 5 (lokaler `useState<Record<groupKey, number>>`).
- Vertikale Abstände reduzieren: `py-3` → `py-1.5`, Bar-Position entsprechend anpassen, Gruppentitel-Margin `mt-4` → `mt-3`.
- Titel-Zeile: `font-semibold` → `font-medium` (Titel bleibt klar, wirkt aber leichter); Meta-Zeile bleibt `text-xs text-muted-foreground`, zusätzlich `opacity` belassen — Schrift unter Titel wird durch reduzierten Kontrast (muted-foreground bleibt, aber kein font-weight) grauer wirken. Falls nötig zusätzlich `text-muted-foreground/80`.
- „Heute"/„Diese Woche" werden nicht mehr collapsible behandelt — nur „Später" bleibt collapsible (wie zuvor), innerhalb davon ebenfalls 5er-Pagination.

## 3. Entscheidungen-Widget: Undo-Fenster verlängern/sicherstellen (`DashboardDecisionsWidget.tsx`)

Aktuell: Nach Klick auf Ja/Nein/Frage erscheint Prompt mit Undo. Nach 10 s wird `loadDecisions({ silent: true })` aufgerufen — dadurch verschwindet der Eintrag (da `hasResponded=true`) und Undo ist nicht mehr möglich. Ergebnis bleibt erhalten.

Fix:
- Auto-Refresh-Timer entfernen bzw. nur Prompt schließen, **Refresh erst beim nächsten manuellen Trigger / beim Verlassen / beim Öffnen** durchführen.
- Konkret: Nach Submit Prompt einblenden; Timeout schließt nur den Prompt-State (nicht den Eintrag) und ruft **kein** `loadDecisions` auf. Undo bleibt über die direkte Aktion „Rückgängig" so lange möglich, wie der Eintrag in der Liste sichtbar ist.
- Da der Eintrag nach Submit `hasResponded=true` ist (durch Realtime/Reload), würde er beim nächsten Daten-Refresh verschwinden. Lösung: Lokales Set `recentlyAnswered` pro DecisionRow; solange Prompt offen ODER Row im Set ist, Eintrag in der Liste behalten und Undo-Button anzeigen, auch wenn Antwort gespeichert ist.
- Ein expliziter „Fertig"-Button im Prompt schließt Prompt + entfernt Eintrag aus `recentlyAnswered` → nächste Datenladung versteckt ihn.

## Technische Details

- `DashboardTasksSection`: ersetze `showLater` durch `visibleCounts: Record<'overdue'|'today'|'thisWeek'|'later', number>` mit Default 5; Helper `renderGroup(key, label, list, labelClass)` slict `list.slice(0, visibleCounts[key])` und rendert „+N weitere" wenn `list.length > visible`.
- Spacing: `py-1.5 pl-3 pr-2`, Bar `top-1.5 bottom-1.5`.
- Layout-Grid bleibt `lg:grid-cols-[35fr_35fr_30fr]`; nur Inhalte der Spalten umsortieren.
- Decisions-Widget: neuer State `Set<string>` `keepVisibleIds`; `items` Memo erweitert um Decisions, deren ID in `keepVisibleIds` ist (auch wenn schon resolved/responded). Undo entfernt aus Set + ruft `loadDecisions`.
