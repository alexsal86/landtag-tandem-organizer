import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUserStatus } from '@/hooks/useUserStatus';
import { Wifi, Clock } from 'lucide-react';

export const OnlineUsersWidget: React.FC = () => {
  const { onlineUsers, getStatusDisplay } = useUserStatus();

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const time = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'gerade eben';
    if (diffInMinutes < 60) return `vor ${diffInMinutes} Min`;
    if (diffInMinutes < 1440) return `vor ${Math.floor(diffInMinutes / 60)} Std`;
    return `vor ${Math.floor(diffInMinutes / 1440)} Tagen`;
  };

  return (
    <div>
        {onlineUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Wifi className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">Niemand online</p>
            <p className="text-sm text-muted-foreground">
              Benutzer werden hier angezeigt, sobald sie sich verbinden
            </p>
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            <div className="space-y-2 p-4">
              {onlineUsers.map((user) => {
                const statusDisplay = getStatusDisplay(user.status);
                return (
                  <div
                    key={user.user_id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    {/* Avatar with Status Indicator */}
                    <div className="relative">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={user.avatar_url} />
                        <AvatarFallback className="text-sm">
                          {user.display_name?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      {/* Status emoji overlay with tooltip */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div 
                              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center cursor-default"
                              style={{ backgroundColor: statusDisplay.color }}
                            >
                              <span className="text-[10px]">{statusDisplay.emoji}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs">
                            <p className="font-medium">{statusDisplay.label}</p>
                            {user.status?.custom_message && (
                              <p className="text-muted-foreground">{user.status.custom_message}</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm truncate">
                          {user.display_name || 'Unbekannt'}
                        </h4>
                      </div>
                      
                      {/* Custom Status Message */}
                      {user.status?.custom_message && (
                        <p className="text-sm text-muted-foreground truncate mb-1">
                          {user.status.custom_message}
                        </p>
                      )}
                      
                      {/* Online Time */}
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>Online {formatTimeAgo(user.online_at)}</span>
                      </div>
                    </div>

                    {/* Status Until Indicator */}
                    {user.status?.status_until && new Date(user.status.status_until) > new Date() && (
                      <div className="text-right">
                        <Badge variant="secondary" className="text-xs">
                          bis {new Date(user.status.status_until).toLocaleTimeString('de-DE', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </Badge>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
    </div>
  );
};