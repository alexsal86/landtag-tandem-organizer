import { useState, useEffect, useCallback } from 'react';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';

interface UseNativeYjsCollaborationProps {
  documentId: string;
  enabled: boolean;
}

interface CollaborationUser {
  id: string;
  name: string;
  avatar?: string;
  color: string;
}

export const useNativeYjsCollaboration = ({ documentId, enabled }: UseNativeYjsCollaborationProps) => {
  const [yDoc, setYDoc] = useState<Y.Doc | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState<CollaborationUser[]>([]);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  const getWebSocketUrl = useCallback(() => {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isDev ? 'ws://localhost:54321' : 'wss://wawofclbehbkebjivdte.supabase.co';
    return `${baseUrl}/functions/v1/yjs-collaboration`;
  }, []);

  const initializeCollaboration = useCallback((docId: string) => {
    if (!enabled) return;

    console.log('🚀 Initializing native Yjs collaboration for:', docId);

    // Create new Y.Doc
    const doc = new Y.Doc();
    setYDoc(doc);

    // Create WebSocket connection
    const wsUrl = `${getWebSocketUrl()}?roomId=knowledge-doc-${docId}`;
    console.log('🔗 Connecting to:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
      
      // Send sync step 1 (request document state)
      const syncStep1 = Y.encodeStateAsUpdate(doc);
      ws.send(new Uint8Array([0, ...Array.from(syncStep1)]));
    };

    ws.onmessage = (event) => {
      try {
        const data = new Uint8Array(event.data);
        const messageType = data[0];
        const content = data.slice(1);

        console.log('📥 Received message type:', messageType, 'size:', content.length);

        if (messageType === 0) {
          // Sync message
          Y.applyUpdate(doc, content);
          console.log('🔄 Applied sync update');
        } else if (messageType === 1) {
          // Awareness message
          console.log('👁️ Received awareness update');
          // Handle awareness if needed
        }
      } catch (error) {
        console.error('❌ Error processing message:', error);
      }
    };

    ws.onclose = () => {
      console.log('🚪 WebSocket disconnected');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      setIsConnected(false);
    };

    // Listen for document changes and send to server
    const updateHandler = (update: Uint8Array) => {
      if (ws.readyState === WebSocket.OPEN) {
        // Send as sync message (type 0)
        const message = new Uint8Array([0, ...Array.from(update)]);
        ws.send(message);
        console.log('📤 Sent document update');
      }
    };

    doc.on('update', updateHandler);
    setSocket(ws);

    return () => {
      doc.off('update', updateHandler);
      ws.close();
      doc.destroy();
    };
  }, [enabled, getWebSocketUrl]);

  const destroyCollaboration = useCallback(() => {
    console.log('🧹 Destroying collaboration');
    if (socket) {
      socket.close();
      setSocket(null);
    }
    if (yDoc) {
      yDoc.destroy();
      setYDoc(null);
    }
    setIsConnected(false);
    setUsers([]);
  }, [socket, yDoc]);

  useEffect(() => {
    if (enabled && documentId) {
      const cleanup = initializeCollaboration(documentId);
      return cleanup;
    } else {
      destroyCollaboration();
    }
  }, [enabled, documentId, initializeCollaboration, destroyCollaboration]);

  return {
    yDoc,
    isConnected,
    users,
    initializeCollaboration,
    destroyCollaboration
  };
};