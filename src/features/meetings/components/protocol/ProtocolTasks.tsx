import { Check, CheckSquare } from "lucide-react";
import { protocolTaskStatus } from "../../protocolTasks";
import type { CreatedTask } from "./types";

const statusLabels = {
  completed: "Erledigt",
  overdue: "In Verzug",
  "in-progress": "In Bearbeitung",
  open: "Offen",
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "Europe/Berlin" });

export function ProtocolTasks({
  parentTasks,
  createdTasks,
  getAssignedUserNames,
}: {
  parentTasks: CreatedTask[];
  createdTasks: CreatedTask[];
  getAssignedUserNames: (ids?: string[] | null) => string | null;
}) {
  if (!parentTasks.length) return null;

  const renderTask = (task: CreatedTask) => {
    const status = protocolTaskStatus(task);
    const assignees = task.assigned_to?.replace(/[{}]/g, "").split(",").map((id) => id.trim()).filter(Boolean);
    const children = createdTasks.filter((child) => child.parent_task_id === task.id);
    return (
      <li key={task.id} className="py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <a href={`/mywork?tab=tasks&task=${task.id}`} className="font-medium text-primary underline-offset-4 hover:underline print:text-black">
            {task.title}
          </a>
          <span className={status === "completed" ? "inline-flex items-center gap-1 text-success" : status === "overdue" ? "text-destructive" : "text-muted-foreground"}>
            {status === "completed" && <Check className="h-4 w-4" aria-hidden="true" />}
            {statusLabels[status]}
            {status === "completed" && task.completed_at && (
              <time dateTime={task.completed_at}> · {dateFormatter.format(new Date(task.completed_at))}</time>
            )}
          </span>
        </div>
        {assignees?.length ? (
          <p className="mt-1 text-xs text-muted-foreground">{getAssignedUserNames(assignees) || "Unbekannt"}</p>
        ) : null}
        {children.length > 0 && <ul className="ml-4 border-l pl-3">{children.map(renderTask)}</ul>}
      </li>
    );
  };

  return (
    <section id="protocol-tasks" className="mt-8 scroll-mt-6 space-y-3 border-t pt-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold print:break-after-avoid">
        <CheckSquare className="h-5 w-5 text-palette-blue" />
        Erstellte Aufgaben ({createdTasks.length})
      </h2>
      <ul className="divide-y divide-border/60">{parentTasks.map(renderTask)}</ul>
    </section>
  );
}
