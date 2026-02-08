import { Badge } from "@/components/ui/badge";

export type PressReleaseStatus = 'draft' | 'pending_approval' | 'revision_requested' | 'approved' | 'published';

const statusConfig: Record<PressReleaseStatus, { label: string; className: string }> = {
  draft: {
    label: 'Entwurf',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  },
  pending_approval: {
    label: 'Zur Freigabe',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  },
  revision_requested: {
    label: 'Überarbeitung',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  },
  approved: {
    label: 'Freigegeben',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  published: {
    label: 'Veröffentlicht',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
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
