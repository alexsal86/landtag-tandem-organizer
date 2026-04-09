import type { ReactNode } from "react";
import { FileText, FolderOpen, Globe } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type CaseItemDetailViewProps = {
  title: string;
  statusBadge: ReactNode;
  dueBadge?: ReactNode;
  contactDisplay?: string;
  detailPanel: ReactNode;
  onOpenCaseFiles?: () => void;
  linkedFileName?: string | null;
  isPublic?: boolean;
};

export function CaseItemDetailView({
  title,
  statusBadge,
  dueBadge,
  contactDisplay,
  detailPanel,
  onOpenCaseFiles,
  linkedFileName,
  isPublic,
}: CaseItemDetailViewProps) {
  return (
    <div className="flex flex-col h-full min-h-0 border-l bg-background">
      {/* Header */}
      <div className="shrink-0 border-b">
        <div className="px-6 pb-4 pt-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                <span className="text-sm">Vorgang</span>
              </div>
              <h2 className="text-3xl font-semibold leading-tight text-foreground lg:text-5xl">{title}</h2>
              <p className="text-sm text-muted-foreground">
                Alle Kerninformationen an einem Ort.
              </p>
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

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:min-w-[380px]">
              <div className="rounded-2xl border bg-muted/20 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fälligkeit</p>
                <div className="pt-1 text-sm font-semibold text-foreground">{dueBadge ?? "–"}</div>
              </div>
              <div className="rounded-2xl border bg-muted/20 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
                <div className="pt-1">{statusBadge}</div>
              </div>
              <div className="rounded-2xl border bg-muted/20 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kontakt</p>
                <div className="pt-1 text-sm font-semibold text-foreground">{contactDisplay || "–"}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {["Übersicht", "Timeline", "Dokumente", "Fallakten"].map((tab, index) => (
              <button
                key={tab}
                type="button"
                className={cn(
                  "rounded-full border px-5 py-2 text-sm font-semibold transition-colors",
                  index === 0 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                {tab}
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
