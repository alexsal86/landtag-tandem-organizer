import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect, useRef } from "react";
import { useYjsProvider } from "./YjsProvider";
import { createBinding, type Binding } from "@lexical/yjs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";

interface OfficialLexicalYjsPluginProps {
  id: string;
  shouldBootstrap?: boolean;
}

/**
 * Official Lexical Yjs Integration using @lexical/yjs
 * Uses createBinding for direct, robust synchronization
 */
export function OfficialLexicalYjsPlugin({
  id,
  shouldBootstrap = true,
}: OfficialLexicalYjsPluginProps) {
  const [editor] = useLexicalComposerContext();
  const yjsContext = useYjsProvider();
  const bindingRef = useRef<Binding | null>(null);

  useEffect(() => {
    if (!yjsContext?.isConnected || !yjsContext?.isSynced || !yjsContext?.sharedType) {
      return;
    }

    if (bindingRef.current) {
      return;
    }

    console.log("[OfficialLexicalYjsPlugin] Creating binding...", {
      id,
      docId: yjsContext.doc.guid,
    });

    // Create the binding between Lexical editor and Yjs
    // WebsocketProvider needs type assertion as it implements Provider-like interface
    const binding = createBinding(
      editor,
      yjsContext.provider as any,
      id,
      yjsContext.doc,
      new Map([[id, yjsContext.doc]]) // Map of document ID to Y.Doc
    );

    bindingRef.current = binding;

    console.log("[OfficialLexicalYjsPlugin] Binding created successfully");

    return () => {
      console.log("[OfficialLexicalYjsPlugin] Cleaning up binding");
      if (bindingRef.current) {
        // The binding object doesn't have a destroy method, just clean up reference
        bindingRef.current = null;
      }
    };
  }, [editor, yjsContext, id]);

  // Show loading state while connecting/syncing
  if (!yjsContext?.isConnected || !yjsContext?.isSynced) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {!yjsContext?.isConnected ? "Verbinde..." : "Synchronisiere..."}
          </p>
        </div>
      </div>
    );
  }

  return <YjsCollaboratorsList />;
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
    <div className="absolute top-2 right-2 flex items-center gap-2 bg-background/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border z-10">
      <span className="text-xs text-muted-foreground">Online:</span>
      <div className="flex -space-x-2">
        {yjsContext.collaborators.map((collab) => (
          <Avatar key={collab.user_id} className="h-6 w-6 border-2 border-background">
            <AvatarImage src={collab.profiles?.avatar_url} />
            <AvatarFallback 
              className="text-xs"
              style={{ backgroundColor: collab.user_color }}
            >
              {(collab.profiles?.display_name || 'U').substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
    </div>
  );
}
