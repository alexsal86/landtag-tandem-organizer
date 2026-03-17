import { Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

const MyWorkJourFixeTab = lazyWithRetry(() => import("./MyWorkJourFixeTab").then(m => ({ default: m.MyWorkJourFixeTab })));
const MyWorkPlanungsKartenSection = lazyWithRetry(() => import("./MyWorkPlanungsKartenSection").then(m => ({ default: m.MyWorkPlanungsKartenSection })));

const fallback = (
  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
    Lade Daten…
  </div>
);

export function MyWorkTerminePlanungTab() {
  return (
    <div className="space-y-6">
      <Suspense fallback={fallback}>
        <MyWorkJourFixeTab />
      </Suspense>
      <Suspense fallback={fallback}>
        <MyWorkPlanungsKartenSection />
      </Suspense>
    </div>
  );
}
