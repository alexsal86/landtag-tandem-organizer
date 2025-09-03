import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  try {
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    // Store for document rooms
    const rooms = new Map<string, Set<WebSocket>>();
    const documentStates = new Map<string, Uint8Array>();

    socket.onopen = () => {
      console.log('WebSocket connection opened');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { type, room, content } = data;

        switch (type) {
          case 'join-room':
            if (!rooms.has(room)) {
              rooms.set(room, new Set());
            }
            rooms.get(room)?.add(socket);
            
            // Send existing document state if available
            if (documentStates.has(room)) {
              socket.send(JSON.stringify({
                type: 'sync-doc',
                room,
                content: Array.from(documentStates.get(room)!)
              }));
            }
            break;

          case 'update-doc':
            // Store document state
            documentStates.set(room, new Uint8Array(content));
            
            // Broadcast to all clients in the room except sender
            const roomSockets = rooms.get(room);
            if (roomSockets) {
              roomSockets.forEach(clientSocket => {
                if (clientSocket !== socket && clientSocket.readyState === WebSocket.OPEN) {
                  clientSocket.send(JSON.stringify({
                    type: 'doc-update',
                    room,
                    content
                  }));
                }
              });
            }
            break;

          case 'awareness-update':
            // Broadcast awareness info to room
            const awarenessRoom = rooms.get(room);
            if (awarenessRoom) {
              awarenessRoom.forEach(clientSocket => {
                if (clientSocket !== socket && clientSocket.readyState === WebSocket.OPEN) {
                  clientSocket.send(JSON.stringify({
                    type: 'awareness-update',
                    room,
                    content
                  }));
                }
              });
            }
            break;
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };

    socket.onclose = () => {
      // Remove socket from all rooms
      rooms.forEach((sockets, room) => {
        sockets.delete(socket);
        if (sockets.size === 0) {
          rooms.delete(room);
        }
      });
      console.log('WebSocket connection closed');
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return response;
  } catch (error) {
    console.error('Error upgrading WebSocket:', error);
    return new Response("Failed to upgrade to WebSocket", { 
      status: 500,
      headers: corsHeaders 
    });
  }
});