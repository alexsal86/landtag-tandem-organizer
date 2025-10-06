import React, { useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin';
import { Provider } from '@lexical/yjs';
import { useYjsProvider } from './YjsProvider';
import * as Y from 'yjs';

interface OfficialLexicalYjsPluginProps {
  id: string;
  providerFactory?: (id: string, yjsDocMap: Map<string, Y.Doc>) => Provider;
  shouldBootstrap?: boolean;
  username?: string;
  cursorColor?: string;
}

/**
 * Official Lexical Yjs Collaboration Plugin
 * Uses @lexical/yjs CollaborationPlugin for reliable sync
 */
export function OfficialLexicalYjsPlugin({
  id,
  providerFactory,
  shouldBootstrap = true,
  username,
  cursorColor,
}: OfficialLexicalYjsPluginProps) {
  const [editor] = useLexicalComposerContext();
  const yjsContext = useYjsProvider();
  const [isReady, setIsReady] = useState(false);

  // Wait for provider to be ready
  useEffect(() => {
    if (yjsContext.doc && yjsContext.provider && yjsContext.isConnected) {
      setIsReady(true);
      console.log('[OfficialLexicalYjs] Provider ready, enabling collaboration');
    } else {
      setIsReady(false);
    }
  }, [yjsContext.doc, yjsContext.provider, yjsContext.isConnected]);

  if (!isReady || !yjsContext.doc || !yjsContext.provider) {
    return (
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Connecting to collaboration...
        </div>
      </div>
    );
  }

  // Use custom provider factory or create default one
  const createProvider = providerFactory || ((id: string, yjsDocMap: Map<string, Y.Doc>) => {
    // Return our custom Supabase-backed provider
    return yjsContext.provider as unknown as Provider;
  });

  return (
    <CollaborationPlugin
      id={id}
      providerFactory={createProvider}
      shouldBootstrap={shouldBootstrap}
      username={username || yjsContext.currentUser?.user_metadata?.display_name || 'Anonymous'}
      cursorColor={cursorColor}
      initialEditorState={null}
    />
  );
}

/**
 * Collaborator UI Component
 * Displays online collaborators from Yjs awareness
 */
export function YjsCollaboratorsList() {
  const yjsContext = useYjsProvider();

  if (!yjsContext.collaborators || yjsContext.collaborators.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border">
      <span className="text-xs font-medium text-muted-foreground">
        {yjsContext.collaborators.length} other{yjsContext.collaborators.length !== 1 ? 's' : ''} online:
      </span>
      <div className="flex items-center gap-1">
        {yjsContext.collaborators.map((collaborator: any) => (
          <div
            key={collaborator.user_id}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
            style={{ 
              backgroundColor: collaborator.user_color ? `${collaborator.user_color}20` : undefined,
              borderLeft: `3px solid ${collaborator.user_color || '#888'}` 
            }}
          >
            {collaborator.profiles?.avatar_url && (
              <img 
                src={collaborator.profiles.avatar_url} 
                alt={collaborator.profiles?.display_name || 'User'}
                className="w-4 h-4 rounded-full"
              />
            )}
            <span className="font-medium">
              {collaborator.profiles?.display_name || 'User'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
