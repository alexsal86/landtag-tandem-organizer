import { useState } from "react";
import { PanelRightOpen, Lightbulb } from "lucide-react";
import { PlannerBoard } from "./PlannerBoard";
import { Themenspeicher } from "./Themenspeicher";
import { useRedaktionSpecialDays } from "@/features/redaktion/hooks/useRedaktionSpecialDays";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function RedaktionFeature() {
  const { data: specialDays = [] } = useRedaktionSpecialDays();
  const [isThemenspeicherOpen, setIsThemenspeicherOpen] = useState(false);

  return (
    <div className="p-4 pb-8">
      <div className="grid grid-cols-1 gap-4">
        <div className="min-w-0">
          <PlannerBoard specialDays={specialDays} />
        </div>
      </div>

      <Sheet open={isThemenspeicherOpen} onOpenChange={setIsThemenspeicherOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="fixed right-0 top-1/2 z-40 h-auto -translate-y-1/2 rounded-r-none border-r-0 px-2 py-3 shadow-md"
          >
            <span className="flex flex-col items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              <span className="[writing-mode:vertical-rl] rotate-180 text-xs font-medium tracking-wide">
                Themenspeicher
              </span>
              <PanelRightOpen className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader className="pb-3">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <Lightbulb className="h-4 w-4" />
              Themenspeicher
            </SheetTitle>
          </SheetHeader>
          <Themenspeicher />
        </SheetContent>
      </Sheet>
    </div>
  );
}
