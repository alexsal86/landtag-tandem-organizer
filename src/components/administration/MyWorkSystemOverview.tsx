import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const uiSignals = [
  {
    signal: "Tab-Icon",
    where: "Tab-Leiste › alle Tabs",
    meaning: "Semantische Orientierung pro Feature (Aufgaben, Entscheidungen etc.)",
    source: "BASE_TABS.icon",
  },
  {
    signal: "Active-State (Primary + Unterstreichung)",
    where: "Tab-Leiste",
    meaning: "Zeigt den aktuell sichtbaren Tab",
    source: "activeTab === tab.value",
  },
  {
    signal: "Badge (destructive)",
    where: "Bei `badgeDisplayMode = new` + Team immer",
    meaning: "Neue bzw. ungelesene Elemente",
    source: "newCounts + Sonderregel Team",
  },
  {
    signal: "Badge (secondary)",
    where: "Bei `badgeDisplayMode = total`",
    meaning: "Gesamtzahl offener Elemente",
    source: "totalCounts",
  },
  {
    signal: "Logo-Fallback-Icon",
    where: "Dashboard-Tab",
    meaning: "Bei ungültiger Logo-URL wird das Home-Icon gezeigt",
    source: "isTabLogoError",
  },
  {
    signal: "Versteckter Tab (role-gated)",
    where: "Time / Team / ggf. Admin-only Tabs",
    meaning: "Kein Zugriff laut Rolle",
    source: "employeeOnly / abgeordneterOrBueroOnly / adminOnly",
  },
  {
    signal: "Loading-Fallback",
    where: "Tab-Content Bereich",
    meaning: "Lazy-Tab wird geladen",
    source: "Suspense fallback",
  },
];

const decisionRows = [
  {
    signal: "Tab sichtbar?",
    condition: "role erfüllt alle Tab-Constraints",
    yes: "Tab wird gerendert",
    no: "Tab wird nicht gezeigt",
  },
  {
    signal: "Badge sichtbar?",
    condition: "count > 0",
    yes: "Badge anzeigen",
    no: "Kein Badge",
  },
  {
    signal: "Badge Typ",
    condition: "tab.countKey === team ODER badgeDisplayMode === new",
    yes: "destructive",
    no: "secondary (oder tab.badgeVariant)",
  },
  {
    signal: "Team Count Quelle",
    condition: "countKey === team",
    yes: "newCounts.team",
    no: "aus newCountsMap oder totalCounts",
  },
  {
    signal: "Dashboard-Logo",
    condition: "app_logo_url vorhanden UND kein Ladefehler",
    yes: "img anzeigen",
    no: "Home-Icon anzeigen",
  },
  {
    signal: "Feedbackfeed Layout",
    condition: "isAbgeordneter",
    yes: "2-Spalten (Feedback + Feed)",
    no: "nur Feed",
  },
];

export function MyWorkSystemOverview() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Systemübersicht: „Meine Arbeit“</CardTitle>
          <CardDescription>
            Architektur- und Entscheidungsübersicht für Superadmins: UI-Signale, Regeln, Zustände und Systemfluss.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>1) UI-Signale (Icons / Badges / Banner / Disabled-States)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Signal</TableHead>
                <TableHead>Ort</TableHead>
                <TableHead>Bedeutung</TableHead>
                <TableHead>Quelle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uiSignals.map((entry) => (
                <TableRow key={entry.signal}>
                  <TableCell className="font-medium">{entry.signal}</TableCell>
                  <TableCell>{entry.where}</TableCell>
                  <TableCell>{entry.meaning}</TableCell>
                  <TableCell><code className="text-xs">{entry.source}</code></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-sm text-muted-foreground mt-4">
            Hinweis: Ein expliziter „disabled“-Button-State wird in den MyWork-Tabs aktuell kaum genutzt; stattdessen werden Features überwiegend
            per Rollenfilter ausgeblendet.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2) Entscheidungstabelle pro Signal</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Signal</TableHead>
                <TableHead>Regel / Bedingung</TableHead>
                <TableHead>Wenn JA</TableHead>
                <TableHead>Wenn NEIN</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {decisionRows.map((row) => (
                <TableRow key={row.signal}>
                  <TableCell className="font-medium">{row.signal}</TableCell>
                  <TableCell>{row.condition}</TableCell>
                  <TableCell>{row.yes}</TableCell>
                  <TableCell>{row.no}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3) State Machine (Lightweight)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[
              "Init",
              "RoleCheck",
              "TabRender",
              "TabActive",
              "LoadingContent",
              "ContentReady",
              "RealtimeRefresh",
            ].map((state) => (
              <Badge key={state} variant="secondary">{state}</Badge>
            ))}
          </div>
          <pre className="rounded-md border bg-muted/40 p-4 text-xs overflow-x-auto">
{`[Init]
  -> onMount
[RoleCheck]
  -> roleLoaded + countsLoaded
[TabRender]
  -> tabClick(url param)
[TabActive]
  -> lazyImportStarted
[LoadingContent]
  -> lazyImportResolved
[ContentReady]
  -> realtimeEvent / manualRefresh
[RealtimeRefresh]
  -> countsUpdated
[TabRender]`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4a) C4 Container Diagramm (Textuell)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md border bg-muted/40 p-4 text-xs overflow-x-auto">
{`Person: Superadmin / Teammitglied
  -> Web App (React, MyWorkView)
     -> UI State Layer (Hooks: useMyWorkSettings, useMyWorkNewCounts)
     -> Data Access (Supabase JS Client)
        -> Supabase Postgres (tasks, decisions, meetings, case_files, ...)
        -> Supabase Realtime (Tab-Refresh-Events)
        -> Edge Functions (z.B. Benachrichtigungen, Admin-Workflows)`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4b) Event-Storming-Light</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md border bg-muted/40 p-4 text-xs overflow-x-auto">
{`Command: Benutzer öffnet "Meine Arbeit"
  -> Event: Rollen geladen
  -> Event: Tab-Sichtbarkeit berechnet
  -> Event: Counts geladen (new/total)
  -> Event: Tab angeklickt
  -> Event: Tab als besucht markiert
  -> Event: Lazy-Komponente geladen
  -> Event: Inhalt sichtbar
  -> Event: Realtime-Datenänderung eingegangen
  -> Event: Counts neu berechnet
  -> Policy: Badge anzeigen nur wenn Count > 0`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
