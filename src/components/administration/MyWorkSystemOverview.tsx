import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SchemaOverviewPage, type SchemaOverviewProfile } from "@/components/administration/system-overview/SchemaOverviewPage";

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

const tabs = ["dashboard", "capture", "tasks", "decisions", "jourFixe", "casefiles", "plannings", "time", "feedbackfeed", "team"] as const;

type MyWorkTabId = typeof tabs[number] | "overview";

const tabSourceMap: Record<typeof tabs[number], string> = {
  dashboard: "src/components/MyWorkView.tsx + src/components/dashboard/DashboardGreetingSection.tsx",
  capture: "src/components/my-work/MyWorkQuickCapture.tsx + src/components/my-work/MyWorkNotesList.tsx",
  tasks: "src/components/my-work/MyWorkTasksTab.tsx",
  decisions: "src/components/my-work/MyWorkDecisionsTab.tsx",
  jourFixe: "src/components/my-work/MyWorkJourFixeTab.tsx",
  casefiles: "src/components/my-work/MyWorkCaseFilesTab.tsx",
  plannings: "src/components/my-work/MyWorkPlanningsTab.tsx",
  time: "src/components/my-work/MyWorkTimeTrackingTab.tsx",
  feedbackfeed: "src/components/my-work/MyWorkFeedbackFeedTab.tsx",
  team: "src/components/my-work/MyWorkTeamTab.tsx",
};

function makeTabProfile(tab: typeof tabs[number]): SchemaOverviewProfile {
  return {
    id: tab,
    title: `Systemübersicht Tab: „${tab}"`,
    description: "Gleiche Analyse-Struktur wie bei der Gesamtseite, aber fokussiert auf einen einzelnen Bereich inklusive Inhalt.",
    sections: [
      {
        type: "table",
        title: "1) UI-Signale (Icons / Badges / Banner / States)",
        columns: [
          { key: "signal", label: "Signal" },
          { key: "where", label: "Ort" },
          { key: "meaning", label: "Bedeutung" },
          { key: "source", label: "Code-Quelle" },
        ],
        rows: [
          { signal: "Tab Trigger", where: "MyWork Tab-Leiste", meaning: `Navigiert auf ${tab}`, source: "src/components/MyWorkView.tsx (BASE_TABS + setActiveTab)" },
          { signal: "Tab-Inhalt", where: `Lazy Content für ${tab}`, meaning: "Fachliche Arbeitsfläche", source: tabSourceMap[tab] },
          { signal: "Badge/Count", where: "Tab Trigger", meaning: "Neu/Gesamt je Setting und Rolle", source: "src/components/MyWorkView.tsx (getDisplayCount)" },
        ],
      },
      {
        type: "table",
        title: "2) Entscheidungstabellen",
        description: "Sichtbarkeit und inhaltliches Rendering folgen denselben Regeln wie beim Haupt-Überblick.",
        columns: [
          { key: "signal", label: "Signal" },
          { key: "rule", label: "Regel/Bedingung" },
          { key: "yes", label: "Wenn JA" },
          { key: "no", label: "Wenn NEIN" },
        ],
        rows: [
          { signal: "Tab sichtbar?", rule: "Rollenregel erfüllt", yes: `${tab} im Menü sichtbar`, no: "Tab ausgeblendet" },
          { signal: "Content geladen?", rule: "Lazy Import erfolgreich", yes: "Fachkomponente wird angezeigt", no: "Tab Error-State / ErrorBoundary" },
          { signal: "Badge sichtbar?", rule: "Count > 0", yes: "Badge wird gerendert", no: "Kein Badge" },
        ],
      },
      {
        type: "table",
        title: "3) Rollenmatrix (Sichtbarkeit je Rolle)",
        columns: [
          { key: "role", label: "Rolle" },
          { key: "tabs", label: "Sichtbarkeit" },
          { key: "notes", label: "Hinweise" },
        ],
        rows: [
          { role: "abgeordneter", tabs: "sichtbar außer time", notes: "team sichtbar" },
          { role: "bueroleitung", tabs: "alle inkl. team + time", notes: "breitester Zugriff" },
          { role: "mitarbeiter/praktikant", tabs: "ohne team", notes: "time sichtbar" },
        ],
      },
      {
        type: "state",
        title: "4) State Machine",
        description: `Standardfluss für den Tab ${tab} innerhalb der Gesamtseite.`,
        states: ["Init", "RoleCheck", "TabsFiltered", "CountLoading", "TabsReady", "LazyLoading", "ContentVisible", "RealtimeUpdate", "ErrorState"],
        chart: stateMachineMermaid,
      },
      {
        type: "table",
        title: "5) Fehlerverhalten & Edge Cases",
        columns: [
          { key: "case", label: "Fehlerfall" },
          { key: "behavior", label: "Aktuelles Verhalten" },
          { key: "visibility", label: "Wie sichtbar?" },
          { key: "improvement", label: "Empfohlene Verbesserung" },
        ],
        rows: [
          { case: "Datenquery fehlschlägt", behavior: "Fehler wird geloggt", visibility: "indirekt über stagnierende Inhalte", improvement: "Tab-lokaler Retry + Banner" },
          { case: "Lazy-Import schlägt fehl", behavior: "ErrorBoundary übernimmt", visibility: "harter Content-Fehler", improvement: "gezielte Tab-Fehlerkarte" },
        ],
      },
      {
        type: "table",
        title: "6) Loading-States",
        columns: [
          { key: "area", label: "Bereich" },
          { key: "state", label: "Aktueller Zustand" },
          { key: "gap", label: "Lücke / Risiko" },
        ],
        rows: [
          { area: `${tab} Inhalt`, state: "Suspense fallback aktiv", gap: "kein domänenspezifischer Skeleton" },
          { area: "Counts", state: "global über MyWork geladen", gap: "0 vs. loading nicht klar unterscheidbar" },
        ],
      },
      {
        type: "table",
        title: "7) Realtime-Refresh-Mapping",
        columns: [
          { key: "table", label: "Tabelle" },
          { key: "trigger", label: "Trigger" },
          { key: "effect", label: "UI-Effekt" },
          { key: "source", label: "Quelle" },
        ],
        rows: [
          { table: "my-work relevante Entitäten", trigger: "INSERT/UPDATE/DELETE", effect: "refreshCounts + loadCounts", source: "src/components/MyWorkView.tsx (realtime channel)" },
          { table: "tab-spezifische Entitäten", trigger: "abhängig von Tab", effect: `Inhalt ${tab} reagiert via eigener Hooks`, source: tabSourceMap[tab] },
        ],
      },
      {
        type: "table",
        title: "8) Performance-Hotspots",
        columns: [
          { key: "topic", label: "Thema" },
          { key: "current", label: "Ist-Zustand" },
          { key: "risk", label: "Risiko" },
          { key: "improvement", label: "Verbesserung" },
        ],
        rows: [
          { topic: "Count-Neuberechnung", current: "global debounce", risk: "Burst bei vielen Events", improvement: "tab- oder entity-basiertes throttling" },
          { topic: "Tab Content", current: "lazy geladen", risk: "kalter Start pro Tab", improvement: "Prefetch häufig genutzter Tabs" },
        ],
      },
      {
        type: "code",
        title: "9) C4 Container + Event-Storming-Light",
        blocks: [
          {
            heading: "C4 Container (Text)",
            content: `Person (Nutzer)
  -> Web App (React: MyWorkView)
     -> Tab ${tab} (${tabSourceMap[tab]})
     -> Supabase Client
        -> Postgres + Realtime`,
          },
          {
            heading: "Event-Storming-Light",
            content: `Command: Öffne Tab "${tab}"
  -> Event: Rolle geprüft
  -> Event: Tab sichtbar/unsichtbar
  -> Event: Inhalt lazy geladen
  -> Event: Realtime Update
  -> Policy: Badge nur bei count > 0`,
          },
        ],
      },
      {
        type: "table",
        title: "10) Code-Map (wo debugge ich was?)",
        columns: [
          { key: "concern", label: "Concern" },
          { key: "location", label: "Datei / Einstiegspunkt" },
        ],
        rows: [
          { concern: "Tab-Konfiguration", location: "src/components/MyWorkView.tsx › BASE_TABS" },
          { concern: `${tab} Inhalt`, location: tabSourceMap[tab] },
          { concern: "Rollen-Logik", location: "src/components/my-work/tabVisibility.ts" },
        ],
      },
      {
        type: "list",
        title: "11) Nächste sinnvolle Ausbaustufen",
        items: [
          `Tab-spezifische Health- und Fehlerindikatoren für ${tab}`,
          "Gemeinsame Data-Layer Contracts für wiederverwendbare Instrumentierung",
          "Gezielte Smoke-Tests für Sichtbarkeit + Kernaktionen je Rolle",
        ],
      },
    ],
  };
}

const overviewProfile: SchemaOverviewProfile = {
  id: "overview",
  title: "Systemübersicht: „Meine Arbeit“ (Deep-Dive)",
  description: "Für Superadmins & Entwickler-Onboarding: positive Pfade, Fehlerverhalten, Rollenmatrix, Realtime-Mapping und Performance-Hotspots.",
  sections: [
    {
      type: "table",
      title: "1) UI-Signale (Icons / Badges / Banner / States)",
      columns: [
        { key: "signal", label: "Signal" },
        { key: "where", label: "Ort" },
        { key: "meaning", label: "Bedeutung" },
        { key: "source", label: "Code-Quelle" },
      ],
      rows: [
        { signal: "Tab-Icon", where: "Tab-Leiste", meaning: "Orientierung pro Feature", source: "src/components/MyWorkView.tsx (BASE_TABS.icon)" },
        { signal: "Active-State", where: "Tab-Leiste", meaning: "Aktiv sichtbarer Tab", source: "src/components/MyWorkView.tsx (activeTab)" },
        { signal: "Badge", where: "Tab-Leiste", meaning: "Neu/Gesamt je Modus", source: "src/components/MyWorkView.tsx (getDisplayCount)" },
      ],
    },
    {
      type: "table",
      title: "2) Entscheidungstabellen",
      columns: [
        { key: "signal", label: "Signal" },
        { key: "rule", label: "Regel/Bedingung" },
        { key: "yes", label: "Wenn JA" },
        { key: "no", label: "Wenn NEIN" },
      ],
      rows: [
        { signal: "Tab sichtbar?", rule: "Rolle erfüllt Constraints", yes: "Tab rendern", no: "Tab ausblenden" },
        { signal: "Badge sichtbar?", rule: "count > 0", yes: "Badge rendern", no: "Kein Badge" },
      ],
    },
    {
      type: "table",
      title: "3) Rollenmatrix (Sichtbarkeit je Rolle)",
      columns: [
        { key: "role", label: "Rolle" },
        { key: "tabs", label: "Sichtbare Tabs" },
        { key: "notes", label: "Hinweise" },
      ],
      rows: [
        { role: "abgeordneter", tabs: "dashboard, capture, tasks, decisions, jourFixe, casefiles, plannings, feedbackfeed, team", notes: "Team sichtbar" },
        { role: "bueroleitung", tabs: "alle inkl. team und time", notes: "breitester Zugriff" },
        { role: "mitarbeiter/praktikant", tabs: "ohne team", notes: "time sichtbar" },
      ],
    },
    {
      type: "state",
      title: "4) State Machine",
      description: "Mermaid-Definition für den gesamten Ablauf auf der Seite.",
      states: ["Init", "RoleCheck", "TabsFiltered", "CountLoading", "TabsReady", "LazyLoading", "ContentVisible", "RealtimeUpdate", "ErrorState"],
      chart: stateMachineMermaid,
    },
    {
      type: "list",
      title: "11) Nächste sinnvolle Ausbaustufen",
      items: [
        "Live-Health-Anzeige für Realtime-Status in der MyWork-Headerleiste",
        "Vereinheitlichte Error-Komponente für tab-spezifische Lade-/Datenfehler",
        "Serverseitige Count-Aggregation für große Tenants",
      ],
    },
  ],
};

export function MyWorkSystemOverview() {
  const [activeProfile, setActiveProfile] = useState<MyWorkTabId>("overview");

  const profiles = useMemo<Record<MyWorkTabId, SchemaOverviewProfile>>(() => {
    const entries = tabs.map((tab) => [tab, makeTabProfile(tab)] as const);
    return Object.fromEntries([["overview", overviewProfile], ...entries]) as Record<MyWorkTabId, SchemaOverviewProfile>;
  }, []);

  const active = profiles[activeProfile];

  return (
    <div className="space-y-6">
      <Tabs value={activeProfile} onValueChange={(value) => setActiveProfile(value as MyWorkTabId)}>
        <TabsList className="flex w-full flex-wrap h-auto justify-start">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          {tabs.map((tab) => (
            <TabsTrigger key={tab} value={tab}>{tab}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <SchemaOverviewPage profile={active} />
    </div>
  );
}
