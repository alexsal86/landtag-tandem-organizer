import { useCallback, useEffect, useRef, useState } from 'react';
import { Doc, encodeStateAsUpdate, applyUpdate, UndoManager } from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { WebsocketProvider } from 'y-websocket';
import { useAuth } from './useAuth';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface UseYjsCollaborationProps {
  documentId?: string;
}

// Helper function to generate random user colors
function generateUserColor(): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function useYjsCollaboration({ documentId: propDocumentId }: UseYjsCollaborationProps) {
  const { documentId: urlDocumentId } = useParams<{ documentId: string }>();
  const documentId = propDocumentId || urlDocumentId;
  
  console.log('useYjsCollaboration: Hook called with documentId:', documentId);
  const { user, session } = useAuth();
  const yjsDocRef = useRef<Doc | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const undoManagerRef = useRef<UndoManager | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize Yjs document and awareness
  useEffect(() => {
    console.log('🔄 useYjsCollaboration: useEffect triggered for documentId:', documentId, 'isInitialized:', isInitialized);
    
    if (!documentId || !session?.access_token) {
      console.log('⚠️ useYjsCollaboration: Missing documentId or session, skipping initialization');
      setIsInitialized(false);
      return;
    }
    
    // Prevent re-initialization if already initialized for same document
    if (isInitialized && yjsDocRef.current && awarenessRef.current && providerRef.current) {
      console.log('✅ useYjsCollaboration: Already initialized for this document, skipping re-initialization');
      return;
    }
    
    console.log('🚀 useYjsCollaboration: Starting initialization for document:', documentId);
    
    setIsInitialized(false);
    
    // Cleanup existing instances
    if (providerRef.current) {
      providerRef.current.destroy();
    }
    if (undoManagerRef.current) {
      undoManagerRef.current.destroy();
    }
    if (awarenessRef.current) {
      awarenessRef.current.destroy();
    }
    if (yjsDocRef.current) {
      yjsDocRef.current.destroy();
    }
    
    if (documentId && session?.access_token && user) {
      // Create new Yjs document
      const doc = new Doc({ guid: documentId });
      yjsDocRef.current = doc;
      
      // Get WebSocket URL for the edge function
      const wsUrl = 'wss://wawofclbehbkebjivdte.supabase.co/functions/v1/yjs-collaboration';
      
      // Create WebSocket provider with authentication
      const wsUrlWithParams = `${wsUrl}?room=${encodeURIComponent(documentId)}&token=${encodeURIComponent(session.access_token)}`;
      console.log('useYjsCollaboration: Connecting to WebSocket URL:', wsUrlWithParams.replace(session.access_token, '[TOKEN]'));
      
      const provider = new WebsocketProvider(
        wsUrlWithParams,
        documentId,
        doc
      );
      
      providerRef.current = provider;
      
      // Get awareness from provider
      const awareness = provider.awareness;
      awarenessRef.current = awareness;
      
      // Create undo manager for the editor text
      const yText = doc.getText('editor');
      const undoManager = new UndoManager(yText);
      undoManagerRef.current = undoManager;
      
      // Set user information in awareness
      if (user) {
        const userInfo = {
          name: user.email || 'Anonymous User',
          color: generateUserColor(),
          clientId: doc.clientID
        };
        console.log('useYjsCollaboration: Setting user info in awareness:', userInfo);
        awareness.setLocalStateField('user', userInfo);
        
        // Also set the user state immediately to trigger awareness
        awareness.setLocalState({
          user: userInfo,
          cursor: null,
          selection: null
        });
      }
      
      // Wait for provider to connect with better error handling
      provider.on('status', (event: any) => {
        console.log('WebSocket provider status:', event.status);
        if (event.status === 'connected') {
          setIsInitialized(true);
          console.log('useYjsCollaboration: Connected and initialized successfully');
        } else if (event.status === 'disconnected') {
          setIsInitialized(false);
          console.log('useYjsCollaboration: Disconnected');
        }
      });

      provider.on('connection-error', (error: any) => {
        console.error('WebSocket connection error:', error);
        setIsInitialized(false);
      });

      // Set connected status initially to prevent indefinite loading
      setTimeout(() => {
        if (provider.wsconnected) {
          setIsInitialized(true);
        }
      }, 1000);
      
      // Load from localStorage as fallback
      loadFromLocalStorage();
      
      // Auto-save to localStorage on changes
      const saveInterval = setInterval(() => {
        saveToLocalStorage();
      }, 2000); // Save every 2 seconds
      
      return () => {
        clearInterval(saveInterval);
      };
    }
  }, [documentId, session?.access_token]); // Removed user dependency to prevent loop

  // Save document state to localStorage
  const saveToLocalStorage = useCallback(() => {
    if (!yjsDocRef.current || !documentId) return;
    
    try {
      const state = encodeStateAsUpdate(yjsDocRef.current);
      const stateArray = Array.from(state);
      localStorage.setItem(`yjs-doc-${documentId}`, JSON.stringify(stateArray));
      console.log('Document saved to localStorage');
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [documentId]);

  // Load document state from localStorage
  const loadFromLocalStorage = useCallback(() => {
    if (!yjsDocRef.current || !documentId) return;
    
    try {
      const savedState = localStorage.getItem(`yjs-doc-${documentId}`);
      if (savedState) {
        const stateArray = JSON.parse(savedState);
        const state = new Uint8Array(stateArray);
        applyUpdate(yjsDocRef.current, state);
        console.log('Document loaded from localStorage');
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
  }, [documentId]);

  // Manual save function
  const manualSave = useCallback(() => {
    saveToLocalStorage();
  }, [saveToLocalStorage]);

  // Export document as JSON
  const exportDocument = useCallback(() => {
    if (!yjsDocRef.current) return null;
    
    try {
      const yText = yjsDocRef.current.getText('editor');
      return {
        content: yText.toString(),
        timestamp: new Date().toISOString(),
        documentId
      };
    } catch (error) {
      console.error('Error exporting document:', error);
      return null;
    }
  }, [documentId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (providerRef.current) {
        providerRef.current.destroy();
      }
      if (undoManagerRef.current) {
        undoManagerRef.current.destroy();
      }
      if (awarenessRef.current) {
        awarenessRef.current.destroy();
      }
      if (yjsDocRef.current) {
        yjsDocRef.current.destroy();
      }
    };
  }, []);

  return {
    yjsDoc: yjsDocRef.current,
    awareness: awarenessRef.current,
    undoManager: undoManagerRef.current,
    isInitialized,
    manualSave,
    exportDocument
  };
}