import { CaseFile } from "@/features/cases/files/hooks";
import { useCaseFileProcessingStatuses } from "@/hooks/useCaseFileProcessingStatuses";
import { LucideIcon } from "lucide-react";
import { getLucideIcon } from "@/utils/iconUtils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Archive, ArchiveRestore, Trash2, ArrowLeft, Pencil, EyeOff, Users as UsersIcon, Globe } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CaseFileProcessingStatus } from "@/hooks/useCaseFileProcessingStatuses";

const toProcessingStatusNames = (caseFile: CaseFile): string[] => {
  if (Array.isArray(caseFile.processing_statuses)) {
    return caseFile.processing_statuses.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof caseFile.processing_status === "string" && caseFile.processing_status.length > 0) {
    return [caseFile.processing_status];
  }
  return [];
};

interface CaseFileDetailHeaderProps {
  caseFile: CaseFile;
  onBack: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onEdit: () => void;
}

const VISIBILITY_LABELS: Record<string, { label: string; Icon: LucideIcon }> = {
  private: { label: "Privat", Icon: EyeOff },
  shared: { label: "Geteilt", Icon: UsersIcon },
  public: { label: "Öffentlich", Icon: Globe },
};

export function CaseFileDetailHeader({
  caseFile,
  onBack,
  onDelete,
  onArchive,
  onEdit,
}: CaseFileDetailHeaderProps) {
  const { statuses: processingStatuses } = useCaseFileProcessingStatuses();
  const [assigneeName, setAssigneeName] = useState<string | null>(null);
  const [assigneeRole, setAssigneeRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!caseFile.assigned_to) {
      setAssigneeName(null);
      setAssigneeRole(null);
      return;
    }
    supabase
      .from("profiles")
      .select("display_name, role")
      .eq("user_id", caseFile.assigned_to)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setAssigneeName(data?.display_name ?? null);
        setAssigneeRole((data?.role as string | undefined) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [caseFile.assigned_to]);

  const getIconComponent = (iconName?: string | null): LucideIcon | null => {
    if (!iconName) return null;
    return getLucideIcon(iconName);
  };

  const activeProcessingStatuses: CaseFileProcessingStatus[] = toProcessingStatusNames(caseFile)
    .map((name) => processingStatuses.find((status) => status.name === name))
    .filter((status): status is CaseFileProcessingStatus => Boolean(status));

  const visibility = VISIBILITY_LABELS[caseFile.visibility as keyof typeof VISIBILITY_LABELS] ?? VISIBILITY_LABELS.public;
  const VisIcon = visibility.Icon;

  const fmtDate = (d?: string | null) => (d ? format(new Date(d), "dd.MM.yyyy", { locale: de }) : "—");
  const fmtUpdated = (d: string) => `${format(new Date(d), "dd.MM.yyyy", { locale: de })} · ${format(new Date(d), "HH:mm", { locale: de })}`;

  // Field cell for the meta strip
  const Field = ({
    label,
    value,
    sub,
    accent,
  }: {
    label: string;
    value: React.ReactNode;
    sub?: React.ReactNode;
    accent?: boolean;
  }) => (
    <div className="flex-1 min-w-[140px] px-4 py-3 border-r border-border last:border-r-0">
      <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-1">
        {label}
      </div>
      <div className={`text-sm font-semibold leading-tight ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Back + Title row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2 mb-1 h-7 text-muted-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{caseFile.title}</h1>
          {caseFile.description && (
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{caseFile.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {activeProcessingStatuses.map((ps) => {
            const PIcon = getIconComponent(ps?.icon);
            return (
              <Badge
                key={ps.name}
                style={{ backgroundColor: ps.color || undefined }}
                className="text-primary-foreground"
              >
                {PIcon && <PIcon className="h-3 w-3 mr-1" />}
                {ps.label}
              </Badge>
            );
          })}
          <Button variant="outline" size="sm" onClick={onArchive}>
            {caseFile.status === "archived" ? <ArchiveRestore className="mr-1.5 h-4 w-4" /> : <Archive className="mr-1.5 h-4 w-4" />}
            {caseFile.status === "archived" ? "Wiederherstellen" : "Archivieren"}
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Bearbeiten
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Meta strip */}
      <div className="flex flex-wrap rounded-lg border bg-card overflow-hidden">
        <Field
          label="Zuständig"
          value={assigneeName ?? "—"}
          sub={assigneeRole ?? undefined}
        />
        <Field label="Start" value={fmtDate(caseFile.start_date)} />
        <Field label="Zieltermin" value={fmtDate(caseFile.target_date)} accent />
        <Field
          label="Sichtbarkeit"
          value={
            <span className="inline-flex items-center gap-1.5">
              <VisIcon className="h-3.5 w-3.5" />
              {visibility.label}
            </span>
          }
        />
        <Field label="Aktualisiert" value={fmtUpdated(caseFile.updated_at)} />
      </div>
    </div>
  );
}
