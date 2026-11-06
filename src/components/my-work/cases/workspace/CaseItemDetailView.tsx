import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  ballPanel?: ReactNode;
  onComplete: () => void;
  onArchive: () => void;
  archiveLabel: string;
  onDelete: () => void;
  /** Plain-text core concern, pinned above the scrolling detail area. */
  summary?: string;
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
  ballPanel,
  onComplete,
  onArchive,
  archiveLabel,
  onDelete,
  summary,
  activeTab,
  onTabChange,
  onOpenCaseFiles,
  linkedFileName,
  isPublic,
  onPublicChange,
}: CaseItemDetailViewProps) {
  const propertySelect = (label: string, value: string, onChange: (value: string) => void, options: Array<{ value: string; label: string }>, placeholder?: string) => (
    <div className="flex items-center gap-4 border-b border-border/50 py-3">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="ml-auto h-auto min-h-8 min-w-0 flex-1 justify-end gap-2 border-0 bg-transparent px-0 text-right text-sm shadow-none [&>span]:truncate">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
  const propertyDate = (label: string, value: string, onChange: (value: string) => void) => (
    <label className="flex items-center gap-4 border-b border-border/50 py-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <input aria-label={label} type="date" value={value} onChange={(event) => onChange(event.target.value)} className="ml-auto min-w-0 flex-1 rounded-md border-0 bg-transparent py-1 text-right text-foreground focus-visible:outline-primary" />
    </label>
  );

  return (
    <div className="grid h-full min-h-0 min-w-0 grid-cols-1 overflow-y-auto bg-card min-[1440px]:grid-cols-[minmax(0,1fr)_300px] min-[1440px]:overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="shrink-0 border-b px-6 pb-4 pt-5">
          <input
            aria-label="Titel"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            className="w-full min-w-0 border-0 bg-transparent p-0 text-2xl font-bold leading-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
            placeholder="Titel"
          />
        </div>
        {ballPanel}
        <div className="shrink-0 border-b px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: "overview", label: "Übersicht" },
              { key: "timeline", label: "Timeline" },
              { key: "documents", label: "Dokumente" },
            ].map((tab) => (
              <button key={tab.key} type="button" onClick={() => onTabChange(tab.key as DetailTab)}
                className={cn("rounded-full border px-5 py-2 text-sm font-semibold transition-colors", activeTab === tab.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted")}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {summary?.trim() ? <PinnedSummary text={summary.trim()} /> : null}
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4">{detailPanel}</div>
        </ScrollArea>
      </div>
      <aside aria-label="Eigenschaften" className="flex min-h-0 flex-col overflow-y-auto border-t bg-muted/10 px-6 py-7 min-[1440px]:border-l min-[1440px]:border-t-0">
        <div className="flex-1">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Eigenschaften</h2>
        {propertySelect("Bearbeiter", assigneeId || "__none__", (value) => onAssigneeChange(value === "__none__" ? "" : value), [{ value: "__none__", label: "Nicht zugewiesen" }, ...assigneeOptions.map((member) => ({ value: member.id, label: member.name }))])}
        {propertySelect("Kategorie", category, onCategoryChange, categoryOptions.map((value) => ({ value, label: value })), "Wählen…")}
        {propertySelect("Sichtbarkeit", isPublic ? "public" : "private", (value) => onPublicChange(value === "public"), [{ value: "private", label: "Nicht öffentlich" }, { value: "public", label: "Öffentlich" }])}
        <div className="flex items-center gap-4 py-3 text-sm">
          <span className="text-muted-foreground">Akte</span>
          <button type="button" onClick={onOpenCaseFiles} className="ml-auto min-w-0 break-words text-right font-semibold text-success hover:underline">
            {linkedFileName || "Verknüpfen"}
          </button>
        </div>
        <div className="mt-6">
          {propertySelect("Status", status, onStatusChange, statusOptions)}
          {propertySelect("Priorität", priority, onPriorityChange, [{ value: "low", label: "Niedrig" }, { value: "medium", label: "Mittel" }, { value: "high", label: "Hoch" }, { value: "urgent", label: "Dringend" }])}
          {propertyDate("Eingang", sourceReceivedAt, onSourceReceivedAtChange)}
          {propertyDate("Fälligkeit", dueDateValue, onDueDateChange)}
        </div>
        </div>
        <div className="mt-8 shrink-0 space-y-3 border-t border-border/70 pt-6">
          <Button type="button" variant="outline" onClick={onComplete} disabled={status === "erledigt"} className="h-11 w-full rounded-xl border-2 border-success bg-background font-semibold text-success hover:bg-success/5 hover:text-success">
            Vorgang erledigt
          </Button>
          <Button type="button" variant="ghost" onClick={onArchive} className="w-full justify-start px-3 font-normal">{archiveLabel}</Button>
          <Button type="button" variant="ghost" onClick={onDelete} className="w-full justify-start px-3 font-normal text-destructive hover:bg-destructive/10 hover:text-destructive">Vorgang löschen</Button>
        </div>
      </aside>
    </div>
  );
}

function PinnedSummary({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 180;
  return (
    <div className="shrink-0 border-b bg-muted/40 px-6 py-2.5" aria-label="Sachlage">
      <div className="flex items-start gap-3">
        <span className="section-label mt-0.5 shrink-0">Sachlage</span>
        <p className={cn("flex-1 text-sm text-foreground whitespace-pre-line", !expanded && "line-clamp-2")}>{text}</p>
        {long ? (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="shrink-0 text-xs font-medium text-primary hover:underline">
            {expanded ? "Weniger" : "Mehr"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
