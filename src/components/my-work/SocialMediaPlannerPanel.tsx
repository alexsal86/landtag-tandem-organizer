import { Megaphone } from "lucide-react";

export function SocialMediaPlannerPanel() {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Social-Media-Planer</h3>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Plane Kampagnen, Beiträge und Veröffentlichungen im Zusammenspiel mit deinen Event-Planungen.
      </p>
    </section>
  );
}
