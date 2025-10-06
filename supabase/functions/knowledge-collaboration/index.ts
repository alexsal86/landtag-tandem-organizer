import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as Y from "https://esm.sh/yjs@13.6.18";
import * as syncProtocol from "https://esm.sh/y-protocols@1.0.6/sync";
import * as awarenessProtocol from "https://esm.sh/y-protocols@1.0.6/awareness";
import * as encoding from "https://esm.sh/lib0@0.2.98/encoding";
import * as decoding from "https://esm.sh/lib0@0.2.98/decoding";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Store Y.Doc instances per document
const docs = new Map<string, Y.Doc>();
// Store connected clients per document
const connections = new Map<string, Set<WebSocket>>();

function getYDoc(documentId: string): Y.Doc {
  if (!docs.has(documentId)) {
    console.log(`[YJS] Creating new Y.Doc for document: ${documentId}`);
    const doc = new Y.Doc();
    docs.set(documentId, doc);
    
    // Setup awareness
    const awareness = new awarenessProtocol.Awareness(doc);
    (doc as any).awareness = awareness;
  }
  return docs.get(documentId)!;
}

function getConnections(documentId: string): Set<WebSocket> {
  if (!connections.has(documentId)) {
    connections.set(documentId, new Set());
  }
  return connections.get(documentId)!;
}

function broadcastMessage(documentId: string, message: Uint8Array, sender: WebSocket) {
  const conns = getConnections(documentId);
  conns.forEach(conn => {
    if (conn !== sender && conn.readyState === WebSocket.OPEN) {
      try {
        conn.send(message);
      } catch (error) {
        console.error('[YJS] Error broadcasting message:', error);
      }
    }
  });
}

serve(async (req) => {
  console.log(`[YJS] New request received`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const upgradeHeader = req.headers.get("upgrade") || "";
  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const url = new URL(req.url);
  const documentId = url.searchParams.get('documentId');
  const userId = url.searchParams.get('userId');

  console.log(`[YJS] WebSocket upgrade - Document: ${documentId}, User: ${userId}`);

  if (!documentId || !userId) {
    return new Response('Missing required parameters', { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  const doc = getYDoc(documentId);
  const awareness = (doc as any).awareness as awarenessProtocol.Awareness;
  const conns = getConnections(documentId);

  socket.onopen = () => {
    console.log(`[YJS] WebSocket opened for user ${userId} on document ${documentId}`);
    conns.add(socket);

    // Send sync step 1 (state vector)
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0); // messageType: sync
    syncProtocol.writeSyncStep1(encoder, doc);
    socket.send(encoding.toUint8Array(encoder));

    // Send awareness state
    if (awareness.getStates().size > 0) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, 1); // messageType: awareness
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(
          awareness,
          Array.from(awareness.getStates().keys())
        )
      );
      socket.send(encoding.toUint8Array(awarenessEncoder));
    }
  };

  socket.onmessage = (event) => {
    try {
      const message = new Uint8Array(event.data);
      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);

      console.log(`[YJS] Received message type ${messageType} from user ${userId}`);

      switch (messageType) {
        case 0: // sync
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, 0);
          const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc, null);
          
          if (syncMessageType === syncProtocol.messageYjsSyncStep1) {
            // Send sync step 2
            const responseEncoder = encoding.createEncoder();
            encoding.writeVarUint(responseEncoder, 0);
            syncProtocol.writeSyncStep2(responseEncoder, doc);
            socket.send(encoding.toUint8Array(responseEncoder));
          } else if (syncMessageType === syncProtocol.messageYjsSyncStep2 || 
                     syncMessageType === syncProtocol.messageYjsUpdate) {
            // Broadcast update to other clients
            broadcastMessage(documentId, message, socket);
          }
          break;

        case 1: // awareness
          awarenessProtocol.applyAwarenessUpdate(
            awareness,
            decoding.readVarUint8Array(decoder),
            null
          );
          // Broadcast awareness to other clients
          broadcastMessage(documentId, message, socket);
          break;

        default:
          console.warn(`[YJS] Unknown message type: ${messageType}`);
      }
    } catch (error) {
      console.error('[YJS] Error processing message:', error);
    }
  };

  socket.onclose = () => {
    console.log(`[YJS] WebSocket closed for user ${userId}`);
    conns.delete(socket);
    
    // Clean up empty document
    if (conns.size === 0) {
      console.log(`[YJS] No more connections for document ${documentId}, cleaning up`);
      docs.delete(documentId);
      connections.delete(documentId);
    }

    // Remove awareness state
    awareness.setLocalState(null);
  };

  socket.onerror = (error) => {
    console.error(`[YJS] WebSocket error for user ${userId}:`, error);
    conns.delete(socket);
  };

  return response;
});
