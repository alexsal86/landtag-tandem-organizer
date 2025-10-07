import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect, useRef } from "react";
import { useYjsProvider } from "./YjsProvider";
import { createBinding, type Binding } from "@lexical/yjs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";

interface OfficialLexicalYjsPluginProps {
  id: string;
  doc?: any;
  sharedType?: any;
  shouldBootstrap?: boolean;
}

/**
 * Official Lexical Yjs Integration using @lexical/yjs
 * Uses createBinding for direct, robust synchronization with Supabase Realtime
 */
export function OfficialLexicalYjsPlugin({
  id,
  doc,
  sharedType,
  shouldBootstrap = true,
}: OfficialLexicalYjsPluginProps) {
  const [editor] = useLexicalComposerContext();
  const yjsContext = useYjsProvider();
  const bindingRef = useRef<Binding | null>(null);

  // Use provided props or fallback to context
  const finalDoc = doc || yjsContext?.doc;
  const finalSharedType = sharedType || yjsContext?.sharedType;

  useEffect(() => {
    if (!yjsContext?.isConnected || !finalSharedType || !finalDoc) {
      return;
    }

    if (bindingRef.current) {
      return;
    }

    console.log("[OfficialLexicalYjsPlugin] Creating manual Yjs binding...", {
      id,
      docId: finalDoc?.guid,
    });

    // Manual synchronization between Lexical and Yjs (without WebsocketProvider)
    // This replaces createBinding since we don't have a provider anymore
    const binding = createBinding(
      editor,
      null as any, // No provider needed for basic sync
      id,
      finalDoc,
      new Map([[id, finalDoc]])
    );

    bindingRef.current = binding;

    console.log("[OfficialLexicalYjsPlugin] Binding created successfully");

    return () => {
      console.log("[OfficialLexicalYjsPlugin] Cleaning up binding");
      if (bindingRef.current) {
        bindingRef.current = null;
      }
    };
  }, [editor, yjsContext?.isConnected, id, finalDoc, finalSharedType]);

  // Show loading state while connecting
  if (!yjsContext?.isConnected) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Verbinde mit Collaboration-Server...
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
