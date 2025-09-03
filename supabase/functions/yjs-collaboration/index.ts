import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Global rooms storage with enhanced room management
interface RoomData {
  sockets: Set<WebSocket>;
  lastActivity: number;
  awareness: Map<WebSocket, any>;
}

const globalRooms = new Map<string, RoomData>();

// Clean up inactive rooms every 5 minutes
setInterval(() => {
  const now = Date.now();
  const ROOM_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  
  for (const [roomId, roomData] of globalRooms.entries()) {
    if (now - roomData.lastActivity > ROOM_TIMEOUT && roomData.sockets.size === 0) {
      console.log(`Cleaning up inactive room: ${roomId}`);
      globalRooms.delete(roomId);
    }
  }
}, 5 * 60 * 1000);

console.log('YJS Collaboration server starting...');

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

  try {
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    let currentRoom: string | null = null;
    let isConnected = false;

    socket.onopen = () => {
      console.log('WebSocket connection opened');
      isConnected = true;
    };

    socket.onmessage = async (event) => {
      try {
        // Handle binary data (Yjs updates and awareness)
        if (event.data instanceof ArrayBuffer) {
          const data = new Uint8Array(event.data);
          console.log(`Received binary data, length: ${data.length}, room: ${currentRoom}`);
          
          // Update room activity
          if (currentRoom && globalRooms.has(currentRoom)) {
            const roomData = globalRooms.get(currentRoom)!;
            roomData.lastActivity = Date.now();
            
            // Broadcast to all other clients in the room
            let broadcastCount = 0;
            roomData.sockets.forEach(clientSocket => {
              if (clientSocket !== socket && clientSocket.readyState === WebSocket.OPEN) {
                try {
                  clientSocket.send(data);
                  broadcastCount++;
                } catch (err) {
                  console.error('Error broadcasting binary data:', err);
                  // Remove failed socket
                  roomData.sockets.delete(clientSocket);
                }
              }
            });
            console.log(`Broadcasted binary data to ${broadcastCount} clients in room ${currentRoom}`);
          }
          return;
        }

        // Handle text messages (room management, awareness, sync)
        if (typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          console.log('Received text message:', data.type, currentRoom ? `room: ${currentRoom}` : 'no room');
          
          switch (data.type) {
            case 'join-room':
              console.log(`Client joining room: ${data.room}`);
              
              // Leave current room if exists
              if (currentRoom && globalRooms.has(currentRoom)) {
                const oldRoomData = globalRooms.get(currentRoom)!;
                oldRoomData.sockets.delete(socket);
                oldRoomData.awareness.delete(socket);
                console.log(`Left room ${currentRoom}, ${oldRoomData.sockets.size} clients remaining`);
              }
              
              // Join new room
              currentRoom = data.room;
              if (!globalRooms.has(currentRoom)) {
                globalRooms.set(currentRoom, {
                  sockets: new Set(),
                  lastActivity: Date.now(),
                  awareness: new Map()
                });
                console.log(`Created new room: ${currentRoom}`);
              }
              
              const roomData = globalRooms.get(currentRoom)!;
              roomData.sockets.add(socket);
              roomData.lastActivity = Date.now();
              
              // Send confirmation with room info
              socket.send(JSON.stringify({
                type: 'room-joined',
                room: currentRoom,
                clients: roomData.sockets.size,
                timestamp: Date.now()
              }));
              
              console.log(`Joined room ${currentRoom}, ${roomData.sockets.size} clients total`);
              break;

            case 'awareness-update':
            case 'sync-step-1':
            case 'sync-step-2':
              // Handle YJS protocol messages and awareness
              if (currentRoom && globalRooms.has(currentRoom)) {
                const roomData = globalRooms.get(currentRoom)!;
                roomData.lastActivity = Date.now();
                
                // Store awareness data if available
                if (data.type === 'awareness-update' && data.awareness) {
                  roomData.awareness.set(socket, data.awareness);
                }
                
                // Broadcast to all other clients in the room
                let broadcastCount = 0;
                roomData.sockets.forEach(clientSocket => {
                  if (clientSocket !== socket && clientSocket.readyState === WebSocket.OPEN) {
                    try {
                      clientSocket.send(JSON.stringify(data));
                      broadcastCount++;
                    } catch (err) {
                      console.error('Error broadcasting message:', err);
                      roomData.sockets.delete(clientSocket);
                      roomData.awareness.delete(clientSocket);
                    }
                  }
                });
                console.log(`Broadcasted ${data.type} to ${broadcastCount} clients in room ${currentRoom}`);
              }
              break;

            default:
              console.log(`Unknown message type: ${data.type}`);
          }
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };

    socket.onclose = () => {
      // Remove socket from current room
      if (currentRoom && globalRooms.has(currentRoom)) {
        const roomData = globalRooms.get(currentRoom)!;
        roomData.sockets.delete(socket);
        roomData.awareness.delete(socket);
        console.log(`Socket removed from room ${currentRoom}, ${roomData.sockets.size} clients remaining`);
        
        // Notify other clients about user leaving
        if (roomData.sockets.size > 0) {
          const leaveMessage = JSON.stringify({
            type: 'user-left',
            room: currentRoom,
            clients: roomData.sockets.size,
            timestamp: Date.now()
          });
          
          roomData.sockets.forEach(clientSocket => {
            if (clientSocket.readyState === WebSocket.OPEN) {
              try {
                clientSocket.send(leaveMessage);
              } catch (err) {
                console.error('Error notifying client of user leave:', err);
              }
            }
          });
        }
      }
      isConnected = false;
      console.log('WebSocket connection closed');
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      isConnected = false;
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