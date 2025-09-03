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
    const awarenessStates = new Map<string, Map<number, Uint8Array>>();

    socket.onopen = () => {
      console.log('WebSocket connection opened');
    };

    socket.onmessage = (event) => {
      try {
        // Handle binary data (Yjs updates)
        if (event.data instanceof ArrayBuffer) {
          const data = new Uint8Array(event.data);
          
          // Extract message type and room from first bytes (simplified)
          // In a real implementation, you'd parse the Yjs message format properly
          console.log('Received binary Yjs update, length:', data.length);
          
          // For now, we'll broadcast to all rooms
          // This is a simplified approach - in production you'd need proper message parsing
          rooms.forEach((sockets, room) => {
            sockets.forEach(clientSocket => {
              if (clientSocket !== socket && clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(data);
              }
            });
          });
          return;
        }

        // Handle JSON messages (room management and awareness)
        const data = JSON.parse(event.data);
        const { type, room, content, messageType } = data;

        switch (type) {
          case 'join-room':
            console.log('Client joining room:', room);
            if (!rooms.has(room)) {
              rooms.set(room, new Set());
              awarenessStates.set(room, new Map());
            }
            rooms.get(room)?.add(socket);
            
            // Send existing document state if available
            if (documentStates.has(room)) {
              const docData = documentStates.get(room)!;
              socket.send(docData.buffer);
            }
            break;

          case 'yjs-update':
            // Handle Yjs document updates
            if (content && room) {
              const updateData = new Uint8Array(content);
              documentStates.set(room, updateData);
              
              // Broadcast to all clients in the room except sender
              const roomSockets = rooms.get(room);
              if (roomSockets) {
                roomSockets.forEach(clientSocket => {
                  if (clientSocket !== socket && clientSocket.readyState === WebSocket.OPEN) {
                    clientSocket.send(updateData.buffer);
                  }
                });
              }
            }
            break;

          case 'awareness-update':
            // Handle awareness updates (cursors, user presence)
            if (content && room) {
              const awarenessRoom = awarenessStates.get(room);
              if (awarenessRoom) {
                const clientId = content.clientId || 0;
                const updateData = new Uint8Array(content.update);
                awarenessRoom.set(clientId, updateData);
                
                // Broadcast to all clients in the room except sender
                const roomSockets = rooms.get(room);
                if (roomSockets) {
                  roomSockets.forEach(clientSocket => {
                    if (clientSocket !== socket && clientSocket.readyState === WebSocket.OPEN) {
                      clientSocket.send(JSON.stringify({
                        type: 'awareness-update',
                        room,
                        content: content
                      }));
                    }
                  });
                }
              }
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
          awarenessStates.delete(room);
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