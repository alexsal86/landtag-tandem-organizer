import "jsr:@supabase/functions-js/edge-runtime.d.ts";

console.log("[WebSocket Relay] Letter Collaboration Server starting...");
console.log("[WebSocket Relay] Acting as pure message relay - no Yjs logic");

// Store active WebSocket connections per document
const rooms = new Map<string, Set<WebSocket>>();

/**
 * Broadcast a message to all clients in a room except the sender
 */
function broadcastToRoom(
  documentId: string,
  message: ArrayBuffer | string,
  sender: WebSocket
) {
  const clients = rooms.get(documentId);
  if (!clients) {
    console.log(`[Relay] No clients in room ${documentId}`);
    return;
  }

  let broadcastCount = 0;
  clients.forEach((client) => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(message);
      broadcastCount++;
    }
  });

  console.log(`[Relay] Broadcasted message to ${broadcastCount} clients in room ${documentId}`);
}

/**
 * Add a client to a room
 */
function addToRoom(documentId: string, socket: WebSocket) {
  if (!rooms.has(documentId)) {
    rooms.set(documentId, new Set());
    console.log(`[Relay] Created new room: ${documentId}`);
  }
  rooms.get(documentId)!.add(socket);
  console.log(`[Relay] Room ${documentId} now has ${rooms.get(documentId)!.size} clients`);
}

/**
 * Remove a client from a room
 */
function removeFromRoom(documentId: string, socket: WebSocket) {
  const clients = rooms.get(documentId);
  if (!clients) return;

  clients.delete(socket);
  console.log(`[Relay] Room ${documentId} now has ${clients.size} clients`);

  // Clean up empty rooms
  if (clients.size === 0) {
    rooms.delete(documentId);
    console.log(`[Relay] Deleted empty room: ${documentId}`);
  }
}

/**
 * Main Deno serve handler
 */
Deno.serve(async (req) => {
  console.log("[Relay] New request received");
  
  const { headers } = req;
  const upgrade = headers.get("upgrade") || "";

  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  const url = new URL(req.url);
  const documentId = url.searchParams.get("documentId") || "default";
  const userId = url.searchParams.get("userId") || "anonymous";

  console.log(`[Relay] WebSocket upgrade - Document: ${documentId}, User: ${userId}`);

  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = () => {
    console.log(`[Relay] WebSocket opened - User: ${userId}, Document: ${documentId}`);
    addToRoom(documentId, socket);
  };

  socket.onmessage = (event) => {
    // Simply forward the message to all other clients in the same room
    // NO Yjs parsing or interpretation - pure relay!
    const messageSize = event.data?.byteLength || event.data?.length || 0;
    console.log(`[Relay] Message received from ${userId} in ${documentId} (${messageSize} bytes)`);
    
    broadcastToRoom(documentId, event.data, socket);
  };

  socket.onclose = () => {
    console.log(`[Relay] WebSocket closed - User: ${userId}`);
    removeFromRoom(documentId, socket);
  };

  socket.onerror = (error) => {
    console.error(`[Relay] WebSocket error - User: ${userId}:`, error);
    removeFromRoom(documentId, socket);
  };

  return response;
});
