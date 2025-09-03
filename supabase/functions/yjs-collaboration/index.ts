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

  // Extract auth token from headers
  const authHeader = headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return new Response("Authentication required", { 
      status: 401,
      headers: corsHeaders 
    });
  }

  // Verify token with Supabase
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    console.log('Authentication failed:', error);
    return new Response("Invalid token", { 
      status: 401,
      headers: corsHeaders 
    });
  }

  console.log('User authenticated:', user.email);

  // Extract room ID from URL
  const url = new URL(req.url);
  const roomId = url.searchParams.get('room') || 'default';
  
  console.log('WebSocket connection for room:', roomId);

  const { socket, response } = Deno.upgradeWebSocket(req, {
    headers: corsHeaders
  });

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