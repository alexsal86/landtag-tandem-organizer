

## Plan: SW-Interception für Cross-Origin Requests deaktivieren

### Ursache
Der Service Worker (`public/sw.js`) fängt **alle** Fetch-Requests ab — auch die cross-origin Requests an die Supabase Edge Function. Dabei wird:

1. Die Original-Response (Typ `cors`) in eine `new Response()` umgewandelt (Typ `default`)
2. Das Hauptdokument wird mit `Cross-Origin-Embedder-Policy: require-corp` ausgeliefert
3. Der Browser blockiert die umgewandelte Response, weil sie unter COEP nicht als gültige CORS-Response erkannt wird

Der VAPID-Key-Request an `send-push-notification` scheitert deshalb im Browser, obwohl der Server korrekt antwortet (verifiziert per curl mit Origin-Header).

### Lösung

**`public/sw.js` — Cross-Origin Requests überspringen**

Im `fetch`-Event-Handler eine Prüfung ergänzen: Wenn die Request-URL einen anderen Origin hat als der SW selbst, wird der Request **nicht** interceptiert (kein `e.respondWith()`). Der Browser handled den Request dann nativ mit korrekter CORS-Validierung.

```javascript
// Direkt nach den Vite-Dev-Checks:
if (url.origin !== self.location.origin) return;
```

Da `skipIsolation` für diese Requests sowieso `true` wäre (keine Header-Änderung nötig), gehen keine Funktionen verloren. Nur die Response-Typ-Konversion, die das Problem verursacht, entfällt.

### Betroffene Dateien
- `public/sw.js` — eine Zeile hinzufügen

### Erwartetes Ergebnis
- VAPID-Key-Request an Supabase wird nicht mehr vom SW umgewandelt
- Push-Aktivierung funktioniert wieder
- COI-Headers werden weiterhin korrekt auf das Hauptdokument angewendet

