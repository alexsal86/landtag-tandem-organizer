import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as Y from "https://esm.sh/yjs@13.6.27";
import * as syncProtocol from "https://esm.sh/y-protocols@1.0.6/sync";
import * as awarenessProtocol from "https://esm.sh/y-protocols@1.0.6/awareness";
import * as encoding from "https://esm.sh/lib0@0.2.97/encoding";
import * as decoding from "https://esm.sh/lib0@0.2.97/decoding";

console.log("Listening on http://localhost:9999/");

// Store Y.Doc instances per document ID
const documents = new Map<string, Y.Doc>();

// Store WebSocket connections per document
const connections = new Map<string, Set<WebSocket>>();

/**
 * Get or create Y.Doc for a document
 */
function getOrCreateDoc(documentId: string): Y.Doc {
  if (!documents.has(documentId)) {
    console.log(`[YJS] Creating new Y.Doc for document: ${documentId}`);
    const doc = new Y.Doc();
    documents.set(documentId, doc);
    
    // Update handler to broadcast changes
    doc.on("update", (update: Uint8Array) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, syncProtocol.messageYjsUpdate);
      encoding.writeVarUint8Array(encoder, update);
      broadcastMessage(documentId, encoding.toUint8Array(encoder), null);
    });
  }
  return documents.get(documentId)!;
}

/**
 * Broadcast message to all connected clients except sender
 */
function broadcastMessage(
  documentId: string,
  message: Uint8Array,
  excludeSocket: WebSocket | null
) {
  const conns = connections.get(documentId);
  if (!conns) return;

  conns.forEach((socket) => {
    if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  });
}

/**
 * Handle incoming messages from clients
 */
function handleMessage(
  documentId: string,
  userId: string,
  message: Uint8Array,
  socket: WebSocket
) {
  const decoder = decoding.createDecoder(message);
  const messageType = decoding.readVarUint(decoder);

  switch (messageType) {
    case syncProtocol.messageYjsSyncStep1: {
      console.log(`[YJS] Received SyncStep1 from user ${userId}`);
      const doc = getOrCreateDoc(documentId);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, syncProtocol.messageYjsSyncStep2);
      syncProtocol.writeSyncStep2(decoder, encoder, doc);
      const syncResponse = encoding.toUint8Array(encoder);
      
      // Send to requesting client
      socket.send(syncResponse);
      
      // Broadcast to all other clients
      console.log(`[YJS] Broadcasting SyncStep2 to other clients for document ${documentId}`);
      broadcastMessage(documentId, syncResponse, socket);
      break;
    }

    case syncProtocol.messageYjsSyncStep2: {
      console.log(`[YJS] Received SyncStep2 from user ${userId}`);
      const doc = getOrCreateDoc(documentId);
      syncProtocol.readSyncStep2(decoder, doc, null);
      
      // Broadcast SyncStep2 to all other clients
      console.log(`[YJS] Broadcasting SyncStep2 for document ${documentId}`);
      broadcastMessage(documentId, message, socket);
      break;
    }

    case syncProtocol.messageYjsUpdate: {
      console.log(`[YJS] Received UPDATE from user ${userId}, broadcasting...`);
      const doc = getOrCreateDoc(documentId);
      syncProtocol.readUpdate(decoder, doc, null);
      
      // Broadcast update to all other clients
      broadcastMessage(documentId, message, socket);
      console.log(`[YJS] UPDATE broadcast complete for document ${documentId}`);
      break;
    }

    case awarenessProtocol.messageAwareness: {
      console.log(`[YJS] Received AWARENESS from user ${userId}`);
      // Just broadcast awareness updates
      broadcastMessage(documentId, message, socket);
      break;
    }

    default:
      console.warn(`[YJS] Unknown message type: ${messageType}`);
  }
}

/**
 * Main Deno serve handler
 */
Deno.serve(async (req) => {
  console.log("[YJS] New request received");
  
  const { headers } = req;
  const upgrade = headers.get("upgrade") || "";

  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  const url = new URL(req.url);
  const documentId = url.searchParams.get("documentId") || "default";
  const userId = url.searchParams.get("userId") || "anonymous";

  console.log(`[YJS] WebSocket upgrade - Document: ${documentId}, User: ${userId}`);

  const { socket, response } = Deno.upgradeWebSocket(req);

  // Initialize document
  getOrCreateDoc(documentId);

  // Add connection to document's connection set
  if (!connections.has(documentId)) {
    connections.set(documentId, new Set());
  }
  connections.get(documentId)!.add(socket);

  socket.onopen = () => {
    console.log(`[YJS] WebSocket opened for user ${userId} on document ${documentId}`);
    
    // Send SyncStep1 to initialize sync
    const doc = getOrCreateDoc(documentId);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, syncProtocol.messageYjsSyncStep1);
    syncProtocol.writeSyncStep1(encoder, doc);
    socket.send(encoding.toUint8Array(encoder));
  };

  socket.onmessage = (event) => {
    try {
      const message = new Uint8Array(event.data);
      handleMessage(documentId, userId, message, socket);
    } catch (error) {
      console.error(`[YJS] Error handling message from user ${userId}:`, error);
    }
  };

  socket.onclose = () => {
    console.log(`[YJS] WebSocket closed for user ${userId}`);
    
    const conns = connections.get(documentId);
    if (conns) {
      conns.delete(socket);
      
      // Clean up if no more connections
      if (conns.size === 0) {
        console.log(`[YJS] No more connections for document ${documentId}, cleaning up`);
        connections.delete(documentId);
        const doc = documents.get(documentId);
        if (doc) {
          doc.destroy();
          documents.delete(documentId);
        }
      }
    }
  };

  socket.onerror = (error) => {
    console.error(`[YJS] WebSocket error for user ${userId}:`, error);
  };

  return response;
});
