import { useState } from "react";
import { Lightbulb, PanelLeft, PanelRight, X } from "lucide-react";
import { PlannerBoard } from "./PlannerBoard";
import { Themenspeicher } from "./Themenspeicher";
import { useRedaktionSpecialDays } from "@/features/redaktion/hooks/useRedaktionSpecialDays";
import { Button } from "@/components/ui/button";
import styles from "./RedaktionFeature.module.css";

export function RedaktionFeature() {
  const { data: specialDays = [] } = useRedaktionSpecialDays();
  const [isThemenspeicherOpen, setIsThemenspeicherOpen] = useState(true);
  const [dockSide, setDockSide] = useState<"left" | "right">("left");

  return (
    <div className={`${styles.workspace} p-4 pb-8`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant={isThemenspeicherOpen ? "secondary" : "outline"} aria-expanded={isThemenspeicherOpen} aria-controls="redaktion-topics" onClick={() => setIsThemenspeicherOpen((open) => !open)}>
          <Lightbulb className="mr-2 h-4 w-4" />Themenspeicher
        </Button>
        <span className="text-xs text-muted-foreground">Ideen sammeln und direkt in den Kalender ziehen.</span>
      </div>
      <div className={styles.layout} data-side={dockSide} data-open={isThemenspeicherOpen}>
        <aside id="redaktion-topics" aria-label="Themenspeicher" className={styles.sidebar} inert={!isThemenspeicherOpen}>
          {isThemenspeicherOpen && (
            <div className="rounded-lg border bg-card shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                <span className="text-xs font-semibold text-muted-foreground">Andocken</span>
                <div className="flex items-center gap-1">
                  <Button type="button" variant={dockSide === "left" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" aria-label="Links andocken" aria-pressed={dockSide === "left"} onClick={() => setDockSide("left")}><PanelLeft className="h-4 w-4" /></Button>
                  <Button type="button" variant={dockSide === "right" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" aria-label="Rechts andocken" aria-pressed={dockSide === "right"} onClick={() => setDockSide("right")}><PanelRight className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Themenspeicher schließen" onClick={() => setIsThemenspeicherOpen(false)}><X className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className={styles.topicList}><Themenspeicher compact /></div>
            </div>
          )}
        </aside>
        <div className={styles.planner}><PlannerBoard specialDays={specialDays} /></div>
      </div>
    </div>
  );
}
