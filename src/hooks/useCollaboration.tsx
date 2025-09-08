import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CollaborationMessage {
  type: 'join' | 'leave' | 'cursor' | 'selection' | 'content' | 'heartbeat' | 'collaborators' | 'connected';
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
  const maxReconnectAttempts = 5;
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  const connect = useCallback(async () => {
    if (!currentUser || !documentId || wsRef.current?.readyState === WebSocket.CONNECTING || wsRef.current?.readyState === WebSocket.OPEN) return;

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
      
      console.log('Connecting to collaboration WebSocket...');
      
      wsRef.current = new WebSocket(wsUrl);

      // Set connection timeout
      connectionTimeoutRef.current = setTimeout(() => {
        if (connectionState === 'connecting') {
          console.log('Connection timeout');
          wsRef.current?.close();
          setConnectionState('disconnected');
        }
      }, 10000); // 10 second timeout

      wsRef.current.onopen = () => {
        console.log('Collaboration WebSocket connected');
        
        // Clear connection timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        
        setConnectionState('connected');
        reconnectAttempts.current = 0;
        
        // Start heartbeat (less frequent)
        heartbeatRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'heartbeat',
              timestamp: Date.now()
            }));
          }
        }, 60000); // Every 60 seconds (reduced frequency)
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: CollaborationMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'connected':
              console.log('WebSocket connection confirmed by server');
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
              // Heartbeat response - connection is alive
              break;
          }
        } catch (error) {
          console.error('Error parsing collaboration message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        const closeReason = getCloseReason(event.code);
        console.log(`Collaboration WebSocket disconnected: ${event.code} - ${closeReason}`);
        
        setConnectionState('disconnected');
        setCollaborators([]);
        
        // Clear heartbeat
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }

        // Clear connection timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        
        // Handle different close codes appropriately
        const shouldReconnect = shouldAttemptReconnect(event.code);
        
        if (shouldReconnect && reconnectAttempts.current < maxReconnectAttempts) {
          const baseDelay = 2000;
          const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts}) - Reason: ${closeReason}`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else if (!shouldReconnect) {
          console.log(`Not attempting to reconnect: ${closeReason}`);
        } else {
          console.log('Max reconnection attempts reached');
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
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    
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

  // Connect when component mounts and user is available
  useEffect(() => {
    if (currentUser && documentId) {
      connect();
    }
    
    return () => {
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
    const noReconnectCodes = [1000, 1001, 1002, 1003, 1007, 1008];
    return !noReconnectCodes.includes(code);
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