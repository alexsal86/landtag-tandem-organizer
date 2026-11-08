import { CheckSquare, ChevronRight } from "lucide-react";
import type { CreatedTask } from "./types";
export function ProtocolTasks({
  parentTasks,
  createdTasks,
  getAssignedUserNames,
}: {
  parentTasks: CreatedTask[];
  createdTasks: CreatedTask[];
  getAssignedUserNames: (ids?: string[] | null) => string | null;
}) {
  return (
    <>
      {parentTasks.length > 0 && (
        <section
          id="protocol-tasks"
          className="scroll-mt-6 space-y-3 mt-8 border-t pt-6 print:break-inside-auto"
        >
          <h2 className="text-lg font-semibold flex items-center gap-2 print:break-after-avoid">
            <CheckSquare className="h-5 w-5 text-palette-blue" />
            Erstellte Aufgaben ({createdTasks.length})
          </h2>
          <div className="space-y-2">
            {parentTasks.map((task) => {
              const childTasks = createdTasks.filter(
                (t) => t.parent_task_id === task.id,
              );
              return (
                <div
                  key={task.id}
                  className="py-3 border-b border-border/60 last:border-0 break-inside-avoid"
                >
                  <p className="font-medium text-sm">{task.title}</p>
                  {task.assigned_to && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {getAssignedUserNames(
                        typeof task.assigned_to === "string"
                          ? task.assigned_to
                              .replace(/[{}]/g, "")
                              .split(",")
                              .filter(Boolean)
                          : null,
                      ) || "Unbekannt"}
                    </p>
                  )}
                  {childTasks.length > 0 && (
                    <div className="mt-2 ml-4 space-y-1">
                      {childTasks.map((ct) => (
                        <div
                          key={ct.id}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <ChevronRight className="h-3 w-3" />
                          {ct.title}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
