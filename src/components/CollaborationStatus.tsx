import React from 'react';
import { Users, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CollaborationUser {
  id: string;
  name?: string;
  avatar?: string;
  color?: string;
  cursor?: { x: number; y: number };
}

interface CollaborationStatusProps {
  isConnected: boolean;
  users: CollaborationUser[];
  currentUser?: CollaborationUser;
}

const CollaborationStatus: React.FC<CollaborationStatusProps> = ({
  isConnected,
  users,
  currentUser
}) => {
  const otherUsers = users.filter(user => user.id !== currentUser?.id);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border">
      {/* Connection Status */}
      <div className="flex items-center gap-1">
        {isConnected ? (
          <Wifi className="h-4 w-4 text-green-600" />
        ) : (
          <WifiOff className="h-4 w-4 text-red-600" />
        )}
        <span className="text-xs font-medium">
          {isConnected ? 'Verbunden' : 'Getrennt'}
        </span>
      </div>

      {/* User Count */}
      {otherUsers.length > 0 && (
        <>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Badge variant="secondary" className="text-xs">
              {otherUsers.length} {otherUsers.length === 1 ? 'Benutzer' : 'Benutzer'}
            </Badge>
          </div>
        </>
      )}

      {/* Online Users */}
      {otherUsers.length > 0 && (
        <TooltipProvider>
          <div className="flex items-center -space-x-2">
            {otherUsers.slice(0, 3).map((user) => (
              <Tooltip key={user.id}>
                <TooltipTrigger>
                  <Avatar className="h-6 w-6 border-2 border-background">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback 
                      className="text-xs"
                      style={{ backgroundColor: user.color || '#3b82f6' }}
                    >
                      {user.name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{user.name || 'Unbekannter Benutzer'}</p>
                </TooltipContent>
              </Tooltip>
            ))}
            {otherUsers.length > 3 && (
              <div className="h-6 w-6 rounded-full border-2 border-background bg-muted flex items-center justify-center">
                <span className="text-xs font-medium">+{otherUsers.length - 3}</span>
              </div>
            )}
          </div>
        </TooltipProvider>
      )}
    </div>
  );
};

export default CollaborationStatus;