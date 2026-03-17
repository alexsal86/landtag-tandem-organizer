import { Lightbulb } from "lucide-react";

export function ThemenspeicherPanel() {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Themenspeicher</h3>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Sammle hier Themenideen, die später in konkrete Inhalte oder Planungen überführt werden.
      </p>
    </section>
  );
}
