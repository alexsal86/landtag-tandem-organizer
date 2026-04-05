

# 4 Verbesserungen: Dashboard, Kürzlich besucht, Task-Linien, Badge-Punkte

## 1. "Keine Termine heute" immer mit Icon anzeigen

**Problem**: Wenn heute keine Termine sind aber morgen schon, wird nur eine blaue Info-Box gezeigt ("Heute stehen keine Termine mehr an"), ohne das CalendarX2-Icon. Das Icon erscheint nur, wenn auch morgen keine Termine sind.

**Lösung** in `src/components/my-work/MyWorkDashboardAppointments.tsx`:
- Die CalendarX2-Leerstate-Karte ("Keine Termine heute") immer anzeigen, wenn `isShowingTomorrow` true ist — unabhängig davon, ob morgen Termine existieren
- Falls morgen Termine vorhanden: Darunter die Termin-Liste mit dem Hinweis "Morgen:" als Überschrift anzeigen
- Die doppelte blaue Info-Box (Zeile 238-251) durch die hübschere Icon-Karte ersetzen, die den Text situationsabhängig anpasst

**Ergebnis**: "Keine Termine heute" wird immer mit CalendarX2-Icon dargestellt. Morgen-Termine erscheinen darunter als separate Liste mit Kennzeichnung.

---

## 2. Kürzlich besucht um Planungen, Fallakten, Dossiers und Dokumente erweitern

**Problem**: `trackVisit()` wird nur für Navigations-Menüpunkte aufgerufen (Zeile 286-289 in AppNavigation.tsx). Besuche von Detail-Seiten wie Veranstaltungsplanungen, Terminplanungen, Fallakten-Details, Dossier-Einträge und Dokumente werden nicht erfasst.

**Lösung**:
- In den relevanten Detail-Komponenten `trackVisit` aufrufen, wenn eine Detailseite geöffnet wird. Dafür muss `trackVisit` aus `useRecentlyVisited` an den passenden Stellen eingebunden werden:
  - **Veranstaltungsplanung**: Beim Öffnen einer Planung den Titel tracken (z.B. in der EventPlanning-Detailansicht)
  - **Terminplanung**: Beim Öffnen eines Terminplanungs-Eintrags
  - **Fallakten**: Beim Öffnen einer Fallakte im Detail
  - **Dossiers**: Beim Öffnen eines Dossier-Eintrags
  - **Dokumente**: Beim Öffnen/Bearbeiten eines Dokuments

- `useRecentlyVisited` als Singleton/Context verwenden oder als globale Funktion exportieren, damit Detail-Komponenten darauf zugreifen können, ohne dass `trackVisit` als Prop durchgereicht werden muss

**Betroffene Dateien**: 
- `src/hooks/useRecentlyVisited.ts` — Funktion als global nutzbar machen (z.B. über eine standalone `trackPageVisit`-Funktion, die direkt localStorage nutzt)
- Detail-Komponenten für EventPlanning, Fallakten, Dossiers, Dokumente — `trackPageVisit` aufrufen

---

## 3. Task Parent-Child Connector-Linien korrigieren

**Problem**: Die L-förmigen Verbindungslinien von Parent- zu Child-Tasks in Meine Arbeit/Aufgaben stimmen nicht. Die Referenz ist das CommentThread-Pattern in Entscheidungen.

**Aktueller Code** (`src/components/tasks/TaskCard.tsx`, Zeile 131-134):
```
CHECKBOX_SIZE = 16
CHECKBOX_CENTER = 8
CHECKBOX_TOP_IN_CARD = 14 (12 + 2)
CONNECTOR_X = 16 (CHECKBOX_CENTER + 8)
```

Die vertikale Linie startet bei `CONNECTOR_X=16`, aber der L-Connector des Child-Elements hat `width = CHECKBOX_CENTER + 4 = 12px` und startet bei `left = -(CHECKBOX_CENTER + 8) = -16px`. Das ergibt eine Diskrepanz — die horizontale Linie reicht nicht exakt bis zur vertikalen Linie.

**Referenz-Pattern** (CommentThread.tsx, Zeile 200-214):
```
AVATAR_SIZE = 24, AVATAR_CENTER = 12
Vertikale: left = AVATAR_CENTER (12px)
L-Connector: left = -(AVATAR_CENTER + 8) = -20px, width = AVATAR_CENTER + 8 - 4 = 16px
```
Hier stimmt: `-20 + 16 = -4px` → Die Linie endet 4px vor dem Element, was visuell zum Avatar-Rand passt.

**Lösung** in `src/components/tasks/TaskCard.tsx`:
- L-Connector-Breite anpassen: `width = CHECKBOX_CENTER + 8 - 4` (statt `CHECKBOX_CENTER + 4`), damit die horizontale Linie exakt an der vertikalen Linie ansetzt
- `connectorChildTargetTop` so anpassen, dass die L-Linie auf Höhe der Checkbox endet (analog zum Avatar-Center im CommentThread)
- Gleiche Korrektur in `src/components/tasks/TaskListRow.tsx`

---

## 4. Badges durch pulsierende Punkte ersetzen

**Problem**: Navigation und Quick Actions zeigen Zahlen-Badges (z.B. "3", "12"). Der User will nur kleine pulsierende Punkte ohne Zahlen.

**Lösung**:

### a) `src/components/AppNavigation.tsx`
- `renderNavItem` (Zeile 382-386): Badge-`<span>` mit Zahlen ersetzen durch kleinen pulsierenden Punkt:
  ```
  <span className="ml-auto h-2 w-2 rounded-full bg-destructive animate-pulse" />
  ```
- `renderNavGroup` (Zeile 423-427): Gleiche Änderung
- Notification-Badge am Bell-Icon (Zeile 953-957): Zahlen entfernen, nur Punkt zeigen

### b) `src/components/Navigation.tsx` 
- `NavigationBadge` durch pulsierenden Punkt ersetzen (Zeile 178-186, 244-248)
- Chat-Badge (Zeile 173-176): Bereits Punkt im collapsed-Modus, expanded-Modus ebenfalls auf Punkt umstellen

### c) `src/components/dashboard/WidgetQuickAccess.tsx`
- `NavigationBadge` (Zeile 93-97) durch pulsierenden Punkt ersetzen

### d) Optional: `NavigationBadge`-Komponente vereinfachen oder durch eine `NotificationDot`-Komponente ersetzen

**Ergebnis**: Überall nur noch dezente pulsierende Punkte statt Zahlen-Badges.

---

## Betroffene Dateien (Zusammenfassung)
1. `src/components/my-work/MyWorkDashboardAppointments.tsx`
2. `src/hooks/useRecentlyVisited.ts`
3. Diverse Detail-Komponenten (EventPlanning, Fallakten, Dossiers, Dokumente)
4. `src/components/tasks/TaskCard.tsx`
5. `src/components/tasks/TaskListRow.tsx`
6. `src/components/AppNavigation.tsx`
7. `src/components/Navigation.tsx`
8. `src/components/dashboard/WidgetQuickAccess.tsx`

