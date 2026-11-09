import { lazy, Suspense } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Rss, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState } from "@/components/ui-patterns";
import { rssTabFromParams } from "./automationNavigation";

const RSSSourceManager = lazy(() => import("./RSSSourceManager").then(module => ({ default: module.RSSSourceManager })));
const RSSSettingsManager = lazy(() => import("./RSSSettingsManager").then(module => ({ default: module.RSSSettingsManager })));

export function RSSMonitoringManager() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const tab = rssTabFromParams(params);

  const changeTab = (value: string) => {
    const next = new URLSearchParams(location.search);
    next.set("rssTab", value === "settings" ? "settings" : "sources");
    navigate({ pathname: location.pathname, search: next.toString() });
  };

  return (
    <Tabs value={tab} onValueChange={changeTab} className="min-w-0 space-y-md">
      <TabsList aria-label="RSS-Monitoring" className="h-auto max-w-full flex-wrap justify-start">
        <TabsTrigger value="sources" className="gap-xs"><Rss className="h-4 w-4" />Quellen</TabsTrigger>
        <TabsTrigger value="settings" className="gap-xs"><Settings className="h-4 w-4" />Einstellungen</TabsTrigger>
      </TabsList>
      <Suspense fallback={<LoadingState variant="list" rows={3} />}>
        <TabsContent value="sources"><RSSSourceManager /></TabsContent>
        <TabsContent value="settings"><RSSSettingsManager /></TabsContent>
      </Suspense>
    </Tabs>
  );
}