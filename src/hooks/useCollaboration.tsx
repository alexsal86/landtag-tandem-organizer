import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CollaborationMessage {
  type: 'join' | 'leave' | 'cursor' | 'selection' | 'content' | 'heartbeat' | 'collaborators' | 'connected' | 'ping' | 'pong' | 'error';
  documentId?: string;
  userId?: string;
  data?: any;
  timestamp: number;
}

interface Collaborator {
  user_id: string;
  user_color: string;
  cursor_position?: any;
  selection_state?: any;
  profiles?: {
    display_name: string;
    avatar_url?: string;
  };
}

interface UseCollaborationProps {
  documentId: string;
  onContentChange?: (content: string) => void;
  onCursorChange?: (userId: string, cursor: any) => void;
  onSelectionChange?: (userId: string, selection: any) => void;
}

export function useCollaboration({
  documentId,
  onContentChange,
  onCursorChange,
  onSelectionChange
}: UseCollaborationProps) {
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 2; // REDUCED: Max 2 attempts for stability
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastConnectTime = useRef<number | null>(null);
  const isDestroyedRef = useRef(false); // Track if hook is being destroyed

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  const connect = useCallback(async () => {
    if (!currentUser || !documentId || wsRef.current?.readyState === WebSocket.CONNECTING || wsRef.current?.readyState === WebSocket.OPEN || isDestroyedRef.current) return;

    console.log('🔄 Starting connection process...');
    
    // Cleanup existing connection
    disconnect();
    
    try {
      setConnectionState('connecting');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('No access token available');
        setConnectionState('disconnected');
        return;
      }

      const wsUrl = `wss://wawofclbehbkebjivdte.functions.supabase.co/knowledge-collaboration?documentId=${documentId}&userId=${currentUser.id}&token=${session.access_token}`;
      
      console.log('🔗 Connecting to collaboration WebSocket...');
      
      wsRef.current = new WebSocket(wsUrl);

      // Connection timeout - longer for stability
      connectionTimeoutRef.current = setTimeout(() => {
        if (connectionState === 'connecting' && !isDestroyedRef.current) {
          console.log('⏰ Connection timeout after 15 seconds');
          wsRef.current?.close();
          setConnectionState('disconnected');
        }
      }, 15000); // Reduced to 15 seconds

      wsRef.current.onopen = () => {
        console.log('🔗 Collaboration WebSocket opened');
        console.log(`📄 Document ID: ${documentId}, 👤 User ID: ${currentUser?.id}`);
        
        lastConnectTime.current = Date.now();
        
        // Clear connection timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        
        // Don't set connected state yet - wait for server confirmation
        console.log('⏳ WebSocket opened, waiting for server confirmation...');
        reconnectAttempts.current = 0;
        
        // NO HEARTBEAT - Phase 1 stability
        console.log('❌ Heartbeat disabled for Phase 1 stability testing');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: CollaborationMessage = JSON.parse(event.data);
          console.log('Received collaboration message:', message.type, message);
          
          switch (message.type) {
            case 'connected':
              console.log('✅ WebSocket connection confirmed by server!');
              console.log('📊 Server data:', message.data);
              
              // NOW set connected state
              setConnectionState('connected');
              
              // Test basic ping after longer delay for extra stability
              setTimeout(() => {
                if (wsRef.current?.readyState === WebSocket.OPEN && !isDestroyedRef.current) {
                  console.log('🏓 Sending test ping to verify connection...');
                  wsRef.current.send(JSON.stringify({
                    type: 'ping',
                    data: { clientTime: new Date().toISOString() },
                    timestamp: Date.now()
                  }));
                }
              }, 5000); // Increased to 5 seconds for extra stability
              break;
              
            case 'pong':
              console.log('✅ Received pong response - connection is stable and working!');
              console.log('📊 Pong data:', message.data);
              break;
              
            case 'error':
              console.error('❌ Server error:', message.data?.message);
              break;
              
            case 'join':
              console.log('User joined:', message.userId);
              // Refresh collaborators list
              break;
              
            case 'leave':
              console.log('User left:', message.userId);
              setCollaborators(prev => prev.filter(c => c.user_id !== message.userId));
              break;
              
            case 'collaborators':
              console.log('Received collaborators:', message.data);
              setCollaborators(message.data || []);
              break;
              
            case 'cursor':
              if (message.userId && onCursorChange) {
                onCursorChange(message.userId, message.data?.cursor);
              }
              break;
              
            case 'selection':
              if (message.userId && onSelectionChange) {
                onSelectionChange(message.userId, message.data?.selection);
              }
              break;
              
            case 'content':
              if (message.data?.content && onContentChange) {
                onContentChange(message.data.content);
              }
              break;
              
            case 'heartbeat':
              console.log('Received heartbeat response');
              break;
          }
        } catch (error) {
          console.error('Error parsing collaboration message:', error, event.data);
        }
      };

      wsRef.current.onclose = (event) => {
        if (isDestroyedRef.current) return; // Don't handle close if component is destroyed
        
        console.log('Collaboration WebSocket closed:', event.code, event.reason);
        
        // Clear all timeouts and intervals
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
        
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        
        setConnectionState('disconnected');
        setCollaborators([]);
        
        const reason = getCloseReason(event.code);
        console.log('WebSocket close reason:', reason);
        
        // Much more conservative reconnection logic
        const connectionDuration = Date.now() - (lastConnectTime.current || 0);
        const wasShortLived = connectionDuration < 10000; // Less than 10 seconds
        
        if (wasShortLived) {
          console.log(`Connection was short-lived (${connectionDuration}ms), increasing backoff dramatically`);
          reconnectAttempts.current = Math.min(reconnectAttempts.current + 1, maxReconnectAttempts);
        }
        
        // Only attempt reconnection for recoverable errors and if not too many failures
        if (shouldAttemptReconnect(event.code) && reconnectAttempts.current < maxReconnectAttempts) {
          const baseDelay = 10000; // 10 seconds minimum
          const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts.current), 60000); // Max 60 seconds
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectAttempts.current++;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isDestroyedRef.current) {
              connect();
            }
          }, delay);
        } else {
          console.log('Max reconnection attempts reached or non-recoverable error');
          reconnectAttempts.current = 0;
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('Collaboration WebSocket error:', error);
        console.error('Connection URL:', wsUrl);
        console.error('Document ID:', documentId);
        console.error('User ID:', currentUser?.id);
      };

    } catch (error) {
      console.error('Error connecting to collaboration WebSocket:', error);
      setConnectionState('disconnected');
    }
  }, [currentUser, documentId, onContentChange, onCursorChange, onSelectionChange]);

  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting collaboration...');
    isDestroyedRef.current = true;
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    
    // Clear all timeouts and intervals
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    
    setConnectionState('disconnected');
    setCollaborators([]);
    reconnectAttempts.current = 0;
    
    console.log('✅ Collaboration disconnected and cleaned up');
  }, []);

  const sendMessage = useCallback((message: Omit<CollaborationMessage, 'timestamp'>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        ...message,
        timestamp: Date.now()
      }));
    }
  }, []);

  const sendCursorUpdate = useCallback((cursor: any) => {
    sendMessage({
      type: 'cursor',
      documentId,
      userId: currentUser?.id,
      data: { cursor }
    });
  }, [sendMessage, documentId, currentUser]);

  const sendSelectionUpdate = useCallback((selection: any) => {
    sendMessage({
      type: 'selection',
      documentId,
      userId: currentUser?.id,
      data: { selection }
    });
  }, [sendMessage, documentId, currentUser]);

  const sendContentUpdate = useCallback((content: string) => {
    sendMessage({
      type: 'content',
      documentId,
      userId: currentUser?.id,
      data: { content }
    });
  }, [sendMessage, documentId, currentUser]);

  // Connect only when explicitly enabled and user is available
  useEffect(() => {
    if (currentUser && documentId) {
      console.log('🚀 Collaboration hook: Starting connection...');
      isDestroyedRef.current = false; // Reset destroyed flag
      connect();
    }
    
    return () => {
      console.log('🔄 Collaboration hook: Cleanup on unmount/deps change');
      disconnect();
    };
  }, [currentUser, documentId, connect, disconnect]);

  // Helper functions for better error handling
  const getCloseReason = (code: number) => {
    const reasons: { [key: number]: string } = {
      1000: 'Normal closure',
      1001: 'Going away',
      1002: 'Protocol error',
      1003: 'Unsupported data',
      1006: 'Abnormal closure (connection failed)',
      1007: 'Invalid frame payload data',
      1008: 'Policy violation',
      1009: 'Message too big',
      1010: 'Mandatory extension',
      1011: 'Internal server error',
      1015: 'TLS handshake error'
    };
    return reasons[code] || `Unknown close code: ${code}`;
  };

  const shouldAttemptReconnect = (code: number) => {
    // Don't reconnect for these codes:
    // 1000 - Normal closure (user initiated)
    // 1001 - Going away (page unload)
    // 1002 - Protocol error (client issue)
    // 1003 - Unsupported data (client issue)
    // 1007 - Invalid data (client issue)
    // 1008 - Policy violation (auth/permission issue)
    // 1011 - Internal server error (but might be temporary)
    const noReconnectCodes = [1000, 1001, 1002, 1003, 1007, 1008];
    
    // For 1006 (abnormal closure), only retry with very strict limits
    if (code === 1006) {
      return reconnectAttempts.current < 1; // Only 1 retry for abnormal closure
    }
    
    return !noReconnectCodes.includes(code) && reconnectAttempts.current < maxReconnectAttempts;
  };

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
    collaborators,
    currentUser,
    sendCursorUpdate,
    sendSelectionUpdate,
    sendContentUpdate,
    connect,
    disconnect,
    // Expose helper for debugging
    getLastCloseReason: () => getCloseReason
  };
}