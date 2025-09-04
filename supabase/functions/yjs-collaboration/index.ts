import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Yjs message types (following y-websocket protocol)
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_AUTH = 2;

// Encoding/Decoding utilities
const readVarUint = (decoder: { arr: Uint8Array; pos: number }): number => {
  let num = 0;
  let mult = 1;
  const len = decoder.arr.length;
  while (decoder.pos < len) {
    const r = decoder.arr[decoder.pos++];
    num = num + (r & 0x7F) * mult;
    mult *= 128;
    if (mult > 0x80000000) {
      break;
    }
    if ((r & 0x80) === 0) {
      break;
    }
  }
  return num;
};

const writeVarUint = (encoder: { bufs: Uint8Array[] }, num: number): void => {
  while (num > 0x7F) {
    encoder.bufs.push(new Uint8Array([0x80 | (0x7F & num)]));
    num = Math.floor(num / 128);
  }
  encoder.bufs.push(new Uint8Array([0x7F & num]));
};

const encodeMessage = (messageType: number, content: Uint8Array): Uint8Array => {
  const encoder = { bufs: [] as Uint8Array[] };
  writeVarUint(encoder, messageType);
  encoder.bufs.push(content);
  
  const totalLength = encoder.bufs.reduce((sum, buf) => sum + buf.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const buf of encoder.bufs) {
    result.set(buf, offset);
    offset += buf.length;
  }
  
  return result;
};

// Room management with Y.Doc state storage
interface YjsRoom {
  sockets: Set<WebSocket>;
  lastActivity: number;
  docState: Uint8Array | null;
  awarenessState: Map<WebSocket, Uint8Array>;
}

const globalRooms = new Map<string, YjsRoom>();

// Clean up inactive rooms every 5 minutes
setInterval(() => {
  const now = Date.now();
  const ROOM_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  
  for (const [roomId, roomData] of globalRooms.entries()) {
    if (now - roomData.lastActivity > ROOM_TIMEOUT && roomData.sockets.size === 0) {
      console.log(`🧹 Cleaning up inactive room: ${roomId}`);
      globalRooms.delete(roomId);
    }
  }
}, 5 * 60 * 1000);

console.log('🚀 Native Yjs WebSocket Server starting...');

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
    const url = new URL(req.url);
    // Robust room ID extraction supporting multiple URL patterns
    let roomId = 'default';
    
    console.log(`🔍 Analyzing URL for room ID extraction:`, {
      pathname: url.pathname,
      searchParams: url.searchParams.toString()
    });
    
    // Try multiple extraction methods in order of preference
    if (url.searchParams.has('roomId')) {
      // Method 1: Query parameter (most reliable)
      roomId = url.searchParams.get('roomId') || 'default';
      console.log(`📋 Room ID from query parameter: ${roomId}`);
    } else if (url.pathname && url.pathname !== '/') {
      // Method 2: Path-based extraction with robust parsing
      const pathname = url.pathname.slice(1); // Remove leading slash
      
      // Handle various path patterns:
      // - "knowledge-doc-uuid" (direct)
      // - "functions/v1/yjs-collaboration/knowledge-doc-uuid" (nested function)
      // - "yjs-collaboration/knowledge-doc-uuid" (alternative)
      const pathSegments = pathname.split('/').filter(segment => segment.length > 0);
      
      console.log(`🗂️ Path segments:`, pathSegments);
      
      // Find the segment that looks like a knowledge-doc room ID
      const knowledgeDocSegment = pathSegments.find(segment => 
        segment.startsWith('knowledge-doc-') && 
        /^knowledge-doc-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)
      );
      
      if (knowledgeDocSegment) {
        roomId = knowledgeDocSegment;
        console.log(`✅ Valid knowledge-doc room ID found: ${roomId}`);
      } else {
        // Fallback: use the last segment if it's not empty
        const lastSegment = pathSegments[pathSegments.length - 1];
        if (lastSegment && lastSegment !== 'yjs-collaboration') {
          roomId = lastSegment;
          console.log(`⚠️ Using last path segment as room ID: ${roomId}`);
        } else {
          console.log(`❌ No valid room ID found, using default`);
        }
      }
    }
    
    // Validate room ID format
    const isValidFormat = /^knowledge-doc-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId);
    if (!isValidFormat && roomId !== 'default') {
      console.log(`⚠️ Room ID "${roomId}" doesn't match expected format, keeping as-is for debugging`);
    }
    
    console.log(`🔌 New WebSocket connection for room: ${roomId}`);

    const { socket, response } = Deno.upgradeWebSocket(req);
    
    // Initialize room if it doesn't exist
    if (!globalRooms.has(roomId)) {
      globalRooms.set(roomId, {
        sockets: new Set(),
        lastActivity: Date.now(),
        docState: null,
        awarenessState: new Map()
      });
      console.log(`🆕 Created new room: ${roomId}`);
    }
    
    const room = globalRooms.get(roomId)!;
    
    socket.onopen = () => {
      console.log(`✅ WebSocket opened for room: ${roomId}`);
      room.sockets.add(socket);
      room.lastActivity = Date.now();
      
      // Send existing document state to new client (sync step 1)
      if (room.docState) {
        console.log(`📤 Sending existing doc state to new client (${room.docState.length} bytes)`);
        socket.send(encodeMessage(MESSAGE_SYNC, room.docState));
      }
      
      // Send existing awareness states to new client
      room.awarenessState.forEach((awarenessData, clientSocket) => {
        if (clientSocket !== socket && clientSocket.readyState === WebSocket.OPEN) {
          try {
            socket.send(encodeMessage(MESSAGE_AWARENESS, awarenessData));
          } catch (err) {
            console.error('❌ Error sending awareness to new client:', err);
          }
        }
      });
      
      console.log(`👥 Room ${roomId} now has ${room.sockets.size} clients`);
    };

    socket.onmessage = (event) => {
      try {
        if (!(event.data instanceof ArrayBuffer)) {
          console.warn('⚠️ Received non-binary data, ignoring');
          return;
        }
        
        const data = new Uint8Array(event.data);
        console.log(`📥 Received binary message: ${data.length} bytes in room ${roomId}`);
        
        if (data.length === 0) {
          console.warn('⚠️ Received empty message');
          return;
        }
        
        // Decode message type
        const decoder = { arr: data, pos: 0 };
        const messageType = readVarUint(decoder);
        const content = data.slice(decoder.pos);
        
        console.log(`📋 Message type: ${messageType}, content: ${content.length} bytes`);
        
        room.lastActivity = Date.now();
        
        switch (messageType) {
          case MESSAGE_SYNC:
            console.log(`🔄 Sync message received (${content.length} bytes)`);
            // Store document state
            room.docState = content;
            
            // Broadcast sync update to all other clients
            let syncBroadcastCount = 0;
            room.sockets.forEach(clientSocket => {
              if (clientSocket !== socket && clientSocket.readyState === WebSocket.OPEN) {
                try {
                  clientSocket.send(data);
                  syncBroadcastCount++;
                } catch (err) {
                  console.error('❌ Error broadcasting sync:', err);
                  room.sockets.delete(clientSocket);
                  room.awarenessState.delete(clientSocket);
                }
              }
            });
            console.log(`📡 Broadcasted sync to ${syncBroadcastCount} clients`);
            break;
            
          case MESSAGE_AWARENESS:
            console.log(`👁️ Awareness message received (${content.length} bytes)`);
            // Store awareness state for this client
            room.awarenessState.set(socket, content);
            
            // Broadcast awareness to all other clients
            let awarenessBroadcastCount = 0;
            room.sockets.forEach(clientSocket => {
              if (clientSocket !== socket && clientSocket.readyState === WebSocket.OPEN) {
                try {
                  clientSocket.send(data);
                  awarenessBroadcastCount++;
                } catch (err) {
                  console.error('❌ Error broadcasting awareness:', err);
                  room.sockets.delete(clientSocket);
                  room.awarenessState.delete(clientSocket);
                }
              }
            });
            console.log(`📡 Broadcasted awareness to ${awarenessBroadcastCount} clients`);
            break;
            
          case MESSAGE_AUTH:
            console.log(`🔐 Auth message received (${content.length} bytes)`);
            // For now, we don't implement authentication
            // Just broadcast to other clients
            room.sockets.forEach(clientSocket => {
              if (clientSocket !== socket && clientSocket.readyState === WebSocket.OPEN) {
                try {
                  clientSocket.send(data);
                } catch (err) {
                  console.error('❌ Error broadcasting auth:', err);
                  room.sockets.delete(clientSocket);
                  room.awarenessState.delete(clientSocket);
                }
              }
            });
            break;
            
          default:
            console.warn(`⚠️ Unknown message type: ${messageType}`);
        }
        
      } catch (error) {
        console.error('❌ Error processing message:', error);
      }
    };

    socket.onclose = () => {
      console.log(`🚪 WebSocket closed for room: ${roomId}`);
      room.sockets.delete(socket);
      room.awarenessState.delete(socket);
      
      console.log(`👥 Room ${roomId} now has ${room.sockets.size} clients`);
      
      // Send awareness update to remaining clients (user left)
      if (room.sockets.size > 0) {
        // Create empty awareness for this client (indicates they left)
        const emptyAwareness = new Uint8Array(0);
        const awarenessUpdate = encodeMessage(MESSAGE_AWARENESS, emptyAwareness);
        
        room.sockets.forEach(clientSocket => {
          if (clientSocket.readyState === WebSocket.OPEN) {
            try {
              clientSocket.send(awarenessUpdate);
            } catch (err) {
              console.error('❌ Error notifying client of user leave:', err);
            }
          }
        });
      }
    };

    socket.onerror = (error) => {
      console.error(`❌ WebSocket error in room ${roomId}:`, error);
    };

    return response;
    
  } catch (error) {
    console.error('❌ Error upgrading WebSocket:', error);
    return new Response("Failed to upgrade to WebSocket", { 
      status: 500,
      headers: corsHeaders 
    });
  }
});