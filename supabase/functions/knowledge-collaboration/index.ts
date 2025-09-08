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

  // Get query parameters before upgrade
  const url = new URL(req.url);
  const documentId = url.searchParams.get('documentId');
  const userId = url.searchParams.get('userId');
  const authToken = url.searchParams.get('token');

  if (!documentId || !userId || !authToken) {
    return new Response('Missing required parameters', { status: 400 });
  }

  // Initialize Supabase client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Verify user authentication BEFORE upgrade
  const { data: { user }, error: authError } = await supabase.auth.getUser(authToken);
  if (authError || !user || user.id !== userId) {
    console.error('Authentication failed:', authError?.message);
    return new Response('Authentication failed', { status: 401 });
  }

  // Verify user has access to document BEFORE upgrade
  const { data: document, error: docError } = await supabase
    .from('knowledge_documents')
    .select('id, title')
    .eq('id', documentId)
    .single();

  if (docError || !document) {
    console.error('Document access failed:', docError?.message);
    return new Response('Document not found or access denied', { status: 403 });
  }

  const connectionId = `${documentId}_${userId}`;
  const userColor = generateUserColor(userId);

  console.log(`User ${userId} attempting to join collaboration for document ${documentId}`);

  // Now upgrade to WebSocket with event handlers ready
  const { socket, response } = Deno.upgradeWebSocket(req, {
    onOpen: () => {
      console.log(`WebSocket opened for user ${userId} on document ${documentId}`);
      
      // Store connection immediately (synchronous)
      activeConnections.set(connectionId, {
        socket,
        documentId,
        userId,
        userColor,
        lastSeen: Date.now()
      });

      // Add to document collaborators (synchronous)
      if (!documentCollaborators.has(documentId)) {
        documentCollaborators.set(documentId, new Set());
      }
      documentCollaborators.get(documentId)!.add(userId);

      // Send immediate response to client
      socket.send(JSON.stringify({
        type: 'connected',
        data: { userColor, userId },
        timestamp: Date.now()
      }));

      // Queue async operations to prevent onOpen blocking
      queueAsyncOperations(documentId, userId, userColor, socket);
      
      console.log(`User ${userId} connected to collaboration for document ${documentId}`);
    },
    
    onMessage: (event) => {
      try {
        const message: CollaborationMessage = JSON.parse(event.data);
        
        // Update last seen (synchronous)
        const connection = activeConnections.get(connectionId);
        if (connection) {
          connection.lastSeen = Date.now();
        }

        switch (message.type) {
          case 'cursor':
          case 'selection':
            // Broadcast immediately for real-time feel
            broadcastToDocument(documentId, message, userId);
            
            // Queue database update (non-blocking)
            queueDatabaseUpdate('collaborator', {
              document_id: documentId,
              user_id: userId,
              cursor_position: message.data?.cursor,
              selection_state: message.data?.selection,
              last_seen_at: new Date().toISOString()
            });
            break;

          case 'content':
            // Broadcast immediately for real-time feel
            broadcastToDocument(documentId, message, userId);
            
            // Queue database update (non-blocking)
            queueDatabaseUpdate('document', {
              id: documentId,
              content: message.data?.content,
              last_editor_id: userId,
              editing_started_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            break;

          case 'heartbeat':
            // Keep connection alive
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({
                type: 'heartbeat',
                timestamp: Date.now()
              }));
            }
            break;
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    },
    
    onClose: (event) => {
      console.log(`User ${userId} left collaboration for document ${documentId} (code: ${event.code})`);
      
      // Remove from active connections (synchronous)
      activeConnections.delete(connectionId);
      
      // Remove from document collaborators (synchronous)
      const docCollaborators = documentCollaborators.get(documentId);
      if (docCollaborators) {
        docCollaborators.delete(userId);
        if (docCollaborators.size === 0) {
          documentCollaborators.delete(documentId);
        }
      }

      // Notify other collaborators immediately
      broadcastToDocument(documentId, {
        type: 'leave',
        documentId,
        userId,
        data: {},
        timestamp: Date.now()
      }, userId);

      // Queue database cleanup (non-blocking)
      queueDatabaseUpdate('collaborator_leave', {
        document_id: documentId,
        user_id: userId,
        is_active: false,
        last_seen_at: new Date().toISOString()
      });
    },

    onError: (error) => {
      console.error('WebSocket error for user', userId, ':', error);
    }
  });

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

// Queue system for async operations to prevent blocking WebSocket handlers
const operationQueue: Array<() => Promise<void>> = [];
let isProcessingQueue = false;

async function queueAsyncOperations(documentId: string, userId: string, userColor: string, socket: WebSocket) {
  // Database operations
  operationQueue.push(async () => {
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabase
        .from('knowledge_document_collaborators')
        .upsert({
          document_id: documentId,
          user_id: userId,
          user_color: userColor,
          is_active: true,
          last_seen_at: new Date().toISOString()
        }, { onConflict: 'document_id,user_id' });
      
      console.log(`Database updated for user ${userId} joining document ${documentId}`);
    } catch (error) {
      console.error('Error updating database for user join:', error);
    }
  });

  // Send collaborators list
  operationQueue.push(async () => {
    try {
      const collaborators = await getCurrentCollaborators(documentId);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'collaborators',
          data: collaborators,
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('Error sending collaborators list:', error);
    }
  });

  // Notify other collaborators
  operationQueue.push(async () => {
    try {
      broadcastToDocument(documentId, {
        type: 'join',
        documentId,
        userId,
        data: { userColor },
        timestamp: Date.now()
      }, userId);
    } catch (error) {
      console.error('Error broadcasting user join:', error);
    }
  });

  processQueue();
}

function queueDatabaseUpdate(type: string, data: any) {
  operationQueue.push(async () => {
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      switch (type) {
        case 'collaborator':
          await supabase
            .from('knowledge_document_collaborators')
            .update({
              cursor_position: data.cursor_position,
              selection_state: data.selection_state,
              last_seen_at: data.last_seen_at
            })
            .eq('document_id', data.document_id)
            .eq('user_id', data.user_id);
          break;

        case 'document':
          await supabase
            .from('knowledge_documents')
            .update({
              content: data.content,
              last_editor_id: data.last_editor_id,
              editing_started_at: data.editing_started_at,
              updated_at: data.updated_at
            })
            .eq('id', data.id);
          break;

        case 'collaborator_leave':
          await supabase
            .from('knowledge_document_collaborators')
            .update({
              is_active: data.is_active,
              last_seen_at: data.last_seen_at
            })
            .eq('document_id', data.document_id)
            .eq('user_id', data.user_id);
          break;
      }
    } catch (error) {
      console.error(`Error in queued database update (${type}):`, error);
    }
  });

  processQueue();
}

async function processQueue() {
  if (isProcessingQueue || operationQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  while (operationQueue.length > 0) {
    const operation = operationQueue.shift();
    if (operation) {
      await operation();
    }
  }
  
  isProcessingQueue = false;
}
