import type { ReactNode } from "react";
import { FolderOpen, Globe } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type DetailTab = "overview" | "timeline" | "documents";

type CaseItemDetailViewProps = {
  title: string;
  onTitleChange: (value: string) => void;
  statusBadge: ReactNode;
  dueDateValue: string;
  onDueDateChange: (value: string) => void;
  detailPanel: ReactNode;
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onOpenCaseFiles?: () => void;
  linkedFileName?: string | null;
  isPublic?: boolean;
};

export function CaseItemDetailView({
  title,
  onTitleChange,
  statusBadge,
  dueDateValue,
  onDueDateChange,
  detailPanel,
  activeTab,
  onTabChange,
  onOpenCaseFiles,
  linkedFileName,
  isPublic,
}: CaseItemDetailViewProps) {
  return (
    <div className="flex flex-col h-full min-h-0 bg-card">
      {/* Header */}
      <div className="shrink-0 border-b">
        <div className="px-6 pb-4 pt-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <input
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                className="w-full border-0 bg-transparent p-0 text-2xl font-bold leading-tight text-foreground outline-none ring-0 focus-visible:outline-none focus-visible:ring-0 lg:text-2xl"
                placeholder="Titel"
              />
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {isPublic && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    <Globe className="h-3.5 w-3.5" />
                    Öffentlich
                  </span>
                )}
                {linkedFileName && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                    onClick={onOpenCaseFiles}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    {linkedFileName}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                <div className="pt-1 text-sm font-bold text-foreground">{statusBadge}</div>
              </div>
            </div>
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

      {/* Content — the CaseItemDetailPanel handles its own tabs/sections */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          {detailPanel}
        </div>
      </ScrollArea>
    </div>
  );
}
