import type { ReactNode } from "react";
import { FileText, FolderOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

type CaseItemDetailViewProps = {
  title: string;
  statusBadge: ReactNode;
  dueBadge?: ReactNode;
  contactDisplay?: string;
  detailPanel: ReactNode;
  onOpenCaseFiles?: () => void;
  linkedFileName?: string | null;
};

export function CaseItemDetailView({
  title,
  statusBadge,
  dueBadge,
  contactDisplay,
  detailPanel,
  onOpenCaseFiles,
  linkedFileName,
}: CaseItemDetailViewProps) {
  return (
    <div className="flex flex-col h-full min-h-0 border-l bg-background">
      {/* Header */}
      <div className="shrink-0 border-b px-4 py-3 space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-3 w-3" />
          <span>Vorgang</span>
          {linkedFileName && (
            <>
              <span>·</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                onClick={onOpenCaseFiles}
              >
                <FolderOpen className="h-3 w-3" />
                {linkedFileName}
              </button>
            </>
          )}
        </div>
        <h2 className="text-base font-semibold leading-tight line-clamp-2">{title}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {statusBadge}
          {dueBadge}
          {contactDisplay && (
            <span className="text-xs text-muted-foreground">👤 {contactDisplay}</span>
          )}
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
