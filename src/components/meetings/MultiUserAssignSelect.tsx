import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
}

interface MultiUserAssignSelectProps {
  assignedTo: string[] | null;
  profiles: Profile[];
  onChange: (userIds: string[]) => void;
  size?: 'sm' | 'default';
}

export function MultiUserAssignSelect({ 
  assignedTo, 
  profiles, 
  onChange,
  size = 'default'
}: MultiUserAssignSelectProps) {
  const selectedIds = assignedTo || [];
  const selectedProfiles = profiles.filter(p => selectedIds.includes(p.user_id));
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const toggleUser = (userId: string) => {
    const current = assignedTo || [];
    const updated = current.includes(userId)
      ? current.filter(id => id !== userId)
      : [...current, userId];
    onChange(updated);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size={size} 
          className={cn(
            "justify-start gap-2",
            size === 'sm' ? 'h-8 text-xs' : 'h-9'
          )}
        >
          <Users className={cn("text-muted-foreground", size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
          {selectedProfiles.length === 0 ? (
            <span className="text-muted-foreground">Zuweisen...</span>
          ) : selectedProfiles.length === 1 ? (
            <span>{selectedProfiles[0].display_name}</span>
          ) : (
            <div className="flex items-center gap-1">
              <div className="flex -space-x-2">
                {selectedProfiles.slice(0, 3).map(profile => (
                  <Avatar key={profile.user_id} className={cn(size === 'sm' ? 'h-5 w-5' : 'h-6 w-6', 'border-2 border-background')}>
                    <AvatarFallback className="text-[10px]">
                      {getInitials(profile.display_name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              {selectedProfiles.length > 3 && (
                <span className="text-xs text-muted-foreground">+{selectedProfiles.length - 3}</span>
              )}
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-1">
          <p className="text-sm font-medium px-2 py-1.5">Zuständige auswählen</p>
          <div className="max-h-[200px] overflow-y-auto">
            {profiles.map(profile => (
              <div 
                key={profile.user_id} 
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                onClick={() => toggleUser(profile.user_id)}
              >
                <Checkbox 
                  checked={selectedIds.includes(profile.user_id)}
                  onCheckedChange={() => toggleUser(profile.user_id)}
                />
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {getInitials(profile.display_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm flex-1">{profile.display_name || 'Unbekannt'}</span>
              </div>
            ))}
          </div>
          {selectedIds.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full mt-2 text-muted-foreground"
              onClick={() => onChange([])}
            >
              Alle abwählen
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
