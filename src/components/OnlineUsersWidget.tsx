import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUserStatus } from '@/hooks/useUserStatus';
import { Users, Wifi, Clock } from 'lucide-react';

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
    <Card className="h-[400px]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Online Benutzer
          <Badge variant="secondary" className="ml-auto">
            {onlineUsers.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {onlineUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Wifi className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">Niemand online</p>
            <p className="text-sm text-muted-foreground">
              Benutzer werden hier angezeigt, sobald sie sich verbinden
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
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
                      {/* Status dot overlay */}
                      <div 
                        className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center"
                        style={{ backgroundColor: statusDisplay.color }}
                      >
                        <span className="text-xs">{statusDisplay.emoji}</span>
                      </div>
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm truncate">
                          {user.display_name || 'Unbekannt'}
                        </h4>
                        <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                          {statusDisplay.label}
                        </Badge>
                      </div>
                      
                      {/* Custom Status Message */}
                      {user.status?.custom_message && (
                        <p className="text-sm text-muted-foreground truncate mb-1">
                          {user.status.custom_message}
                        </p>
                      )}
                      
                      {/* Online Time */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
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
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};