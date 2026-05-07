import { Badge } from "@/components/ui/badge";

export type PressReleaseStatus = 'draft' | 'pending_approval' | 'revision_requested' | 'approved' | 'published';

const statusConfig: Record<PressReleaseStatus, { label: string; className: string }> = {
  draft: {
    label: 'Entwurf',
    className: 'bg-muted text-foreground',
  },
  pending_approval: {
    label: 'Zur Freigabe',
    className: 'bg-palette-orange/20 text-palette-orange',
  },
  revision_requested: {
    label: 'Überarbeitung',
    className: 'bg-palette-yellow/20 text-palette-yellow',
  },
  approved: {
    label: 'Freigegeben',
    className: 'bg-palette-green/20 text-palette-green',
  },
  published: {
    label: 'Veröffentlicht',
    className: 'bg-palette-blue/20 text-palette-blue',
  },
};

interface PressReleaseStatusBadgeProps {
  status: string;
}

export function PressReleaseStatusBadge({ status }: PressReleaseStatusBadgeProps) {
  const config = statusConfig[status as PressReleaseStatus] || statusConfig.draft;
  
  return (
    <Badge className={config.className}>
      {config.label}
    </Badge>
  );
}
