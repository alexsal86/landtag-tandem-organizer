import React, { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical';
import { useYjsProvider } from './YjsProvider';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface LexicalYjsCollaborationPluginProps {
  id: string;
  shouldBootstrap?: boolean;
}

export function LexicalYjsCollaborationPlugin({ 
  id, 
  shouldBootstrap = true 
}: LexicalYjsCollaborationPluginProps) {
  const [editor] = useLexicalComposerContext();
  const { doc, isSynced, provider, collaborators, currentUser } = useYjsProvider();
  const { user } = useAuth();
  const lastContentRef = useRef<string>('');
  const isApplyingYjsUpdateRef = useRef<boolean>(false);
  const isApplyingLexicalUpdateRef = useRef<boolean>(false);
  const hasBootstrapped = useRef<boolean>(false);
  
  // Use stable clientId from localStorage (initialized once per document+id)
  const clientId = useRef<string>('');
  
  // Initialize stable clientId once
  React.useEffect(() => {
    if (!clientId.current) {
      const storageKey = `yjs-lexical-client-${id}`;
      let storedClientId = localStorage.getItem(storageKey);
      if (!storedClientId) {
        storedClientId = `lexical-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem(storageKey, storedClientId);
      }
      clientId.current = storedClientId;
      console.log('[LexicalYjsCollaboration] Using stable clientId:', clientId.current);
    }
  }, [id]);

  useEffect(() => {
    if (!doc || !editor || !isSynced) return;

    console.log('[LexicalYjsCollaboration] Setting up improved plaintext Yjs binding for:', id);

    // Use a consistent Yjs key name
    const sharedText = doc.getText('content');

    const applyYjsToLexical = (origin?: any, transactionOrigin?: string) => {
      // Prevent echo: skip if this update originated from our own Lexical editor or from network with our clientId
      const isOwnUpdate = origin === clientId.current || transactionOrigin === clientId.current;
      
      if (isOwnUpdate) {
        console.log(`[LexicalYjsCollaboration:${clientId.current}] Skipping echo - origin:`, origin, 'transaction:', transactionOrigin);
        return;
      }
      
      const content = sharedText.toString();
      
      // Skip if we're already applying a Yjs update or content hasn't changed
      if (isApplyingYjsUpdateRef.current || content === lastContentRef.current) {
        console.log(`[LexicalYjsCollaboration:${clientId.current}] Skipping - applying:${isApplyingYjsUpdateRef.current}, unchanged:${content === lastContentRef.current}`);
        return;
      }

      console.log(`[LexicalYjsCollaboration:${clientId.current}] Applying Yjs content to Lexical:`, {
        origin,
        transactionOrigin,
        contentLength: content.length,
        preview: content.slice(0, 50)
      });
      
      isApplyingYjsUpdateRef.current = true;
      
      try {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          
          if (content.trim()) {
            // Split content by newlines and create paragraphs
            const lines = content.split('\n');
            lines.forEach((line, index) => {
              const p = $createParagraphNode();
              if (line.trim()) {
                p.append($createTextNode(line));
              }
              root.append(p);
            });
          } else {
            // Empty content - add single empty paragraph
            const p = $createParagraphNode();
            root.append(p);
          }
          
          // Update ref synchronously within the update
          lastContentRef.current = content;
        });
      } catch (error) {
        console.error(`[LexicalYjsCollaboration:${clientId.current}] Error applying Yjs content:`, error);
      } finally {
        // Reset flag immediately after update completes
        isApplyingYjsUpdateRef.current = false;
      }
    };

    // Observe remote Yjs changes with improved error handling
    const yObserver = (event: any, transaction: any) => {
      try {
        console.log(`[LexicalYjsCollaboration:${clientId.current}] Yjs change detected:`, {
          origin: transaction?.origin,
          clientId: clientId.current,
          isLocal: transaction?.local
        });
        applyYjsToLexical(transaction?.origin, transaction?.origin);
      } catch (error) {
        console.error(`[LexicalYjsCollaboration:${clientId.current}] Error in Yjs observer:`, error);
      }
    };
    
    sharedText.observeDeep(yObserver);

    // Initial bootstrap from Yjs (only once after sync)
    if (shouldBootstrap && !hasBootstrapped.current) {
      console.log(`[LexicalYjsCollaboration:${clientId.current}] Bootstrapping from existing Yjs content`);
      applyYjsToLexical('bootstrap', 'bootstrap');
      hasBootstrapped.current = true;
    }

    // Push local Lexical changes to Yjs with improved handling
    const unregister = editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      // Skip if we're currently applying Yjs or Lexical updates
      if (isApplyingYjsUpdateRef.current || isApplyingLexicalUpdateRef.current) {
        console.log(`[LexicalYjsCollaboration:${clientId.current}] Skipping update - applying updates (Yjs:${isApplyingYjsUpdateRef.current}, Lexical:${isApplyingLexicalUpdateRef.current})`);
        return;
      }
      
      try {
        editorState.read(() => {
          const text = $getRoot().getTextContent();
          
          // Only update if text actually changed from what we last saw
          if (text !== lastContentRef.current) {
            console.log(`[LexicalYjsCollaboration:${clientId.current}] Pushing Lexical content to Yjs:`, {
              textLength: text.length,
              preview: text.slice(0, 50),
              clientId: clientId.current
            });
            
            isApplyingLexicalUpdateRef.current = true;
            
            // Update reference BEFORE sending to Yjs to prevent race conditions
            lastContentRef.current = text;
            
            // Use granular diff-based updates instead of delete-all-then-insert
            doc.transact(() => {
              const currentText = sharedText.toString();
              
              // Calculate common prefix
              const minLength = Math.min(currentText.length, text.length);
              let commonPrefixEnd = 0;
              while (commonPrefixEnd < minLength && 
                     currentText[commonPrefixEnd] === text[commonPrefixEnd]) {
                commonPrefixEnd++;
              }
              
              // Calculate common suffix
              let commonSuffixStart = 0;
              while (commonSuffixStart < minLength - commonPrefixEnd &&
                     currentText[currentText.length - 1 - commonSuffixStart] === 
                     text[text.length - 1 - commonSuffixStart]) {
                commonSuffixStart++;
              }
              
              // Calculate what needs to be deleted and inserted
              const deleteStart = commonPrefixEnd;
              const deleteLength = currentText.length - commonPrefixEnd - commonSuffixStart;
              const insertText = text.substring(commonPrefixEnd, text.length - commonSuffixStart);
              
              // Apply only minimal changes
              if (deleteLength > 0) {
                sharedText.delete(deleteStart, deleteLength);
              }
              if (insertText.length > 0) {
                sharedText.insert(deleteStart, insertText);
              }
              
              console.log(`[LexicalYjsCollaboration:${clientId.current}] Granular update applied:`, {
                deleteStart,
                deleteLength,
                insertLength: insertText.length
              });
            }, clientId.current); // Pass clientId as transaction origin
            
            isApplyingLexicalUpdateRef.current = false;
          }
        });
      } catch (error) {
        console.error(`[LexicalYjsCollaboration:${clientId.current}] Error pushing to Yjs:`, error);
        isApplyingLexicalUpdateRef.current = false;
      }
    });

    return () => {
      console.log(`[LexicalYjsCollaboration:${clientId.current}] Cleaning up Yjs text binding`);
      try {
        sharedText.unobserveDeep(yObserver);
        unregister();
      } catch (error) {
        console.error(`[LexicalYjsCollaboration:${clientId.current}] Error during cleanup:`, error);
      }
    };
  }, [doc, editor, id, isSynced, shouldBootstrap]);

  // Render collaboration UI with cursor information
  if (!collaborators || collaborators.length === 0) {
    return null;
  }

  const otherCollaborators = collaborators.filter(c => c.userId !== user?.id);

  if (otherCollaborators.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-background/95 backdrop-blur border rounded-lg shadow-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-xs">
            {otherCollaborators.length} {otherCollaborators.length === 1 ? 'Nutzer' : 'Nutzer'} online
          </Badge>
        </div>
        <div className="flex flex-col gap-2">
          {otherCollaborators.map((collab) => (
            <div key={collab.userId} className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full animate-pulse" 
                style={{ backgroundColor: collab.color }}
              />
              <Avatar className="h-6 w-6">
                <AvatarFallback 
                  className="text-xs"
                  style={{ backgroundColor: `${collab.color}20`, color: collab.color }}
                >
                  {collab.name?.substring(0, 2).toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">
                {collab.name || 'Unbekannt'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}