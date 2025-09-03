import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Global rooms storage - persist across connections
const globalRooms = new Map<string, Set<WebSocket>>();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400, headers: corsHeaders });
  }

  try {
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    let currentRoom: string | null = null;

    socket.onopen = () => {
      console.log('WebSocket connection opened');
    };

    socket.onmessage = async (event) => {
      try {
        // Handle binary data (Yjs updates)
        if (event.data instanceof ArrayBuffer) {
          const data = new Uint8Array(event.data);
          console.log('Received binary Yjs update, length:', data.length);
          
          // Broadcast to all clients in the current room
          if (currentRoom && globalRooms.has(currentRoom)) {
            const roomSockets = globalRooms.get(currentRoom)!;
            roomSockets.forEach(clientSocket => {
              if (clientSocket !== socket && clientSocket.readyState === WebSocket.OPEN) {
                try {
                  clientSocket.send(data);
                } catch (err) {
                  console.error('Error broadcasting to client:', err);
                }
              }
            });
          }
          return;
        }

        // Handle text messages (room management and awareness)
        const data = JSON.parse(event.data);
        console.log('Received message:', data);
        
        switch (data.type) {
          case 'join-room':
            console.log('Client joining room:', data.room);
            
            // Leave current room if exists
            if (currentRoom && globalRooms.has(currentRoom)) {
              globalRooms.get(currentRoom)!.delete(socket);
              if (globalRooms.get(currentRoom)!.size === 0) {
                globalRooms.delete(currentRoom);
              }
            }
            
            // Join new room
            currentRoom = data.room;
            if (!globalRooms.has(currentRoom)) {
              globalRooms.set(currentRoom, new Set());
            }
            globalRooms.get(currentRoom)!.add(socket);
            
            // Send confirmation
            socket.send(JSON.stringify({
              type: 'room-joined',
              room: currentRoom,
              clients: globalRooms.get(currentRoom)!.size
            }));
            break;

          case 'awareness-update':
            // Broadcast awareness updates to room
            if (currentRoom && globalRooms.has(currentRoom)) {
              const roomSockets = globalRooms.get(currentRoom)!;
              roomSockets.forEach(clientSocket => {
                if (clientSocket !== socket && clientSocket.readyState === WebSocket.OPEN) {
                  try {
                    clientSocket.send(JSON.stringify(data));
                  } catch (err) {
                    console.error('Error broadcasting awareness:', err);
                  }
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
      // Remove socket from current room
      if (currentRoom && globalRooms.has(currentRoom)) {
        const roomSockets = globalRooms.get(currentRoom)!;
        roomSockets.delete(socket);
        if (roomSockets.size === 0) {
          globalRooms.delete(currentRoom);
        }
        console.log(`Socket removed from room ${currentRoom}, ${roomSockets.size} clients remaining`);
      }
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