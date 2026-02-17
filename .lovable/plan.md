

## Build-Fehler in Edge Functions beheben

Die Build-Fehler sind **nicht** durch die Matrix-Aenderungen verursacht, sondern bestehen schon laenger in mehreren Edge Functions. Es sind drei Fehler-Kategorien:

### 1. `error` is of type `unknown` (6 Dateien)

In `catch`-Bloecken wird `error.message` direkt aufgerufen, ohne den Typ zu pruefen. Fix: `(error as Error).message` oder `error instanceof Error ? error.message : String(error)`.

**Betroffene Dateien:**
- `batch-geocode-contacts/index.ts` (Zeilen 82, 96)
- `fetch-karlsruhe-districts/index.ts` (Zeile 188)
- `global-logout/index.ts` (Zeile 58)
- `geocode-contact-address/index.ts` (Zeile 153)
- `publish-to-ghost/index.ts` (Zeile 224)
- `reset-user-mfa/index.ts` (Zeilen 110, 114)

### 2. `Uint8Array` nicht kompatibel mit `BufferSource` (2 Dateien)

Deno's neuere Typdefinitionen erfordern `.buffer` als `ArrayBuffer` (nicht `ArrayBufferLike`). Fix: `new Uint8Array(bytes)` durch `bytes.buffer as ArrayBuffer` oder einen Cast ersetzen.

**Betroffene Dateien:**
- `publish-to-ghost/index.ts` (Zeilen 46-48, 58)
- `send-push-notification/index.ts` (Zeilen 135-137, 165-166, 178-179, 208-209)

Fix-Muster:
```text
// Vorher:
crypto.subtle.importKey('raw', secretBytes, ...)

// Nachher:
crypto.subtle.importKey('raw', secretBytes.buffer as ArrayBuffer, ...)
```

### 3. `.catch()` auf Postgrest-Builder (reset-user-mfa)

Supabase Postgrest-Builder hat kein `.catch()`. Fix: In `try/catch` umwandeln oder `.then()` verwenden.

**Betroffen:** `reset-user-mfa/index.ts` (Zeilen 78, 92)

Fix-Muster:
```text
// Vorher:
await supabase.from('table').insert({...}).catch(err => ...);

// Nachher:
const { error: insertError } = await supabase.from('table').insert({...});
if (insertError) console.error('Failed:', insertError);
```

### 4. Array-Zugriff statt Objekt (create-daily-appointment-feedback)

`external_calendars` ist ein Array, nicht ein Objekt. Fix: Auf erstes Element zugreifen.

**Betroffen:** `create-daily-appointment-feedback/index.ts` (Zeilen 176-177)

```text
// Vorher:
const userId = externalEvent.external_calendars.user_id;

// Nachher:
const userId = externalEvent.external_calendars?.[0]?.user_id;
```

### Zusammenfassung

| Datei | Aenderung |
|---|---|
| `batch-geocode-contacts/index.ts` | `error` Typ-Guard (2 Stellen) |
| `fetch-karlsruhe-districts/index.ts` | `error` Typ-Guard (1 Stelle) |
| `global-logout/index.ts` | `error` Typ-Guard (1 Stelle) |
| `geocode-contact-address/index.ts` | `error` Typ-Guard (1 Stelle) |
| `publish-to-ghost/index.ts` | `error` Typ-Guard + `BufferSource` Cast (3 Stellen) |
| `send-push-notification/index.ts` | `BufferSource` Cast (5 Stellen) |
| `reset-user-mfa/index.ts` | `error` Typ-Guard + `.catch()` durch `try/catch` ersetzen (7 Stellen) |
| `create-daily-appointment-feedback/index.ts` | Array-Zugriff `[0]` (2 Stellen) |

Insgesamt 8 Dateien mit rein mechanischen TypeScript-Fixes. Keine Logik-Aenderungen.

