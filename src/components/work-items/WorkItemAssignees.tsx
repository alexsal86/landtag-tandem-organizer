/**
 * Shared assignee avatars/picker for the WorkItem abstraction.
 *
 * Read-only avatar stack today — clicking opens an optional onChange callback
 * so the host can wire up its existing assignee picker dialog. This avoids
 * coupling the shared component to any single domain's mutation logic.
 */

import { useTenantProfiles } from '@/hooks/useTenantProfiles';
import type { WorkItemAssignee } from '@/types/workItem';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface Props {
  assignees: WorkItemAssignee[];
  max?: number;
  className?: string;
  onClick?: () => void;
}

export function WorkItemAssignees({ assignees, max = 3, className, onClick }: Props) {
  const { data: profiles = [] } = useTenantProfiles();

  if (assignees.length === 0) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'text-caption text-muted-foreground hover:text-foreground transition-colors',
          className,
        )}
      >
        Nicht zugewiesen
      </button>
    );
  }

  const visible = assignees.slice(0, max);
  const overflow = assignees.length - visible.length;

  return (
    <div className={cn('flex items-center -space-x-1.5', className)} onClick={onClick}>
      {visible.map((a) => {
        const profile = profiles.find((p) => p.user_id === a.user_id || p.id === a.user_id);
        const name = profile?.display_name ?? a.display_name ?? '?';
        const initials = name
          .split(/\s+/)
          .map((w) => w[0])
          .filter(Boolean)
          .slice(0, 2)
          .join('')
          .toUpperCase();
        return (
          <Avatar key={a.user_id} className="h-6 w-6 ring-2 ring-background">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={name} />}
            <AvatarFallback className="text-caption">{initials}</AvatarFallback>
          </Avatar>
        );
      })}
      {overflow > 0 && (
        <span className="ml-2 text-caption tabular-nums text-muted-foreground">+{overflow}</span>
      )}
    </div>
  );
}
