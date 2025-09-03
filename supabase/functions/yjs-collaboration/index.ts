import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// WebSocket connections store
const connections = new Map<string, WebSocket>();
const rooms = new Map<string, Set<WebSocket>>();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { 
      status: 400,
      headers: corsHeaders 
    });
  }

  // Extract room ID from URL path
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const roomId = pathParts[pathParts.length - 1] || 'default';
  
  // Get auth token from WebSocket headers (y-websocket with wsOpts.headers)
  let token = headers.get('authorization');
  if (token?.startsWith('Bearer ')) {
    token = token.slice(7);
  }
  
  // Also check from URL params as fallback
  if (!token) {
    const paramToken = url.searchParams.get('authorization');
    if (paramToken?.startsWith('Bearer ')) {
      token = paramToken.slice(7);
    }
  }

  // Upgrade WebSocket first
  const { socket, response } = Deno.upgradeWebSocket(req, {
    headers: corsHeaders
  });

  console.log('WebSocket connection established for room:', roomId);
  // Note: No authentication required - function is public

  const connectionId = crypto.randomUUID();
  connections.set(connectionId, socket);

  // Add to room
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  rooms.get(roomId)!.add(socket);

  socket.onopen = () => {
    console.log(`WebSocket opened in room ${roomId}`);
  };

  socket.onmessage = (event) => {
    const messageSize = event.data instanceof ArrayBuffer ? event.data.byteLength : 
                       event.data instanceof Uint8Array ? event.data.length :
                       typeof event.data === 'string' ? event.data.length : 0;
    
    console.log('Received Yjs message in room:', roomId, 'type:', typeof event.data, 'size:', messageSize);
    
    // Get the room's WebSocket connections
    const room = rooms.get(roomId);
    if (room) {
      let broadcastCount = 0;
      // Broadcast message to all other connections in the room (not the sender)
      room.forEach((roomSocket) => {
        if (roomSocket !== socket && roomSocket.readyState === WebSocket.OPEN) {
          try {
            // Forward the raw binary data - Yjs handles protocol internally
            roomSocket.send(event.data);
            broadcastCount++;
          } catch (error) {
            console.error('Error broadcasting Yjs message to client:', error);
            // Remove broken connection
            room.delete(roomSocket);
          }
        }
      });
      console.log(`Broadcasted Yjs message to ${broadcastCount} clients in room ${roomId}`);
    }
  };

  socket.onclose = (event) => {
    console.log(`WebSocket closed in room ${roomId} - Code: ${event.code}, Reason: ${event.reason}`);
    connections.delete(connectionId);
    
    const room = rooms.get(roomId);
    if (room) {
      room.delete(socket);
      if (room.size === 0) {
        rooms.delete(roomId);
        console.log(`Room ${roomId} deleted - no more connections`);
      } else {
        console.log(`Room ${roomId} still has ${room.size} connections`);
      }
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  return response;
});