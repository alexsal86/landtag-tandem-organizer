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
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div className="min-w-0">
        <Suspense fallback={fallback}>
          <MyWorkJourFixeTab />
        </Suspense>
      </div>
      <div className="min-w-0">
        <Suspense fallback={fallback}>
          <MyWorkPlanungsKartenSection />
        </Suspense>
      </div>
    </div>
  );
}
