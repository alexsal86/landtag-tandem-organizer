import React, { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface YjsLexicalPluginProps {
  documentId: string;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onCollaboratorsChange?: (collaborators: any[]) => void;
}

export function YjsLexicalPlugin({ 
  documentId, 
  onConnected,
  onDisconnected,
  onCollaboratorsChange 
}: YjsLexicalPluginProps) {
  const [editor] = useLexicalComposerContext();
  const { user } = useAuth();
  const ydocRef = useRef<Y.Doc>();
  const ytextRef = useRef<Y.Text>();
  const channelRef = useRef<any>();
  const lastContentRef = useRef<string>('');
  const isRemoteUpdateRef = useRef<boolean>(false);
  
  useEffect(() => {
    if (!documentId || !editor) return;

    console.log('[Yjs] Initializing Yjs collaboration for document:', documentId);

    // Create Yjs document and text
    ydocRef.current = new Y.Doc();
    ytextRef.current = ydocRef.current.getText('content');
    
    // Listen to Yjs text changes and sync to Lexical
    ytextRef.current.observe(() => {
      const content = ytextRef.current?.toString() || '';
      
      if (content !== lastContentRef.current && !isRemoteUpdateRef.current) {
        console.log('[Yjs] Applying remote Yjs content to Lexical:', content);
        isRemoteUpdateRef.current = true;
        
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          
          if (content.trim()) {
            const paragraph = $createParagraphNode();
            paragraph.append($createTextNode(content));
            root.append(paragraph);
          }
          
          lastContentRef.current = content;
        }, {
          onUpdate: () => {
            setTimeout(() => {
              isRemoteUpdateRef.current = false;
            }, 0);
          }
        });
      }
    });

    // Set up Supabase Realtime as Yjs transport layer
    const channelName = `yjs_document_${documentId}`;
    channelRef.current = supabase.channel(channelName);

    // Listen for Yjs updates via Supabase
    channelRef.current
      .on('broadcast', { event: 'yjs-update' }, (payload: any) => {
        if (payload.userId !== (user?.id || 'anonymous') && ydocRef.current) {
          console.log('[Yjs] Received remote Yjs update');
          const update = new Uint8Array(payload.update);
          Y.applyUpdate(ydocRef.current, update);
        }
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Yjs] Connected to Supabase Realtime transport');
          onConnected?.();
        } else {
          console.log('[Yjs] Disconnected from Supabase Realtime transport');
          onDisconnected?.();
        }
      });

    // Listen to local Yjs updates to broadcast via Supabase
    ydocRef.current.on('update', (update: Uint8Array) => {
      console.log('[Yjs] Broadcasting Yjs update via Supabase');
      channelRef.current?.send({
        type: 'broadcast',
        event: 'yjs-update',
        payload: {
          userId: user?.id || 'anonymous',
          update: Array.from(update) // Convert to array for JSON serialization
        }
      });
    });

    // Listen to Lexical changes and sync to Yjs
    const removeListener = editor.registerUpdateListener(({ editorState }) => {
      if (isRemoteUpdateRef.current) return;
      
      editorState.read(() => {
        const root = $getRoot();
        const textContent = root.getTextContent();
        
        if (textContent !== lastContentRef.current) {
          console.log('[Yjs] Syncing Lexical content to Yjs:', textContent);
          lastContentRef.current = textContent;
          
          // Update Yjs text - this will trigger the update event above
          if (ytextRef.current) {
            ytextRef.current.delete(0, ytextRef.current.length);
            ytextRef.current.insert(0, textContent);
          }
        }
      });
    });

    // Cleanup
    return () => {
      removeListener();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      ydocRef.current?.destroy();
    };
  }, [documentId, editor, user, onConnected, onDisconnected, onCollaboratorsChange]);

  return null;
}

// Generate consistent color for user based on their ID
function getUserColor(userId: string): string {
  const colors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', 
    '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#84cc16'
  ];
  
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff;
  }
  return colors[Math.abs(hash) % colors.length];
}