import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CollaborationMessage {
  type: 'join' | 'leave' | 'cursor' | 'selection' | 'content' | 'heartbeat' | 'ping' | 'pong' | 'error';
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

  console.log(`[COLLABORATION] Starting IMMEDIATE connection for user ${userId}, document ${documentId}`);

  // Initialize Supabase client for async operations
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    console.error('[COLLABORATION] Missing Supabase environment variables');
    return new Response('Server configuration error', { status: 500 });
  }

  const connectionId = `${documentId}_${userId}`;
  const userColor = generateUserColor(userId);

  console.log(`[COLLABORATION] Upgrading to WebSocket for user ${userId}, document ${documentId}`);

  // PHASE 1: Upgrade to WebSocket with MINIMAL operations for stability
  const { socket, response } = Deno.upgradeWebSocket(req);
  
  console.log(`[COLLABORATION] ✅ Successfully upgraded to WebSocket for user ${userId}, document ${documentId}`);
  
  socket.onopen = () => {
    console.log(`[COLLABORATION] ✅ WebSocket opened successfully for user ${userId}`);
    
    // DELAYED connected message to fix race condition - give client time to set up onmessage handler
    setTimeout(() => {
      try {
        console.log(`[COLLABORATION] 🔄 Sending connected message after delay for user ${userId}`);
        const connectedMessage = {
          type: 'connected',
          data: {
          userId, 
          documentId, 
          userColor,
          message: 'Stable connection established - verification running in background',
          serverTime: new Date().toISOString()
        },
        timestamp: Date.now()
      };
      
      socket.send(JSON.stringify(connectedMessage));
      console.log(`[COLLABORATION] ✅ Successfully sent 'connected' confirmation to user ${userId}`);
      
      // Store connection in memory AFTER successful message send
      activeConnections.set(connectionId, {
        socket,
        documentId,
        userId,
        userColor,
        connectedAt: Date.now(),
        lastSeen: Date.now()
      });
      
      console.log(`[COLLABORATION] ✅ Connection stored in memory for user ${userId}`);
      
      // NOW do verification asynchronously in background
      verifyUserAccessAsync(userId, documentId, authToken, socket).catch(error => {
        console.error(`[COLLABORATION] Background verification failed:`, error);
        // Don't close connection for verification failures - just log
      });
      
    } catch (error) {
      console.error(`[COLLABORATION] ❌ Critical error sending connected message:`, error);
    }
    }, 150); // 150ms delay to fix race condition
  };
    
  socket.onmessage = (event) => {
    console.log(`[COLLABORATION] 📨 Received message from user ${userId}:`, event.data);
    
    try {
      const message = JSON.parse(event.data);
      console.log(`[COLLABORATION] 📨 Parsed message type: ${message.type}`);
      
      // Update last seen in memory only
      const connection = activeConnections.get(connectionId);
      if (connection) {
        connection.lastSeen = Date.now();
      }

      switch (message.type) {
        case 'request_connected':
          console.log(`[COLLABORATION] 🔄 Client requested connection status, resending connected message for user ${userId}`);
          try {
            const connectedMessage = {
              type: 'connected',
              data: {
                userId, 
                documentId, 
                userColor,
                message: 'Connection confirmed via fallback mechanism',
                serverTime: new Date().toISOString()
              },
              timestamp: Date.now()
            };
            socket.send(JSON.stringify(connectedMessage));
            console.log(`[COLLABORATION] ✅ Resent connected message for user ${userId}`);
          } catch (error) {
            console.error(`[COLLABORATION] ❌ Error resending connected message:`, error);
          }
          break;
          
        case 'ping':
          console.log(`[COLLABORATION] 🏓 Received ping from user ${userId}, sending pong`);
          try {
            socket.send(JSON.stringify({
              type: 'pong',
              data: { 
                serverTime: new Date().toISOString(),
                message: 'Phase 1: Connection stable'  
              },
              timestamp: Date.now()
            }));
            console.log(`[COLLABORATION] ✅ Pong sent successfully to user ${userId}`);
          } catch (pongError) {
            console.error(`[COLLABORATION] ❌ Error sending pong:`, pongError);
          }
          break;
          
        default:
          console.log(`[COLLABORATION] 📝 Message type '${message.type}' acknowledged but not processed in Phase 1`);
          break;
      }
    } catch (error) {
      console.error(`[COLLABORATION] ❌ Error processing message:`, error);
      console.error(`[COLLABORATION] Raw message data:`, event.data);
    }
  };
    
  socket.onclose = (event) => {
    console.log(`[COLLABORATION] 🔌 WebSocket closed for user ${userId}`);
    console.log(`[COLLABORATION] Close code: ${event.code}, Reason: "${event.reason || 'No reason provided'}"`);
    console.log(`[COLLABORATION] Was clean close: ${event.wasClean}`);
    
    // Log close reasons for debugging
    const closeReasons: Record<number, string> = {
      1000: 'Normal closure',
      1001: 'Going away',
      1002: 'Protocol error', 
      1003: 'Unsupported data',
      1006: 'Abnormal closure',
      1011: 'Server error',
      1012: 'Service restart'
    };
    
    const reasonDescription = closeReasons[event.code] || 'Unknown reason';
    console.log(`[COLLABORATION] Close reason description: ${reasonDescription}`);
    
    // Clean up memory only (no DB operations in Phase 1)
    activeConnections.delete(connectionId);
    
    const docCollaborators = documentCollaborators.get(documentId);
    if (docCollaborators) {
      docCollaborators.delete(userId);
      if (docCollaborators.size === 0) {
        documentCollaborators.delete(documentId);
      }
    }

    console.log(`[COLLABORATION] ✅ Memory cleanup completed for user ${userId}`);
  };

  socket.onerror = (event) => {
    console.error(`[COLLABORATION] ❌ WebSocket error for user ${userId}:`, event);
    console.error(`[COLLABORATION] Error type: ${event.type}`);
    // Log additional error details if available
    if ('error' in event) {
      console.error(`[COLLABORATION] Error details:`, event.error);
    }
    
    // Clean up memory on error
    activeConnections.delete(connectionId);
    const docCollaborators = documentCollaborators.get(documentId);
    if (docCollaborators) {
      docCollaborators.delete(userId);
    }
    console.log(`[COLLABORATION] ✅ Error cleanup completed for user ${userId}`);
  };

  return response;
});

// Async verification function that runs in background after connection
async function verifyUserAccessAsync(userId: string, documentId: string, authToken: string, socket: WebSocket) {
  console.log(`[COLLABORATION] 🔍 Starting background verification for user ${userId}`);
  
  try {
    // Create a user client with the auth token for proper authentication
    const userSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: { persistSession: false },
        global: {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      }
    );

    // Verify the session is valid by getting current user
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    
    if (authError || !user || user.id !== userId) {
      console.error(`[COLLABORATION] Background auth failed: ${authError?.message || 'User mismatch'}`);
      console.error(`[COLLABORATION] Expected userId: ${userId}, Got: ${user?.id}`);
      
      // FALLBACK: Keep connection alive but mark as unverified
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'error',
          data: {
            message: 'Authentication verification failed - limited functionality',
            severity: 'warning'
          },
          timestamp: Date.now()
        }));
      }
      return;
    }

    // Verify document access using user client (respects RLS)
    const { data: document, error: docError } = await userSupabase
      .from('knowledge_documents')
      .select('id, title, created_by, is_published')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error(`[COLLABORATION] Background document check failed: ${docError?.message || 'Not found'}`);
      
      // FALLBACK: Keep connection alive but inform user
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'error',
          data: {
            message: 'Document access verification failed - read-only mode',
            severity: 'warning'
          },
          timestamp: Date.now()
        }));
      }
      return;
    }

    console.log(`[COLLABORATION] ✅ Background verification successful for user ${userId}`);
    
    // Send verification success message
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'verified',
        data: {
          message: 'Access verified successfully - full functionality enabled',
          documentTitle: document.title,
          isOwner: document.created_by === userId,
          isPublished: document.is_published
        },
        timestamp: Date.now()
      }));
    }
    
  } catch (error) {
    console.error(`[COLLABORATION] Background verification error:`, error);
    
    // FINAL FALLBACK: Keep connection alive with basic functionality
    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({
          type: 'error',
          data: {
            message: 'Verification failed - basic mode only',
            severity: 'info'
          },
          timestamp: Date.now()
        }));
      } catch (sendError) {
        console.error(`[COLLABORATION] Failed to send fallback message:`, sendError);
      }
    }
  }
}

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
