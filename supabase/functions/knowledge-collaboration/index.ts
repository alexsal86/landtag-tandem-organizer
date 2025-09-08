import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CollaborationMessage {
  type: 'ready' | 'connected' | 'ping' | 'pong' | 'error';
  documentId?: string;
  userId?: string;
  data?: any;
  timestamp: number;
  messageId?: string;
}

// Simple connection storage
const activeConnections = new Map<string, { socket: WebSocket; userId: string; documentId: string; isReady: boolean }>();

serve(async (req) => {
  console.log(`[COLLABORATION] 🚀 New request received`);

  if (req.method === 'OPTIONS') {
    console.log(`[COLLABORATION] 🔧 Handling CORS preflight request`);
    return new Response(null, { headers: corsHeaders });
  }

  const upgradeHeader = req.headers.get("upgrade") || "";
  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log(`[COLLABORATION] ❌ Non-WebSocket request received`);
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  // Get parameters
  const url = new URL(req.url);
  const documentId = url.searchParams.get('documentId');
  const userId = url.searchParams.get('userId');
  const authToken = url.searchParams.get('token');

  console.log(`[COLLABORATION] 📋 Request params - Document: ${documentId}, User: ${userId}`);

  if (!documentId || !userId || !authToken) {
    console.log(`[COLLABORATION] ❌ Missing required parameters`);
    return new Response('Missing required parameters', { status: 400 });
  }

  console.log(`[COLLABORATION] 🔄 Upgrading to WebSocket...`);
  
  const { socket, response } = Deno.upgradeWebSocket(req);
  const connectionId = `${documentId}_${userId}`;
  
  console.log(`[COLLABORATION] ✅ WebSocket upgrade successful for ${userId}`);

  // Store connection
  activeConnections.set(connectionId, {
    socket,
    userId,
    documentId,
    isReady: false
  });

  socket.onopen = () => {
    console.log(`[COLLABORATION] 🔌 WebSocket connection opened for ${userId}`);
  };

  socket.onmessage = (event) => {
    console.log(`[COLLABORATION] 📨 Message received from ${userId}: ${event.data}`);
    
    try {
      const message = JSON.parse(event.data);
      console.log(`[COLLABORATION] 🎯 Message type: ${message.type}`);

      if (message.type === 'ready') {
        console.log(`[COLLABORATION] 🤝 Client ${userId} sent ready signal`);
        
        const connection = activeConnections.get(connectionId);
        if (connection) {
          connection.isReady = true;
          console.log(`[COLLABORATION] ✅ Sending connected response to ${userId}`);
          
          const response = {
            type: 'connected',
            data: {
              userId,
              documentId,
              message: 'Connection established',
              serverTime: new Date().toISOString()
            },
            timestamp: Date.now()
          };

          socket.send(JSON.stringify(response));
          console.log(`[COLLABORATION] 📤 Connected message sent to ${userId}`);
        }
      } else if (message.type === 'ping') {
        console.log(`[COLLABORATION] 🏓 Ping from ${userId}, sending pong`);
        socket.send(JSON.stringify({
          type: 'pong',
          data: { serverTime: new Date().toISOString() },
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error(`[COLLABORATION] ❌ Error parsing message from ${userId}:`, error);
    }
  };

  socket.onclose = (event) => {
    console.log(`[COLLABORATION] 🔌 Connection closed for ${userId}, code: ${event.code}`);
    activeConnections.delete(connectionId);
  };

  socket.onerror = (event) => {
    console.error(`[COLLABORATION] ❌ WebSocket error for ${userId}:`, event);
    activeConnections.delete(connectionId);
  };

  return response;
});