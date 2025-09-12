import React from 'react';
import { Wifi, WifiOff, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CollaborationUser {
  user_id: string;
  user_color: string;
  profiles?: {
    display_name: string;
    avatar_url?: string;
  };
}

interface CollaborationStatusProps {
  isConnected: boolean;
  isConnecting?: boolean;
  users: CollaborationUser[];
  currentUser?: any;
}

const CollaborationStatus: React.FC<CollaborationStatusProps> = ({ isConnected, isConnecting, users, currentUser }) => {
  console.log('🎨 CollaborationStatus props:', { isConnected, isConnecting, users, currentUser });
  const otherUsers = users.filter(user => user.user_id !== currentUser?.id);
  console.log('🎨 Filtered other users:', otherUsers);
  
  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 px-3 py-2 bg-background border rounded-lg">
        {/* Connection Status */}
        <div className="flex items-center gap-1">
          {isConnected ? (
            <Wifi className="h-4 w-4 text-success" />
          ) : isConnecting ? (
            <Wifi className="h-4 w-4 text-warning animate-pulse" />
          ) : (
            <WifiOff className="h-4 w-4 text-destructive" />
          )}
          <span className="text-xs text-muted-foreground">
            {isConnected ? 'Verbunden' : isConnecting ? 'Verbindet...' : 'Getrennt'}
          </span>
        </div>

        {/* User Count */}
        {otherUsers.length > 0 && (
          <>
            <div className="w-px h-4 bg-border" />
            <Badge variant="secondary" className="text-xs">
              {otherUsers.length} {otherUsers.length === 1 ? 'Nutzer' : 'Nutzer'} online
            </Badge>
          </>
        )}

        {/* Current User Avatar - Always shown when connected */}
        {isConnected && currentUser && (
          <>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Sie:</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-6 w-6 border-2 border-primary">
                    <AvatarImage 
                      src={currentUser.user_metadata?.avatar_url} 
                      alt={currentUser.user_metadata?.display_name || currentUser.email?.split('@')[0] || 'Sie'} 
                    />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {currentUser.user_metadata?.display_name 
                        ? currentUser.user_metadata.display_name.charAt(0).toUpperCase()
                        : currentUser.email?.charAt(0).toUpperCase() || <User className="h-3 w-3" />
                      }
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{currentUser.user_metadata?.display_name || currentUser.email?.split('@')[0] || 'Sie'}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </>
        )}

        {/* Other Users Avatars */}
        {otherUsers.length > 0 && (
          <>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Andere:</span>
              <div className="flex -space-x-2">
                {otherUsers.slice(0, 3).map((user) => (
                  <Tooltip key={user.user_id}>
                    <TooltipTrigger asChild>
                      <Avatar 
                        className="h-6 w-6 border-2 border-background" 
                        style={{ borderColor: user.user_color }}
                      >
                        <AvatarImage 
                          src={user.profiles?.avatar_url} 
                          alt={user.profiles?.display_name || 'Nutzer'} 
                        />
                        <AvatarFallback 
                          className="text-xs"
                          style={{ 
                            backgroundColor: user.user_color + '20', 
                            color: user.user_color 
                          }}
                        >
                          {user.profiles?.display_name 
                            ? user.profiles.display_name.charAt(0).toUpperCase()
                            : <User className="h-3 w-3" />
                          }
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{user.profiles?.display_name || 'Unbekannter Nutzer'}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
                
                {/* Show +N indicator if more than 3 users */}
                {otherUsers.length > 3 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">
                          +{otherUsers.length - 3}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{otherUsers.length - 3} weitere Nutzer</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
};

export default CollaborationStatus;