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

  // Extract room ID and auth token from URL
  const url = new URL(req.url);
  const roomId = url.searchParams.get('room') || 'default';
  let token = url.searchParams.get('token');
  
  // Also try to get token from Authorization header
  if (!token) {
    const authHeader = headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  // Upgrade WebSocket first
  const { socket, response } = Deno.upgradeWebSocket(req, {
    headers: corsHeaders
  });

  // If no token, close connection immediately
  if (!token) {
    console.log('No authentication token provided');
    socket.onopen = () => {
      socket.close(1008, "Authentication required");
    };
    return response;
  }

  // Verify token with Supabase
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    console.log('Authentication failed:', error?.message || 'Unknown error');
    socket.onopen = () => {
      socket.close(1008, "Invalid token");
    };
    return response;
  }

  console.log('User authenticated:', user.email, 'for room:', roomId);

  const connectionId = crypto.randomUUID();
  connections.set(connectionId, socket);

  // Add to room
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  rooms.get(roomId)!.add(socket);

  socket.onopen = () => {
    console.log(`WebSocket opened for user ${user.email} in room ${roomId}`);
  };

  socket.onmessage = (event) => {
    // Broadcast message to all clients in the same room
    const room = rooms.get(roomId);
    if (room) {
      room.forEach((client) => {
        if (client !== socket && client.readyState === WebSocket.OPEN) {
          client.send(event.data);
        }
      });
    }
  };

  socket.onclose = () => {
    console.log(`WebSocket closed for user ${user.email} in room ${roomId}`);
    connections.delete(connectionId);
    
    const room = rooms.get(roomId);
    if (room) {
      room.delete(socket);
      if (room.size === 0) {
        rooms.delete(roomId);
      }
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  return response;
});