import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CollaborationMessage {
  type: 'join' | 'leave' | 'cursor' | 'selection' | 'content' | 'heartbeat';
  documentId: string;
  userId: string;
  data?: any;
  timestamp: number;
}

interface CollaboratorSession {
  socket: WebSocket;
  documentId: string;
  userId: string;
  userColor: string;
  lastSeen: number;
}

// Store active connections
const activeConnections = new Map<string, CollaboratorSession>();
const documentCollaborators = new Map<string, Set<string>>();

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  // Get query parameters
  const url = new URL(req.url);
  const documentId = url.searchParams.get('documentId');
  const userId = url.searchParams.get('userId');
  const authToken = url.searchParams.get('token');

  if (!documentId || !userId || !authToken) {
    socket.close(1008, 'Missing required parameters');
    return response;
  }

  // Initialize Supabase client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Verify user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser(authToken);
  if (authError || !user || user.id !== userId) {
    socket.close(1008, 'Authentication failed');
    return response;
  }

  // Verify user has access to document
  const { data: document, error: docError } = await supabase
    .from('knowledge_documents')
    .select('id, title')
    .eq('id', documentId)
    .single();

  if (docError || !document) {
    socket.close(1008, 'Document not found or access denied');
    return response;
  }

  const connectionId = `${documentId}_${userId}`;
  const userColor = generateUserColor(userId);

  console.log(`User ${userId} joining collaboration for document ${documentId}`);

  socket.onopen = async () => {
    // Store connection
    activeConnections.set(connectionId, {
      socket,
      documentId,
      userId,
      userColor,
      lastSeen: Date.now()
    });

    // Add to document collaborators
    if (!documentCollaborators.has(documentId)) {
      documentCollaborators.set(documentId, new Set());
    }
    documentCollaborators.get(documentId)!.add(userId);

    // Update database
    await supabase
      .from('knowledge_document_collaborators')
      .upsert({
        document_id: documentId,
        user_id: userId,
        user_color: userColor,
        is_active: true,
        last_seen_at: new Date().toISOString()
      }, { onConflict: 'document_id,user_id' });

    // Notify other collaborators of new join
    broadcastToDocument(documentId, {
      type: 'join',
      documentId,
      userId,
      data: { userColor },
      timestamp: Date.now()
    }, userId);

    // Send current collaborators to new user
    const collaborators = await getCurrentCollaborators(documentId);
    socket.send(JSON.stringify({
      type: 'collaborators',
      data: collaborators,
      timestamp: Date.now()
    }));
  };

  socket.onmessage = async (event) => {
    try {
      const message: CollaborationMessage = JSON.parse(event.data);
      
      // Update last seen
      const connection = activeConnections.get(connectionId);
      if (connection) {
        connection.lastSeen = Date.now();
      }

      switch (message.type) {
        case 'cursor':
        case 'selection':
          // Broadcast cursor/selection changes to other collaborators
          broadcastToDocument(documentId, message, userId);
          
          // Update database with latest cursor position
          await supabase
            .from('knowledge_document_collaborators')
            .update({
              cursor_position: message.data?.cursor,
              selection_state: message.data?.selection,
              last_seen_at: new Date().toISOString()
            })
            .eq('document_id', documentId)
            .eq('user_id', userId);
          break;

        case 'content':
          // Handle content changes - broadcast to other collaborators and save to database
          broadcastToDocument(documentId, message, userId);
          
          // Update document content and increment version
          await supabase
            .from('knowledge_documents')
            .update({
              content: message.data?.content,
              last_editor_id: userId,
              editing_started_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', documentId);
          break;

        case 'heartbeat':
          // Keep connection alive
          socket.send(JSON.stringify({
            type: 'heartbeat',
            timestamp: Date.now()
          }));
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  };

  socket.onclose = async () => {
    console.log(`User ${userId} left collaboration for document ${documentId}`);
    
    // Remove from active connections
    activeConnections.delete(connectionId);
    
    // Remove from document collaborators
    const docCollaborators = documentCollaborators.get(documentId);
    if (docCollaborators) {
      docCollaborators.delete(userId);
      if (docCollaborators.size === 0) {
        documentCollaborators.delete(documentId);
      }
    }

    // Update database
    await supabase
      .from('knowledge_document_collaborators')
      .update({
        is_active: false,
        last_seen_at: new Date().toISOString()
      })
      .eq('document_id', documentId)
      .eq('user_id', userId);

    // Notify other collaborators of leave
    broadcastToDocument(documentId, {
      type: 'leave',
      documentId,
      userId,
      data: {},
      timestamp: Date.now()
    }, userId);
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  return response;
});

function broadcastToDocument(documentId: string, message: CollaborationMessage, excludeUserId?: string) {
  const collaborators = documentCollaborators.get(documentId);
  if (!collaborators) return;

  for (const userId of collaborators) {
    if (excludeUserId && userId === excludeUserId) continue;
    
    const connectionId = `${documentId}_${userId}`;
    const connection = activeConnections.get(connectionId);
    
    if (connection && connection.socket.readyState === WebSocket.OPEN) {
      try {
        connection.socket.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending message to collaborator:', error);
        // Remove dead connection
        activeConnections.delete(connectionId);
        collaborators.delete(userId);
      }
    }
  }
}

async function getCurrentCollaborators(documentId: string) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: collaborators } = await supabase
    .from('knowledge_document_collaborators')
    .select(`
      user_id,
      user_color,
      cursor_position,
      selection_state,
      profiles:user_id (display_name, avatar_url)
    `)
    .eq('document_id', documentId)
    .eq('is_active', true);

  return collaborators || [];
}

function generateUserColor(userId: string): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];
  
  // Generate consistent color based on userId hash
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff;
  }
  
  return colors[Math.abs(hash) % colors.length];
}
