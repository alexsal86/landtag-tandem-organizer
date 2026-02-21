import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { MermaidRenderer } from "@/components/administration/MermaidRenderer";

type Row = Record<string, string>;

const uiSignals: Row[] = [
  {
    signal: "Tab-Icon",
    where: "Tab-Leiste › alle Tabs",
    meaning: "Semantische Orientierung pro Feature",
    source: "src/components/MyWorkView.tsx (BASE_TABS.icon)",
  },
  {
    signal: "Active-State (Primary + Unterstreichung)",
    where: "Tab-Leiste",
    meaning: "Aktiv sichtbarer Tab",
    source: "src/components/MyWorkView.tsx (activeTab === tab.value)",
  },
  {
    signal: "Badge (destructive)",
    where: "Bei `badgeDisplayMode = new` + Team immer",
    meaning: "Neu/Ungelesen",
    source: "src/components/MyWorkView.tsx (newCounts)",
  },
  {
    signal: "Badge (secondary)",
    where: "Bei `badgeDisplayMode = total`",
    meaning: "Gesamt offener Elemente",
    source: "src/components/MyWorkView.tsx (totalCounts)",
  },
  {
    signal: "Logo-Fallback-Icon",
    where: "Dashboard-Tab",
    meaning: "Home-Icon statt Logo bei Ladefehler",
    source: "src/components/MyWorkView.tsx (isTabLogoError)",
  },
  {
    signal: "Versteckter Tab (role-gated)",
    where: "Time / Team / weitere Rollenregeln",
    meaning: "Feature nicht erlaubt",
    source: "src/components/MyWorkView.tsx (adminOnly/employeeOnly/...)",
  },
  {
    signal: "Loading-Fallback",
    where: "Tab-Content",
    meaning: "Lazy-Komponente lädt",
    source: "src/components/MyWorkView.tsx (tabFallback + Suspense)",
  },
];

const decisionRows: Row[] = [
  {
    signal: "Tab sichtbar?",
    rule: "Rolle erfüllt Constraints",
    yes: "Tab rendern",
    no: "Tab ausblenden",
  },
  {
    signal: "Badge sichtbar?",
    rule: "count > 0",
    yes: "Badge rendern",
    no: "Kein Badge",
  },
  {
    signal: "Badge Typ",
    rule: "Team-Tab ODER new-Modus",
    yes: "destructive",
    no: "secondary (oder tab.badgeVariant)",
  },
  {
    signal: "Team Count Quelle",
    rule: "countKey === team",
    yes: "newCounts.team",
    no: "newCountsMap/totalCounts",
  },
  {
    signal: "Feedbackfeed Layout",
    rule: "isAbgeordneter",
    yes: "2-Spalten",
    no: "1-Spalte",
  },
];

const roleVisibilityRows: Row[] = [
  {
    role: "abgeordneter",
    tabs: "dashboard, capture, tasks, decisions, jourFixe, casefiles, plannings, feedbackfeed, team",
    notes: "Sieht Team-Tab und 2-Spalten-Feedbackfeed",
  },
  {
    role: "bueroleitung",
    tabs: "dashboard, capture, tasks, decisions, jourFixe, casefiles, plannings, time, feedbackfeed, team",
    notes: "Time (employeeOnly) + Team (abgeordneterOrBueroOnly)",
  },
  {
    role: "mitarbeiter",
    tabs: "dashboard, capture, tasks, decisions, jourFixe, casefiles, plannings, time, feedbackfeed",
    notes: "Kein Team-Tab",
  },
  {
    role: "praktikant",
    tabs: "dashboard, capture, tasks, decisions, jourFixe, casefiles, plannings, time, feedbackfeed",
    notes: "Wie mitarbeiter bzgl. Tab-Sichtbarkeit",
  },
];

const realtimeRows: Row[] = [
  { table: "tasks", trigger: "INSERT/UPDATE/DELETE", effect: "refreshCounts() + loadCounts()", source: "MyWorkView realtime channels" },
  { table: "task_decisions", trigger: "INSERT/UPDATE/DELETE", effect: "refreshCounts() + loadCounts()", source: "MyWorkView realtime channels" },
  { table: "task_decision_participants", trigger: "INSERT/UPDATE/DELETE", effect: "refreshCounts() + loadCounts()", source: "MyWorkView realtime channels" },
  { table: "task_decision_responses", trigger: "INSERT/UPDATE/DELETE", effect: "refreshCounts() + loadCounts()", source: "MyWorkView realtime channels" },
  { table: "quick_notes", trigger: "INSERT/UPDATE/DELETE", effect: "refreshCounts() + loadCounts()", source: "MyWorkView realtime channels" },
  { table: "meetings", trigger: "INSERT/UPDATE/DELETE", effect: "refreshCounts() + loadCounts()", source: "MyWorkView realtime channels" },
  { table: "case_files", trigger: "INSERT/UPDATE/DELETE", effect: "refreshCounts() + loadCounts()", source: "MyWorkView realtime channels" },
  { table: "event_plannings", trigger: "INSERT/UPDATE/DELETE", effect: "refreshCounts() + loadCounts()", source: "MyWorkView realtime channels" },
];

const errorRows: Row[] = [
  {
    case: "Logo lädt nicht",
    behavior: "Fallback auf Home-Icon via `isTabLogoError`",
    visibility: "Sichtbar als Icon-Wechsel",
    improvement: "Optional Toast + Audit-Event für kaputte Assets",
  },
  {
    case: "Counts-Query fehlschlägt",
    behavior: "Error wird aktuell primär geloggt, UI bleibt mit letztem/0-Wert",
    visibility: "Nur indirekt über stagnierende Badges",
    improvement: "Expliziter Error-Banner + Retry-Button",
  },
  {
    case: "Realtime-Verbindung unterbrochen",
    behavior: "Keine explizite Statusanzeige im MyWork-Header",
    visibility: "Updates kommen verspätet/erst nach manueller Aktion",
    improvement: "Connection-Badge (online/degraded/offline)",
  },
  {
    case: "Lazy-Import Tab-Komponente fehlschlägt",
    behavior: "Globaler ErrorBoundary-Kontext, kein tab-spezifischer Fehlerzustand",
    visibility: "Hard failure je nach ErrorBoundary-Platzierung",
    improvement: "Tab-lokaler Fallback mit Fehlerkarte",
  },
];

const loadingRows: Row[] = [
  {
    area: "Tab-Inhalte (lazy)",
    state: "Suspense fallback: „Bereich wird geladen…“",
    gap: "Kein Skeleton je Tab, gleiche Darstellung für alle",
  },
  {
    area: "Counts laden",
    state: "Kein expliziter Loader in Tab-Leiste",
    gap: "Unklar, ob 0 = wirklich 0 oder noch loading",
  },
  {
    area: "Rollenprüfung",
    state: "Asynchron beim Mount",
    gap: "Keine sichtbare Kennzeichnung während RoleCheck",
  },
];

const performanceRows: Row[] = [
  {
    topic: "Race-Condition-Schutz",
    current: "`loadCountsRequestRef` verwirft veraltete Requests",
    risk: "Viele Realtime-Events können trotzdem Burst-Loads auslösen",
    improvement: "Debounce/Throttle für refreshCounts + loadCounts",
  },
  {
    topic: "Subscription Cleanup",
    current: "Realtime Subscriptions werden in Effect-Cleanup beendet",
    risk: "Bei Erweiterungen drohen Leaks, falls Cleanup vergessen wird",
    improvement: "Channel-Factory + zentraler Cleanup-Helper",
  },
  {
    topic: "Query-Footprint",
    current: "Mehrere Count-Queries parallel + Team-Zusatzqueries",
    risk: "Hohe Last in großen Tenants",
    improvement: "Materialisierte Count-Views / serverseitige Aggregation",
  },
];

const codemapRows: Row[] = [
  { concern: "Tab-Konfiguration", location: "src/components/MyWorkView.tsx › BASE_TABS" },
  { concern: "Rollen-Check", location: "src/components/MyWorkView.tsx › checkPermissions()" },
  { concern: "Count-Berechnung", location: "src/components/MyWorkView.tsx › loadCounts()" },
  { concern: "Badge-Mode new/total", location: "src/components/MyWorkView.tsx › getDisplayCount()" },
  { concern: "Realtime-Trigger", location: "src/components/MyWorkView.tsx › useEffect realtime channel setup" },
  { concern: "Superadmin Einstieg", location: "src/components/administration/AdminSidebar.tsx + src/pages/Administration.tsx" },
];

const stateMachineMermaid = `stateDiagram-v2
  [*] --> Init
  Init --> RoleCheck: onMount
  RoleCheck --> TabsFiltered: roleLoaded
  TabsFiltered --> CountLoading: loadCounts()
  CountLoading --> TabsReady: countsLoaded
  TabsReady --> TabSwitch: click / URL tab
  TabSwitch --> LazyLoading: Suspense start
  LazyLoading --> ContentVisible: lazy resolved
  ContentVisible --> RealtimeUpdate: db event
  RealtimeUpdate --> CountLoading: refreshCounts + loadCounts
  CountLoading --> ErrorState: query failed
  ErrorState --> CountLoading: retry/manual reload
  ContentVisible --> [*]
`;

export function MyWorkSystemOverview() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Systemübersicht: „Meine Arbeit“ (Deep-Dive)</CardTitle>
          <CardDescription>
            Für Superadmins & Entwickler-Onboarding: positive Pfade, Fehlerverhalten, Rollenmatrix, Realtime-Mapping und Performance-Hotspots.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>1) UI-Signale (Icons / Badges / Banner / States)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Signal</TableHead>
                <TableHead>Ort</TableHead>
                <TableHead>Bedeutung</TableHead>
                <TableHead>Code-Quelle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uiSignals.map((row) => (
                <TableRow key={row.signal}>
                  <TableCell className="font-medium">{row.signal}</TableCell>
                  <TableCell>{row.where}</TableCell>
                  <TableCell>{row.meaning}</TableCell>
                  <TableCell><code className="text-xs">{row.source}</code></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2) Entscheidungstabellen</CardTitle>
          <CardDescription>Pro Signal die relevante Bedingungslogik und Ergebnisrichtung.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Signal</TableHead>
                <TableHead>Regel/Bedingung</TableHead>
                <TableHead>Wenn JA</TableHead>
                <TableHead>Wenn NEIN</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {decisionRows.map((row) => (
                <TableRow key={row.signal}>
                  <TableCell className="font-medium">{row.signal}</TableCell>
                  <TableCell>{row.rule}</TableCell>
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
          <CardTitle>3) Rollenmatrix (Sichtbarkeit je Rolle)</CardTitle>
          <CardDescription>
            Explizite Matrix statt impliziter Flags, damit Onboarding und Debugging schneller gehen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rolle</TableHead>
                <TableHead>Sichtbare Tabs</TableHead>
                <TableHead>Hinweise</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roleVisibilityRows.map((row) => (
                <TableRow key={row.role}>
                  <TableCell className="font-medium">{row.role}</TableCell>
                  <TableCell className="max-w-[520px]">{row.tabs}</TableCell>
                  <TableCell>{row.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4) State Machine</CardTitle>
          <CardDescription>Mermaid-Definition (copy/paste-fähig für Doku/PRs) plus Zustandsbadges.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {["Init", "RoleCheck", "TabsFiltered", "CountLoading", "TabsReady", "LazyLoading", "ContentVisible", "RealtimeUpdate", "ErrorState"].map((state) => (
              <Badge key={state} variant="secondary">{state}</Badge>
            ))}
          </div>
          <div className="rounded-md border bg-muted/40 p-4"><MermaidRenderer chart={stateMachineMermaid} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5) Fehlerverhalten & Edge Cases</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fehlerfall</TableHead>
                <TableHead>Aktuelles Verhalten</TableHead>
                <TableHead>Wie sichtbar?</TableHead>
                <TableHead>Empfohlene Verbesserung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errorRows.map((row) => (
                <TableRow key={row.case}>
                  <TableCell className="font-medium">{row.case}</TableCell>
                  <TableCell>{row.behavior}</TableCell>
                  <TableCell>{row.visibility}</TableCell>
                  <TableCell>{row.improvement}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>6) Loading-States</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bereich</TableHead>
                <TableHead>Aktueller Zustand</TableHead>
                <TableHead>Lücke / Risiko</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingRows.map((row) => (
                <TableRow key={row.area}>
                  <TableCell className="font-medium">{row.area}</TableCell>
                  <TableCell>{row.state}</TableCell>
                  <TableCell>{row.gap}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>7) Realtime-Refresh-Mapping</CardTitle>
          <CardDescription>
            Welche Datenänderung triggert welche Badge-/Count-Aktualisierung.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tabelle</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>UI-Effekt</TableHead>
                <TableHead>Quelle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {realtimeRows.map((row) => (
                <TableRow key={row.table}>
                  <TableCell className="font-medium">{row.table}</TableCell>
                  <TableCell>{row.trigger}</TableCell>
                  <TableCell>{row.effect}</TableCell>
                  <TableCell>{row.source}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>8) C4 Container + Event-Storming-Light</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">C4 Container (Text)</h4>
            <pre className="rounded-md border bg-muted/40 p-4 text-xs overflow-x-auto">{`Person (Superadmin/Teammitglied)
  -> Web App (React: MyWorkView)
     -> Hooks/State Layer (Settings, NewCounts, Roles)
     -> Supabase JS Client
        -> Postgres (Tasks, Decisions, Meetings, CaseFiles...)
        -> Realtime Channels (DB Events)
        -> Edge Functions (Benachrichtigungen/Workflows)`}</pre>
          </div>
          <Separator />
          <div>
            <h4 className="font-medium mb-2">Event-Storming-Light</h4>
            <pre className="rounded-md border bg-muted/40 p-4 text-xs overflow-x-auto">{`Command: Öffne "Meine Arbeit"
  -> Event: Rolle geladen
  -> Event: Tabs gefiltert
  -> Event: Counts geladen
  -> Event: Tab gewechselt
  -> Event: Tab als besucht markiert
  -> Event: Lazy Content geladen
  -> Event: Realtime-Änderung eingegangen
  -> Event: Counts neu berechnet
  -> Policy: Badge nur bei count > 0`}</pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>9) Code-Map (wo debugge ich was?)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Concern</TableHead>
                <TableHead>Datei / Einstiegspunkt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codemapRows.map((row) => (
                <TableRow key={row.concern}>
                  <TableCell className="font-medium">{row.concern}</TableCell>
                  <TableCell><code className="text-xs">{row.location}</code></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>10) Nächste sinnvolle Ausbaustufen</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• Live-Health-Anzeige für Realtime-Status in der MyWork-Headerleiste.</p>
          <p>• Vereinheitlichte Error-Komponente für tab-spezifische Lade-/Datenfehler.</p>
          <p>• Serverseitige Count-Aggregation (Performance bei großen Tenants).</p>
          <p>• E2E Smoke-Test nur für Tab-Sichtbarkeit nach Rolle (Regression-Schutz).</p>
        </CardContent>
      </Card>
    </div>
  );
}
