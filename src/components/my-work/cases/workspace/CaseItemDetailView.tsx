import type { ReactNode } from "react";
import { FolderOpen, Globe } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type DetailTab = "overview" | "timeline" | "documents";

type CaseItemDetailViewProps = {
  title: string;
  onTitleChange: (value: string) => void;
  dueDateValue: string;
  onDueDateChange: (value: string) => void;
  sourceReceivedAt: string;
  onSourceReceivedAtChange: (value: string) => void;
  assigneeId: string;
  onAssigneeChange: (value: string) => void;
  assigneeOptions: Array<{ id: string; name: string }>;
  category: string;
  onCategoryChange: (value: string) => void;
  categoryOptions: readonly string[];
  status: string;
  onStatusChange: (value: string) => void;
  statusOptions: Array<{ value: string; label: string }>;
  priority: string;
  onPriorityChange: (value: string) => void;
  detailPanel: ReactNode;
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onOpenCaseFiles?: () => void;
  linkedFileName?: string | null;
  isPublic: boolean;
  onPublicChange: (value: boolean) => void;
};

export function CaseItemDetailView({
  title,
  onTitleChange,
  dueDateValue,
  onDueDateChange,
  sourceReceivedAt,
  onSourceReceivedAtChange,
  assigneeId,
  onAssigneeChange,
  assigneeOptions,
  category,
  onCategoryChange,
  categoryOptions,
  status,
  onStatusChange,
  statusOptions,
  priority,
  onPriorityChange,
  detailPanel,
  activeTab,
  onTabChange,
  onOpenCaseFiles,
  linkedFileName,
  isPublic,
  onPublicChange,
}: CaseItemDetailViewProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="shrink-0 border-b">
        <div className="space-y-4 px-6 pb-4 pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={priority} onValueChange={onPriorityChange}>
              <SelectTrigger className="h-9 w-[130px] rounded-full font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Niedrig</SelectItem>
                <SelectItem value="medium">Mittel</SelectItem>
                <SelectItem value="high">Hoch</SelectItem>
                <SelectItem value="urgent">Dringend</SelectItem>
              </SelectContent>
            </Select>

            <input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              className="min-w-[240px] flex-1 border-0 bg-transparent p-0 text-2xl font-bold leading-tight text-foreground outline-none ring-0 focus-visible:outline-none focus-visible:ring-0 lg:text-2xl"
              placeholder="Titel"
            />

            <div className="flex min-w-[220px] items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Eingang</span>
              <input
                type="date"
                value={sourceReceivedAt}
                onChange={(event) => onSourceReceivedAtChange(event.target.value)}
                className="h-8 w-full rounded-md border bg-background px-2 text-sm font-medium text-foreground"
              />
            </div>

            <div className="flex min-w-[220px] items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bearbeiter</span>
              <Select value={assigneeId || "__none__"} onValueChange={(value) => onAssigneeChange(value === "__none__" ? "" : value)}>
                <SelectTrigger className="h-8 w-full">
                  <SelectValue placeholder="Nicht zugewiesen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nicht zugewiesen</SelectItem>
                  {assigneeOptions.map((member) => (
                    <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="rounded-2xl border bg-gray-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fälligkeit</p>
              <div className="pt-1">
                <input
                  type="date"
                  value={dueDateValue}
                  onChange={(event) => onDueDateChange(event.target.value)}
                  className="h-8 w-full rounded-md border bg-background px-2 text-sm font-bold text-foreground"
                />
              </div>
            </div>
            <div className="rounded-2xl border bg-gray-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
              <Select value={status} onValueChange={onStatusChange}>
                <SelectTrigger className="mt-1 h-8 w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((statusOption) => (
                    <SelectItem key={statusOption.value} value={statusOption.value}>{statusOption.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-2xl border bg-gray-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kategorie</p>
              <Select value={category} onValueChange={onCategoryChange}>
                <SelectTrigger className="mt-1 h-8 w-full bg-background">
                  <SelectValue placeholder="Kategorie wählen" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((categoryOption) => (
                    <SelectItem key={categoryOption} value={categoryOption}>{categoryOption}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold">
              <Globe className={cn("h-3.5 w-3.5", isPublic ? "text-blue-600" : "text-muted-foreground")} />
              <span>{isPublic ? "Öffentlich" : "Nicht öffentlich"}</span>
              <Switch checked={isPublic} onCheckedChange={onPublicChange} />
            </div>
            {linkedFileName ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                onClick={onOpenCaseFiles}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                {linkedFileName}
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
                onClick={onOpenCaseFiles}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Mit Akte verknüpfen
              </button>
            )}
          </div>
        </div>

        <div className="border-t px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: "overview", label: "Übersicht" },
              { key: "timeline", label: "Timeline" },
              { key: "documents", label: "Dokumente" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key as DetailTab)}
                className={cn(
                  "rounded-full border px-5 py-2 text-sm font-semibold transition-colors",
                  activeTab === tab.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">{detailPanel}</div>
      </ScrollArea>
    </div>
  );
}
