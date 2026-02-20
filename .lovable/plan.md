
# Plan: 6 Änderungen in Meine Arbeit, Kalender und Kontakte

## Überblick der 6 Punkte

| Punkt | Bereich | Datei(en) |
|-------|---------|-----------|
| 1 | "Rückmeldungen"-Tab vereint Feedback + Feed | `MyWorkView.tsx`, `MyWorkFeedbackFeedTab.tsx` |
| 2 | Feed auf letzte 7 Tage begrenzen | `useTeamFeedbackFeed.ts` |
| 3 | Kalender-Details links, Inhalt nach rechts | `CalendarView.tsx` |
| 4 | Kontakte-Details links (analog zu Kalender) | `ContactsView.tsx` |
| 5 | Tab-Reihenfolge tauschen (Rückmeldungen vor Team) | `MyWorkView.tsx` |
| 6 | Team-Tab: nur Benachrichtigungs-Badge | `MyWorkView.tsx` |

---

## Punkt 1: "Rückmeldungen"-Tab vereint Termine Feedback (links) + Feed (rechts)

**Aktuell:** Zwei separate Tabs – `appointmentfeedback` (nur Abgeordneter) und `feedbackfeed` (alle).

**Neu:** Ein einziger Tab namens "Rückmeldungen", der für den Abgeordneten ein 2-Spalten-Layout zeigt. Für alle anderen (Mitarbeiter, Büroleitung) wird nur die rechte Spalte (Feed) angezeigt.

```
Abgeordneter (2 Spalten):
┌──────────────────────┬──────────────────────┐
│  Termine Feedback    │  Team-Rückmeldungen  │
│  (nur für ihn)       │  (alle sehen das)    │
│  AppointmentFeedback │  FeedbackFeed        │
│  Widget              │  letzte 7 Tage       │
└──────────────────────┴──────────────────────┘

Mitarbeiter (1 Spalte):
┌───────────────────────────────────────────────┐
│  Team-Rückmeldungen (letzte 7 Tage)           │
│  FeedbackFeed                                 │
└───────────────────────────────────────────────┘
```

**Technische Umsetzung:**
- `MyWorkView.tsx`: Tab `appointmentfeedback` wird entfernt. Tab `feedbackfeed` wird umbenannt zu "Rückmeldungen" (bleibt `feedbackfeed` als URL-Wert).
- `MyWorkView.tsx`: Der Tab-Content-Block für `feedbackfeed` rendert nun:
  ```tsx
  {activeTab === "feedbackfeed" && (
    isAbgeordneter
      ? <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MyWorkAppointmentFeedbackTab />
          <MyWorkFeedbackFeedTab />
        </div>
      : <MyWorkFeedbackFeedTab />
  )}
  ```
- `MyWorkFeedbackFeedTab.tsx`: Leichte Beschriftungsanpassung – macht klar, dass es sich um den "Team-Feed" handelt.
- Der alte `appointmentfeedback`-Tab (inkl. Tabkonfiguration mit `abgeordneterOnly`) wird aus `BASE_TABS` entfernt.

---

## Punkt 2: Feed auf letzte 7 Tage begrenzen + Hinweis

**`useTeamFeedbackFeed.ts`:** Filterung auf letzte 7 Tage durch `.gte('completed_at', sevenDaysAgo)` hinzufügen:
```ts
const sevenDaysAgo = subDays(new Date(), 7).toISOString();
// In der Query:
.gte('completed_at', sevenDaysAgo)
.limit(30) // bleibt als Sicherheitslimit
```

**`MyWorkFeedbackFeedTab.tsx`:** Hinweis in der Beschreibung ergänzen:
> *"Rückmeldungen der letzten 7 Tage werden angezeigt."*

---

## Punkt 3: Kalender – Details erscheinen links, Inhalt schiebt nach rechts

**Aktuell:** Das Detail-Panel erscheint rechts neben dem Kalender (`ml-4`).

**Gewünschtes Verhalten:** Das Detail-Panel soll links erscheinen, als würde es aus der Navigation "herausgleiten". Der Kalender-Header (Terminkalender-Titel, Datum-Navigation, Ansichts-Buttons) bleibt oben. Das Submenü (sofern vorhanden) bleibt unverändert. Nur der Kalender-Grid selbst schiebt nach rechts.

**Technische Umsetzung in `CalendarView.tsx`:**

Der Flex-Container bei Zeile 1142 wird umgeordnet: Das Detail-Panel kommt **vor** dem Hauptkalender in der DOM-Reihenfolge. Mit `flex-row-reverse` wäre das Layout optisch falsch – stattdessen wird die Reihenfolge im JSX einfach umgedreht:

```tsx
{/* Calendar Content - split layout when sidebar open */}
<div className="flex gap-0 transition-all duration-300">

  {/* Inline Detail Panel – jetzt LINKS */}
  {sidebarOpen && selectedAppointment && (
    <div className="w-[420px] shrink-0 border border-border rounded-lg mr-4 overflow-hidden"
         style={{ height: 'calc(600px + 57px)' }}>
      <AppointmentDetailsSidebar ... />
    </div>
  )}

  {/* Main Calendar – schiebt nach rechts */}
  <div className="flex-1 min-w-0 transition-all duration-300">
    <Card ...>
      ...
    </Card>
  </div>

</div>
```

Das Submenü (Header mit Navigationsbuttons, Datumsauswahl, Ansichtsauswahl bei Zeilen 1066–1140) liegt **außerhalb** des Flex-Containers und bleibt unverändert. Nur der Flex-Container (Kalender-Grid + Detail-Panel) ändert die Reihenfolge.

**Ergebnis:** Wenn ein Termin angeklickt wird, schiebt das Detail-Panel von links ein und der Kalender-Grid weicht nach rechts – analog zum Verhalten in Verwaltungsansichten.

---

## Punkt 4: Kontakte – Details erscheinen links (analog Kalender)

**Aktuell:** Das `ContactDetailPanel` erscheint rechts neben der Kontaktliste (`w-3/5` mit `border-l`).

**Gewünschtes Verhalten:** Gleiches Prinzip wie Kalender – Details links, Liste rechts.

**Technische Umsetzung in `ContactsView.tsx`:**

Die aktuelle Struktur (Zeilen 414–1358) hat bereits einen äußeren `flex`-Container:
```tsx
<div className="flex h-[calc(100vh-3.5rem)]">
  {/* Left: Contact List */}
  <div className={cn("flex-1 overflow-y-auto ...", ...)}>
    ...Kontaktliste...
  </div>

  {/* Right: Contact Detail Panel */}
  {selectedContactId && !isSheetOpen && (
    <div className="w-full md:w-3/5 lg:w-3/5 border-l ...">
      <ContactDetailPanel ... />
    </div>
  )}
</div>
```

**Änderung:** Das `ContactDetailPanel` wird **vor** der Kontaktliste in der DOM-Reihenfolge platziert. Das Panel erhält `border-r` statt `border-l`. Die Kontaktliste behält `flex-1`.

```tsx
<div className="flex h-[calc(100vh-3.5rem)]">

  {/* Left: Contact Detail Panel – jetzt LINKS */}
  {selectedContactId && !isSheetOpen && (
    <div className="w-full md:w-2/5 lg:w-2/5 border-r border-border overflow-hidden bg-background">
      <ContactDetailPanel ... />
    </div>
  )}

  {/* Right: Contact List – schiebt nach rechts */}
  <div className={cn(
    "flex-1 overflow-y-auto transition-all",
    selectedContactId && !isSheetOpen ? "hidden md:block" : "w-full"
  )}>
    ...Kontaktliste...
  </div>

</div>
```

**Ergebnis:** Klick auf Kontakt → Details erscheinen links, Liste schiebt nach rechts. Identisches Muster wie Kalender.

---

## Punkt 5: Tab-Reihenfolge tauschen

**Aktuell in `BASE_TABS` (Zeilen 57–69 in `MyWorkView.tsx`):**
```
... | team | appointmentfeedback | feedbackfeed
```

**Neu (nach den Änderungen aus Punkt 1 und 5):**
```
... | feedbackfeed (jetzt "Rückmeldungen") | team
```

Der `feedbackfeed`-Tab (der nun beide Komponenten enthält) kommt **vor** dem `team`-Tab. Das ist eine einfache Umsortierung der Array-Einträge in `BASE_TABS`.

---

## Punkt 6: Team-Tab zeigt nur neue Benachrichtigungen

**Problem:** Der Team-Tab zählt aktuell `(requestCount || 0) + warningCount` – also Anzahl offener Meeting-Requests + Mitarbeiter ohne Zeiteintrag. Das ist kein reines Benachrichtigungs-Badge.

**Gewünschtes Verhalten:** Nur *neue* (ungelesene) Benachrichtigungen sollen das Badge befüllen – analog zu den anderen Tabs im `new`-Modus.

**Technische Umsetzung:**

In `MyWorkView.tsx`, `getDisplayCount()` für das Team-Tab (Zeilen 462–465):
```tsx
// Team tab always shows total (no "new" logic for team)
if (tab.countKey === 'team') {
  return totalCounts.team;
}
```

Diesen Block ändern auf:
```tsx
if (tab.countKey === 'team') {
  // Zeige nur ungelesene Benachrichtigungen aus dem Notifications-System
  return newCounts.team || 0; // neu: über newCounts
}
```

Dafür muss `NewCounts` in `useMyWorkNewCounts.tsx` um ein `team`-Feld erweitert werden:
```ts
export interface NewCounts {
  tasks: number; decisions: number; jourFixe: number;
  caseFiles: number; plannings: number;
  team: number; // NEU
}
```

Die `loadNewCounts`-Funktion berechnet dann:
```ts
// Ungelesene Benachrichtigungen für den User (Typ: team-relevant)
const { count: unreadNotifCount } = await supabase
  .from('notifications')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', user.id)
  .eq('is_read', false)
  .gt('created_at', teamLastVisit);
```

Und in `loadCounts` (MyWorkView) wird die aufwändige `teamCount`-Berechnung (Requests + Warnings) **entfernt** – das Badge ist jetzt vollständig an das Benachrichtigungssystem delegiert.

---

## Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/MyWorkView.tsx` | Tab `appointmentfeedback` entfernen; `feedbackfeed` umbenennen; 2-Spalten-Layout für Abgeordneter; Tab-Reihenfolge; Team-Badge-Logik vereinfachen |
| `src/components/my-work/MyWorkFeedbackFeedTab.tsx` | 7-Tage-Hinweis in Beschreibung ergänzen |
| `src/hooks/useTeamFeedbackFeed.ts` | `.gte('completed_at', sevenDaysAgo)` ergänzen |
| `src/hooks/useMyWorkNewCounts.tsx` | `team`-Feld zu `NewCounts` + `loadNewCounts` hinzufügen |
| `src/components/CalendarView.tsx` | Detail-Panel vor Kalender in DOM; `mr-4` statt `ml-4` |
| `src/components/ContactsView.tsx` | Detail-Panel vor Kontaktliste; `border-r` statt `border-l` |
