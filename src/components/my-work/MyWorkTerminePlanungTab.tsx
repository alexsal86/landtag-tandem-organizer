import { Suspense, useState } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const MyWorkJourFixeTab = lazyWithRetry(() => import("./MyWorkJourFixeTab").then(m => ({ default: m.MyWorkJourFixeTab })));
const MyWorkPlanungsKartenSection = lazyWithRetry(() => import("./MyWorkPlanungsKartenSection").then(m => ({ default: m.MyWorkPlanungsKartenSection })));

const fallback = (
  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
    Lade Daten…
  </div>
);

export function MyWorkTerminePlanungTab() {
  const [sub, setSub] = useState<"meetings" | "plannings">("meetings");

  return (
    <Tabs value={sub} onValueChange={(v) => setSub(v as "meetings" | "plannings")} className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="meetings">Meetings</TabsTrigger>
        <TabsTrigger value="plannings">Planungen</TabsTrigger>
      </TabsList>
      <TabsContent value="meetings" className="mt-0">
        <Suspense fallback={fallback}>
          <MyWorkJourFixeTab />
        </Suspense>
      </TabsContent>
      <TabsContent value="plannings" className="mt-0">
        <Suspense fallback={fallback}>
          <MyWorkPlanungsKartenSection />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
