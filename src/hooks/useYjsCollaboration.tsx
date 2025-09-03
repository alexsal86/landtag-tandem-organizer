import { useCallback, useEffect, useRef, useState } from 'react';
import { Doc, encodeStateAsUpdate, applyUpdate, UndoManager } from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { useAuth } from './useAuth';

interface UseYjsCollaborationProps {
  documentId: string;
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

export function useYjsCollaboration({ documentId }: UseYjsCollaborationProps) {
  const { user } = useAuth();
  const yjsDocRef = useRef<Doc | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const undoManagerRef = useRef<UndoManager | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize Yjs document and awareness
  useEffect(() => {
    console.log('useYjsCollaboration: Initializing for:', documentId);
    
    setIsInitialized(false);
    
    // Cleanup existing instances
    if (undoManagerRef.current) {
      undoManagerRef.current.destroy();
    }
    if (awarenessRef.current) {
      awarenessRef.current.destroy();
    }
    if (yjsDocRef.current) {
      yjsDocRef.current.destroy();
    }
    
    if (documentId) {
      // Create new Yjs document
      const doc = new Doc({ guid: documentId });
      yjsDocRef.current = doc;
      
      // Initialize awareness for real-time collaboration
      const awareness = new Awareness(doc);
      awarenessRef.current = awareness;
      
      // Create undo manager for the editor text
      const yText = doc.getText('editor');
      const undoManager = new UndoManager(yText);
      undoManagerRef.current = undoManager;
      
      // Set user information in awareness
      if (user) {
        awareness.setLocalStateField('user', {
          name: user.email || 'Anonymous User',
          color: generateUserColor(),
          clientId: doc.clientID
        });
      }
      
      // Load from localStorage
      loadFromLocalStorage();
      
      // Auto-save to localStorage on changes
      const saveInterval = setInterval(() => {
        saveToLocalStorage();
      }, 2000); // Save every 2 seconds
      
      setIsInitialized(true);
      console.log('useYjsCollaboration: Initialized successfully');
      
      return () => {
        clearInterval(saveInterval);
      };
    }
  }, [documentId, user]);

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