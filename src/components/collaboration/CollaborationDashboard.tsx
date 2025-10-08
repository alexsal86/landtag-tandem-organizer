import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Activity, 
  MessageCircle, 
  Clock, 
  Eye,
  EyeOff,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useYjsProvider } from './YjsProvider';

interface ActivityItem {
  id: string;
  type: 'edit' | 'comment' | 'join' | 'leave';
  user: string;
  userName: string;
  timestamp: Date;
  description: string;
}

interface CollaborationDashboardProps {
  documentId: string;
  isVisible?: boolean;
  onToggle?: () => void;
}

export function CollaborationDashboard({ 
  documentId, 
  isVisible = false, 
  onToggle 
}: CollaborationDashboardProps) {
  const { collaborators, currentUser, isConnected, isSynced } = useYjsProvider();
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [showOfflineUsers, setShowOfflineUsers] = useState(false);

  // Mock activity feed - in real implementation, this would come from Supabase
  useEffect(() => {
    const mockActivities: ActivityItem[] = [
      {
        id: '1',
        type: 'edit',
        user: 'user1',
        userName: 'Max Mustermann',
        timestamp: new Date(Date.now() - 5 * 60000),
        description: 'Hat den ersten Absatz bearbeitet'
      },
      {
        id: '2',
        type: 'comment',
        user: 'user2',
        userName: 'Anna Schmidt',
        timestamp: new Date(Date.now() - 10 * 60000),
        description: 'Hat einen Kommentar hinzugefügt'
      },
      {
        id: '3',
        type: 'join',
        user: 'user3',
        userName: 'Peter Weber',
        timestamp: new Date(Date.now() - 15 * 60000),
        description: 'Hat das Dokument geöffnet'
      }
    ];
    setActivityFeed(mockActivities);
  }, [documentId]);

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'edit':
        return <Activity className="h-4 w-4 text-blue-500" />;
      case 'comment':
        return <MessageCircle className="h-4 w-4 text-green-500" />;
      case 'join':
        return <Users className="h-4 w-4 text-purple-500" />;
      case 'leave':
        return <Users className="h-4 w-4 text-gray-500" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / 60000);
    
    if (diffInMinutes < 1) return 'Gerade eben';
    if (diffInMinutes < 60) return `vor ${diffInMinutes} Min`;
    if (diffInMinutes < 1440) return `vor ${Math.floor(diffInMinutes / 60)} Std`;
    return timestamp.toLocaleDateString();
  };

  if (!isVisible) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        title="Aktivitäts-Stream öffnen"
      >
        <Activity className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="fixed top-16 right-4 w-80 z-30">
      <Card className="shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Zusammenarbeit</h3>
            <Button variant="ghost" size="sm" onClick={onToggle}>
              <EyeOff className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            {isConnected ? (
              <div className="flex items-center gap-1 text-green-600">
                <Wifi className="h-4 w-4" />
                <span className="text-sm">Verbunden</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-red-600">
                <WifiOff className="h-4 w-4" />
                <span className="text-sm">Nicht verbunden</span>
              </div>
            )}
            
            {isSynced && (
              <Badge variant="secondary" className="text-xs">
                Synchronisiert
              </Badge>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Current User */}
          {currentUser && (
            <div className="p-2 bg-primary/10 rounded-lg">
              <div className="flex items-center gap-2">
                {currentUser.profile?.avatar_url ? (
                  <img
                    src={currentUser.profile.avatar_url}
                    alt="You"
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs">
                    Sie
                  </div>
                )}
                <span className="text-sm font-medium">
                  Sie ({currentUser.profile?.display_name || currentUser.email?.split('@')[0]})
                </span>
              </div>
            </div>
          )}

          {/* Online Collaborators */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Online ({collaborators.length})
            </h4>
            
            {collaborators.length > 0 ? (
              <div className="space-y-2">
                {collaborators.map((collaborator) => (
                  <div key={collaborator.user_id} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: collaborator.user_color }}
                    />
                    {collaborator.profiles?.avatar_url ? (
                      <img
                        src={collaborator.profiles.avatar_url}
                        alt={collaborator.profiles.display_name}
                        className="w-5 h-5 rounded-full"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs">
                        {collaborator.profiles?.display_name?.charAt(0) || '?'}
                      </div>
                    )}
                    <span className="text-sm">
                      {collaborator.profiles?.display_name || 'Unknown User'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Keine anderen Benutzer online
              </p>
            )}
          </div>

          {/* Activity Feed */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Aktivitäten
            </h4>
            
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {activityFeed.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-2 text-sm">
                    {getActivityIcon(activity.type)}
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{activity.userName}</span>
                        <span className="text-muted-foreground">
                          {formatTimeAgo(activity.timestamp)}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {activity.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 bg-muted/30 rounded">
              <div className="text-lg font-semibold">{collaborators.length + 1}</div>
              <div className="text-xs text-muted-foreground">Aktive Benutzer</div>
            </div>
            <div className="p-2 bg-muted/30 rounded">
              <div className="text-lg font-semibold">{activityFeed.length}</div>
              <div className="text-xs text-muted-foreground">Heute</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}