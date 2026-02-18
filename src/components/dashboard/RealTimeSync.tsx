import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Wifi, 
  WifiOff, 
  Users, 
  Cloud, 
  CloudOff, 
  RefreshCw,
  Eye,
  UserCheck
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { DashboardLayout } from '@/hooks/useDashboardLayout';
import { toast } from 'sonner';

interface RealTimeSyncProps {
  currentLayout: DashboardLayout;
  onLayoutUpdate: (layout: DashboardLayout) => void;
}

interface ConnectedUser {
  id: string;
  email: string;
  avatar_url?: string;
  is_online: boolean;
  last_seen: string;
  cursor_position?: { x: number; y: number };
}

export function RealTimeSync({ currentLayout, onLayoutUpdate }: RealTimeSyncProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [showUserList, setShowUserList] = useState(false);
  const [syncErrors, setSyncErrors] = useState<string[]>([]);
  const channelRef = React.useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user) return;

    initializeRealTimeSync();
    
    return () => {
      cleanup();
    };
  }, [user]);

  const initializeRealTimeSync = async () => {
    try {
      // Setup presence tracking
      const channel = supabase.channel('dashboard_presence', {
        config: {
          presence: {
            key: user?.id
          }
        }
      });
      channelRef.current = channel;

      // Track user presence
      channel
        .on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          const users = Object.values(presenceState).flat().map((presence: any) => ({
            id: presence.user_id || 'unknown',
            email: presence.email || 'Unknown User',
            avatar_url: presence.avatar_url,
            is_online: true,
            last_seen: new Date().toISOString(),
            cursor_position: presence.cursor_position
          }));
          setConnectedUsers(users);
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          console.log('User joined:', newPresences);
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          console.log('User left:', leftPresences);
        });

      // Subscribe to dashboard changes
      channel
        .on('broadcast', { event: 'layout_update' }, (payload) => {
          handleRemoteLayoutUpdate(payload);
        })
        .on('broadcast', { event: 'widget_update' }, (payload) => {
          handleRemoteWidgetUpdate(payload);
        })
        .on('broadcast', { event: 'cursor_move' }, (payload) => {
          handleCursorUpdate(payload);
        });

      // Subscribe and track presence
      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          
          // Track current user presence
          await channel.track({
            user_id: user?.id,
            email: user?.email,
            avatar_url: user?.user_metadata?.avatar_url,
            online_at: new Date().toISOString()
          });
          
          toast.success('Real-time sync activated');
        }
      });

      // Setup layout persistence
      setupLayoutPersistence();
      
    } catch (error) {
      console.error('Real-time sync initialization failed:', error);
      setIsConnected(false);
      setSyncErrors(prev => [...prev, 'Failed to initialize sync']);
    }
  };

  const setupLayoutPersistence = async () => {
    if (!user) return;

    try {
      // Save layout to database
      const { error } = await supabase
        .from('team_dashboards')
        .upsert({
          owner_id: user.id,
          name: currentLayout.name,
          layout_data: JSON.parse(JSON.stringify(currentLayout)),
        updated_at: new Date().toISOString(),
        tenant_id: currentTenant?.id || 'default-tenant-id'
        }, {
          onConflict: 'owner_id'
        });

      if (error) throw error;

      setLastSyncTime(new Date());
      
      // Setup real-time listener for database changes
      const subscription = supabase
        .channel('dashboard_changes')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'team_dashboards',
          filter: `owner_id=neq.${user.id}` // Don't listen to own changes
        }, (payload) => {
          handleDatabaseLayoutUpdate(payload);
        })
        .subscribe();

    } catch (error) {
      console.error('Layout persistence setup failed:', error);
      setSyncErrors(prev => [...prev, 'Failed to setup persistence']);
    }
  };

  const handleRemoteLayoutUpdate = (payload: any) => {
    if (payload.user_id === user?.id) return; // Ignore own updates
    
    setIsSyncing(true);
    
    try {
      onLayoutUpdate(payload.layout);
      setLastSyncTime(new Date());
      toast.info(`Layout updated by ${payload.user_email}`);
    } catch (error) {
      console.error('Failed to apply remote layout update:', error);
      setSyncErrors(prev => [...prev, 'Failed to apply layout update']);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRemoteWidgetUpdate = (payload: any) => {
    if (payload.user_id === user?.id) return;
    
    // Handle individual widget updates for better performance
    console.log('Widget update received:', payload);
  };

  const handleCursorUpdate = (payload: any) => {
    // Update cursor positions for collaborative editing
    setConnectedUsers(prev => prev.map(user => 
      user.id === payload.user_id 
        ? { ...user, cursor_position: payload.position }
        : user
    ));
  };

  const handleDatabaseLayoutUpdate = (payload: any) => {
    if (payload.new.user_id === user?.id) return;
    
    try {
      const newLayout = payload.new.layout_data;
      onLayoutUpdate(newLayout);
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Failed to apply database layout update:', error);
    }
  };

  const broadcastLayoutUpdate = async (layout: DashboardLayout) => {
    if (!isConnected) return;

    try {
      const channel = supabase.channel('dashboard_presence');
      await channel.send({
        type: 'broadcast',
        event: 'layout_update',
        payload: {
          layout,
          user_id: user?.id,
          user_email: user?.email,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Failed to broadcast layout update:', error);
    }
  };

  const retryConnection = async () => {
    setIsConnected(false);
    setSyncErrors([]);
    await initializeRealTimeSync();
  };

  const cleanup = () => {
    // Only remove our own channel, not all channels in the client
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };

  const getConnectionStatus = () => {
    if (!isConnected) return { icon: WifiOff, color: 'text-destructive', text: 'Offline' };
    if (isSyncing) return { icon: RefreshCw, color: 'text-primary animate-spin', text: 'Syncing' };
    return { icon: Wifi, color: 'text-green-500', text: 'Online' };
  };

  const status = getConnectionStatus();
  const StatusIcon = status.icon;

  return (
    <>
      {/* Connection Status Indicator */}
      <div className="fixed top-6 right-20 z-50">
        <Card className="bg-background/95 backdrop-blur border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <StatusIcon className={`h-4 w-4 ${status.color}`} />
              <span className="text-sm font-medium">{status.text}</span>
              
              {connectedUsers.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUserList(!showUserList)}
                  className="h-6 w-6 p-0 ml-2"
                >
                  <Users className="h-3 w-3" />
                </Button>
              )}

              {!isConnected && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={retryConnection}
                  className="h-6 w-6 p-0 ml-2"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
            </div>

            {lastSyncTime && (
              <div className="text-xs text-muted-foreground mt-1">
                Last sync: {lastSyncTime.toLocaleTimeString()}
              </div>
            )}

            {syncErrors.length > 0 && (
              <div className="text-xs text-destructive mt-1">
                {syncErrors[syncErrors.length - 1]}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Connected Users List */}
      {showUserList && connectedUsers.length > 1 && (
        <Card className="fixed top-20 right-20 w-64 z-50 bg-background/95 backdrop-blur border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">Online Users</h4>
              <Badge variant="secondary" className="text-xs">
                {connectedUsers.length}
              </Badge>
            </div>
            
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {connectedUsers.map((connectedUser) => (
                <div
                  key={connectedUser.id}
                  className="flex items-center gap-2 p-2 rounded hover:bg-accent/50"
                >
                  <div className="relative">
                    {connectedUser.avatar_url ? (
                      <img
                        src={connectedUser.avatar_url}
                        alt=""
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center">
                        <UserCheck className="h-3 w-3" />
                      </div>
                    )}
                    {connectedUser.is_online && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-background" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {connectedUser.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {connectedUser.id === user?.id ? 'You' : 'Collaborator'}
                    </p>
                  </div>

                  <Eye className="h-3 w-3 text-muted-foreground" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Collaborative Cursors */}
      {connectedUsers
        .filter(u => u.id !== user?.id && u.cursor_position)
        .map(connectedUser => (
          <div
            key={`cursor-${connectedUser.id}`}
            className="fixed pointer-events-none z-50 transition-all duration-100"
            style={{
              left: connectedUser.cursor_position?.x,
              top: connectedUser.cursor_position?.y,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className="w-4 h-4 bg-primary rounded-full border-2 border-background shadow-lg" />
            <div className="absolute top-5 left-0 bg-primary text-primary-foreground px-2 py-1 rounded text-xs whitespace-nowrap">
              {connectedUser.email.split('@')[0]}
            </div>
          </div>
        ))}
    </>
  );
}