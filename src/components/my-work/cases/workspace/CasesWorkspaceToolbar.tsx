import type { ReactNode } from "react";
import { Archive, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CasesWorkspaceToolbarProps = {
  title: ReactNode;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  onCreate: () => void;
  createLabel: string;
  onOpenArchive: () => void;
  archiveLabel?: string;
  archiveButtonClassName?: string;
  searchClassName?: string;
  children?: ReactNode;
};

export function CasesWorkspaceToolbar({
  title,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  onCreate,
  createLabel,
  onOpenArchive,
  archiveLabel = "Archiv",
  archiveButtonClassName,
  searchClassName,
  children,
}: CasesWorkspaceToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-base font-semibold">{title}</div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <Button size="sm" onClick={onCreate}>
          <Plus className="mr-1 h-4 w-4" />
          {createLabel}
        </Button>
        <div className="flex items-center gap-2">
          <div className={searchClassName ?? "relative w-full sm:w-64"}>
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 pl-8"
            />
          </div>
          <Button variant="outline" size="sm" className={archiveButtonClassName ?? "h-9 shrink-0 gap-1.5"} onClick={onOpenArchive} title="Archiv öffnen">
            <Archive className="h-4 w-4" />
            {archiveLabel}
          </Button>
          {children}
        </div>
      </div>
    </div>
  );
}
