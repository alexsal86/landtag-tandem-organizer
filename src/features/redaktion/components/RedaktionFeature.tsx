import { useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { PlannerBoard } from "./PlannerBoard";
import { Themenspeicher } from "./Themenspeicher";
import { useRedaktionSpecialDays } from "@/features/redaktion/hooks/useRedaktionSpecialDays";
import { Button } from "@/components/ui/button";
import { debugConsole } from "@/utils/debugConsole";

export function RedaktionFeature() {
  debugConsole.log("[RedaktionFeature] mounted");
  const { data: specialDays = [] } = useRedaktionSpecialDays();
  const [isThemenspeicherOpen, setIsThemenspeicherOpen] = useState(false);

  return (
    <div className="p-4 pb-8">
      {!isThemenspeicherOpen && (
        <Button
          type="button"
          variant="outline"
          className="fixed right-0 top-1/2 z-30 h-auto -translate-y-1/2 rounded-l-md rounded-r-none border-r-0 px-2 py-3 shadow-md"
          onClick={() => setIsThemenspeicherOpen(true)}
        >
          <span className="flex flex-col items-center gap-2">
            <Lightbulb className="h-8 w-8" />
            <span className="[writing-mode:vertical-rl] rotate-180 text-xs font-medium tracking-wide">
              Themenspeicher
            </span>
          </span>
        </Button>
      )}
      <div className="flex gap-4">
        {/* Main content */}
        <div className="min-w-0 flex-1">
          <PlannerBoard specialDays={specialDays} />
        </div>

        {/* Themenspeicher side panel */}
        {isThemenspeicherOpen && (
          <div className="w-[400px] shrink-0 rounded-lg border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Lightbulb className="h-4 w-4" />
                Themenspeicher
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsThemenspeicherOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(100vh - 200px)" }}>
              <Themenspeicher />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
