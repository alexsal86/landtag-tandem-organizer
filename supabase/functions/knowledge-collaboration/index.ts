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

  console.log(`[COLLABORATION] Starting connection for user ${userId}, document ${documentId}`);

  // Initialize Supabase client with service role
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[COLLABORATION] Missing Supabase environment variables');
    return new Response('Server configuration error', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  try {
    // Verify user authentication BEFORE upgrade
    console.log(`[COLLABORATION] Verifying auth token for user ${userId}`);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authToken);
    
    if (authError) {
      console.error(`[COLLABORATION] Auth error: ${authError.message}`);
      return new Response(JSON.stringify({ error: 'Authentication failed', details: authError.message }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (!user || user.id !== userId) {
      console.error(`[COLLABORATION] User mismatch: expected ${userId}, got ${user?.id}`);
      return new Response(JSON.stringify({ error: 'User ID mismatch' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[COLLABORATION] User authenticated: ${user.id}`);

    // Verify user has access to document using service role (bypasses RLS)
    console.log(`[COLLABORATION] Checking document access for ${documentId}`);
    const { data: document, error: docError } = await supabase
      .from('knowledge_documents')
      .select('id, title, created_by, is_published')
      .eq('id', documentId)
      .single();

    if (docError) {
      console.error(`[COLLABORATION] Document query error: ${docError.message}`);
      return new Response(JSON.stringify({ error: 'Document access failed', details: docError.message }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!document) {
      console.error(`[COLLABORATION] Document not found: ${documentId}`);
      return new Response(JSON.stringify({ error: 'Document not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user can access the document (owner or published)
    const hasAccess = document.created_by === userId || document.is_published;
    if (!hasAccess) {
      console.error(`[COLLABORATION] Access denied for user ${userId} to document ${documentId}`);
      return new Response(JSON.stringify({ error: 'Access denied to document' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[COLLABORATION] Document access verified: ${document.title}`);

  } catch (error) {
    console.error(`[COLLABORATION] Pre-upgrade error: ${error.message}`);
    return new Response(JSON.stringify({ error: 'Server error', details: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const connectionId = `${documentId}_${userId}`;
  const userColor = generateUserColor(userId);

  console.log(`[COLLABORATION] Upgrading to WebSocket for user ${userId}, document ${documentId}`);

  // Now upgrade to WebSocket with comprehensive error handling
  const { socket, response } = Deno.upgradeWebSocket(req, {
    onOpen: () => {
      console.log(`[COLLABORATION] WebSocket opened for user ${userId} on document ${documentId}`);
      
      try {
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

        // Send immediate connection confirmation
        socket.send(JSON.stringify({
          type: 'connected',
          data: { userColor, userId, documentId },
          timestamp: Date.now()
        }));

        console.log(`[COLLABORATION] User ${userId} connected successfully to document ${documentId}`);

        // Queue async operations to prevent onOpen blocking
        queueAsyncOperations(documentId, userId, userColor, socket);
        
      } catch (error) {
        console.error(`[COLLABORATION] Error in onOpen: ${error.message}`);
        socket.close(1011, 'Internal server error');
      }
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
      console.error(`[COLLABORATION] WebSocket error for user ${userId}:`, error);
      // Clean up connection on error
      activeConnections.delete(connectionId);
      const docCollaborators = documentCollaborators.get(documentId);
      if (docCollaborators) {
        docCollaborators.delete(userId);
      }
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
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // First get the collaborators
    const { data: collaborators, error: collabError } = await supabase
      .from('knowledge_document_collaborators')
      .select('user_id, user_color, cursor_position, selection_state')
      .eq('document_id', documentId)
      .eq('is_active', true);

    if (collabError) {
      console.error('Error fetching collaborators:', collabError);
      return [];
    }

    if (!collaborators || collaborators.length === 0) {
      return [];
    }

    // Then get profile information separately
    const userIds = collaborators.map(c => c.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', userIds);

    // Combine the data
    const collaboratorsWithProfiles = collaborators.map(collab => {
      const profile = profiles?.find(p => p.user_id === collab.user_id);
      return {
        ...collab,
        profiles: profile ? {
          display_name: profile.display_name,
          avatar_url: profile.avatar_url
        } : null
      };
    });

    console.log(`Found ${collaboratorsWithProfiles.length} collaborators for document ${documentId}`);
    return collaboratorsWithProfiles;
  } catch (error) {
    console.error('Error in getCurrentCollaborators:', error);
    return [];
  }
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
  console.log(`[COLLABORATION] Queuing async operations for user ${userId}, document ${documentId}`);
  
  // Database operations
  operationQueue.push(async () => {
    try {
      console.log(`[COLLABORATION] Updating database for user ${userId} joining document ${documentId}`);
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { error } = await supabase
        .from('knowledge_document_collaborators')
        .upsert({
          document_id: documentId,
          user_id: userId,
          user_color: userColor,
          is_active: true,
          last_seen_at: new Date().toISOString()
        }, { onConflict: 'document_id,user_id' });
      
      if (error) {
        console.error(`[COLLABORATION] Database upsert error:`, error);
      } else {
        console.log(`[COLLABORATION] Database updated successfully for user ${userId}`);
      }
    } catch (error) {
      console.error(`[COLLABORATION] Error updating database for user join:`, error);
    }
  });

  // Send collaborators list
  operationQueue.push(async () => {
    try {
      console.log(`[COLLABORATION] Fetching collaborators for document ${documentId}`);
      const collaborators = await getCurrentCollaborators(documentId);
      console.log(`[COLLABORATION] Got ${collaborators.length} collaborators`);
      
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'collaborators',
          data: collaborators,
          timestamp: Date.now()
        }));
        console.log(`[COLLABORATION] Sent collaborators list to user ${userId}`);
      } else {
        console.log(`[COLLABORATION] Socket not open when trying to send collaborators to ${userId}`);
      }
    } catch (error) {
      console.error(`[COLLABORATION] Error sending collaborators list:`, error);
    }
  });

  // Notify other collaborators
  operationQueue.push(async () => {
    try {
      console.log(`[COLLABORATION] Broadcasting join event for user ${userId}`);
      broadcastToDocument(documentId, {
        type: 'join',
        documentId,
        userId,
        data: { userColor },
        timestamp: Date.now()
      }, userId);
      console.log(`[COLLABORATION] Join event broadcasted for user ${userId}`);
    } catch (error) {
      console.error(`[COLLABORATION] Error broadcasting user join:`, error);
    }
  });

  // Don't await processQueue - let it run in background
  processQueue().catch(error => {
    console.error(`[COLLABORATION] Error processing queue:`, error);
  });
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
  
  console.log(`[COLLABORATION] Processing queue with ${operationQueue.length} operations`);
  isProcessingQueue = true;
  
  try {
    while (operationQueue.length > 0) {
      const operation = operationQueue.shift();
      if (operation) {
        try {
          await operation();
        } catch (error) {
          console.error(`[COLLABORATION] Error in queue operation:`, error);
          // Continue with other operations even if one fails
        }
      }
    }
  } catch (error) {
    console.error(`[COLLABORATION] Critical error in processQueue:`, error);
  } finally {
    isProcessingQueue = false;
    console.log(`[COLLABORATION] Queue processing completed`);
  }
}
