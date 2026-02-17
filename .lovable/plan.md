

## Probleme und Loesungen

### 1. Build-Fehler (blockiert Deployment)

Die Edge Function `supabase/functions/send-document-email/index.ts` verwendet `npm:resend@2.0.0` ohne eine `deno.json` Konfiguration. Das verhindert den Build.

**Loesung:** Eine `deno.json` im Funktionsordner erstellen mit der Resend-Abhaengigkeit.

**Datei:** `supabase/functions/send-document-email/deno.json`
```json
{
  "imports": {
    "npm:resend@2.0.0": "npm:resend@2.0.0"
  }
}
```

---

### 2. Verschluesselte Nachrichten nicht lesbar

Die aktuelle Implementierung zeigt `[Encrypted]` fuer Nachrichten, die nicht entschluesselt werden koennen. Es gibt mehrere Schwachstellen:

**Problem A:** `getMessages` liest die Timeline direkt, aber verschluesselte Events sind moeglicherweise noch nicht entschluesselt, wenn die Timeline gelesen wird. Die Decrypted-Events kommen asynchron ueber `MatrixEventEvent.Decrypted`.

**Problem B:** Die Merge-Logik in `getMessages` (Zeile 802-807) bevorzugt gecachte entschluesselte Nachrichten nur, wenn der Timeline-Eintrag `m.bad.encrypted` ist. Aber der Typ in der Timeline kann auch `m.room.encrypted` sein (nicht `m.bad.encrypted`), wodurch die entschluesselte Version ueberschrieben wird.

**Loesung:**
- In `getMessages` die Merge-Logik korrigieren: Wenn ein gecachter Eintrag bereits entschluesselt ist (Typ != `m.bad.encrypted` und != `m.room.encrypted`), diesen bevorzugen
- `decryptEventIfNeeded` fuer jedes verschluesselte Event in der Timeline aufrufen, um die Entschluesselung aktiv anzustossen

**Aenderung in `src/contexts/MatrixClientContext.tsx`, Funktion `getMessages`:**

```typescript
const getMessages = useCallback((roomId: string, limit: number = 50): MatrixMessage[] => {
  if (!client) return [];

  const room = client.getRoom(roomId);
  if (!room) return messagesRef.current.get(roomId)?.slice(-limit) || [];

  const timeline = room.getLiveTimeline().getEvents();
  
  // Trigger decryption for encrypted events
  timeline.forEach(event => {
    if (event.isEncrypted() && !event.isDecryptionFailure()) {
      try {
        event.attemptDecryption(client.getCrypto() as any).catch(() => {});
      } catch {}
    }
  });

  const timelineMessages: MatrixMessage[] = timeline
    .map(event => mapMatrixEventToMessage(room, event))
    .filter((message): message is MatrixMessage => Boolean(message));

  const cached = messagesRef.current.get(roomId) || [];
  const mergedByEventId = new Map<string, MatrixMessage>();
  for (const msg of timelineMessages) mergedByEventId.set(msg.eventId, msg);
  for (const msg of cached) {
    const existing = mergedByEventId.get(msg.eventId);
    // Keep cached decrypted version over still-encrypted timeline version
    if (!existing || 
        (existing.type === 'm.bad.encrypted' && msg.type !== 'm.bad.encrypted') ||
        (existing.content === '[Encrypted]' && msg.content !== '[Encrypted]')) {
      mergedByEventId.set(msg.eventId, msg);
    }
  }

  const mergedMessages = Array.from(mergedByEventId.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-limit);

  setMessages(prev => {
    const updated = new Map(prev);
    updated.set(roomId, mergedMessages);
    return updated;
  });

  return mergedMessages;
}, [client]);
```

---

### 3. Verifizierung bricht ab

Die Verifizierung verwendet `startVerification('m.sas.v1')` direkt nach dem Request. Das Problem: Der andere Client muss den Request erst akzeptieren, bevor `startVerification` funktioniert. Wenn der Request noch nicht "ready" ist, schlaegt der Aufruf fehl.

**Loesung:** Auf den `ready`-Status des Verification Requests warten, bevor `startVerification` aufgerufen wird.

**Aenderung in `requestSelfVerification`:**

```typescript
// Nach dem Erstellen des verificationRequest:
// Warten bis der Request bereit ist (anderer Client hat akzeptiert)
if (verificationRequest.phase !== 'started') {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Verifizierungs-Timeout: Der andere Client hat nicht rechtzeitig geantwortet. Stellen Sie sicher, dass der andere Client online ist und die Verifizierung akzeptiert.'));
    }, 60000);
    
    const checkReady = () => {
      if (verificationRequest.phase === 'ready' || verificationRequest.phase === 'started') {
        clearTimeout(timeout);
        resolve();
      }
    };
    
    verificationRequest.on('change', checkReady);
    checkReady(); // Check immediately
  });
}

let verifier: Verifier;
try {
  verifier = await verificationRequest.startVerification('m.sas.v1');
} catch (error) {
  // ... existing error handling
}
```

---

### Zusammenfassung der Aenderungen

| Datei | Aenderung |
|---|---|
| `supabase/functions/send-document-email/deno.json` | Neue Datei mit npm-Import fuer Resend |
| `src/contexts/MatrixClientContext.tsx` | Merge-Logik in `getMessages` verbessern, Entschluesselung aktiv anstossen |
| `src/contexts/MatrixClientContext.tsx` | In `requestSelfVerification` auf Ready-Phase warten vor `startVerification` |

