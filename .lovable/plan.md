## Ziel
Konfigurierbare KI-Anbindung: Standard bleibt der Lovable AI Gateway, neue oder bestehende Edge Functions können per ENV-Variable auf **OpenAI direkt** (eigener API-Key) umgeschaltet werden. Default-Modell für OpenAI: `gpt-5-mini`.

## Architektur

Eine zentrale Helper-Datei `supabase/functions/_shared/aiClient.ts` kapselt beide Provider hinter einer einheitlichen API:

```text
Edge Function ──► aiClient.chat({ messages, tools, model? })
                       │
                       ├── AI_PROVIDER=lovable  → ai.gateway.lovable.dev (LOVABLE_API_KEY)
                       └── AI_PROVIDER=openai   → api.openai.com         (OPENAI_API_KEY)
```

**Provider-Auswahl-Reihenfolge:**
1. Optionaler Parameter `provider` im Funktionsaufruf (überschreibt alles)
2. Pro-Funktion-ENV: `AI_PROVIDER_<FUNCTION_NAME>` (z. B. `AI_PROVIDER_GENERATE_PREPARATION_SUGGESTIONS=openai`)
3. Globale ENV: `AI_PROVIDER` (Default: `lovable`)

So lässt sich pro Use Case entscheiden, ohne Code anzufassen.

## Schritte

### 1. Secrets vorbereiten
- User trägt `OPENAI_API_KEY` als Supabase Secret ein (über Secret-Tool angefordert).
- Optional: `AI_PROVIDER` global setzen (Default `lovable` wenn leer).

### 2. Shared AI Client (`supabase/functions/_shared/aiClient.ts`)
- Einheitliches Interface: `chat({ messages, tools?, tool_choice?, model?, stream?, provider? })`.
- Mappt Modellnamen automatisch:
  - `google/gemini-3-flash-preview` ↔ `gpt-5-mini` (OpenAI-Default)
  - `openai/gpt-5` → `gpt-5` (durchgereicht)
  - explizit übergebene Modellnamen bleiben unverändert
- Identische Response-Form für beide Provider (OpenAI-kompatibles Schema – passt ohnehin schon).
- Einheitliche Fehlerbehandlung: 401/402/429/500 → strukturierte JSON-Antwort.

### 3. Bestehende KI-Funktion anpassen
`supabase/functions/generate-preparation-suggestions/index.ts` als Referenz umstellen:
- Statt direktem `fetch(...)` → `aiClient.chat(...)`.
- Tool-Calling-Schema (`suggest_preparation`) bleibt identisch (OpenAI Function Calling = gleiche Form).
- Verhalten 1:1 erhalten, nur Provider austauschbar.

### 4. Admin-UI (klein) für Provider-Status (optional, empfohlen)
Im Bereich `/admin` oder `/superadmin` eine kleine Read-Only-Anzeige:
- Aktueller globaler Provider (aus neuer Edge Function `get-ai-config`)
- Liste der KI-Funktionen mit jeweiligem effektivem Provider
- Hinweis-Text, wo Secrets/ENV gesetzt werden (Supabase-Dashboard-Link)

Keine Edit-UI – Konfiguration läuft bewusst über Secrets, nicht über DB (Sicherheit, Auditierbarkeit).

### 5. Dokumentation
Kurze README-Notiz in `supabase/functions/_shared/README.md`:
- Welche ENV-Variablen wofür
- Wie man eine neue KI-Funktion auf OpenAI zwingt
- Beispiel-Snippet `aiClient.chat(...)`

## Technische Details

**Modell-Mapping (Standardfall):**
| Lovable Gateway | OpenAI direkt |
|---|---|
| `google/gemini-3-flash-preview` (default) | `gpt-5-mini` (default) |
| `openai/gpt-5` | `gpt-5` |
| `openai/gpt-5-mini` | `gpt-5-mini` |

**Streaming:** `aiClient.chatStream()` als zweite Funktion, gibt ReadableStream zurück (für künftige Chat-UIs). Aktuell genutzt: nur non-streaming `chat()`.

**Fehler-Response (vereinheitlicht):**
```json
{ "error": "rate_limited" | "payment_required" | "unauthorized" | "ai_error", "message": "..." }
```
Frontend kann generisch reagieren, egal welcher Provider zugrunde liegt.

**Was NICHT geändert wird:**
- Keine bestehenden Tool-Schemata (`suggest_preparation` etc.) – bleiben kompatibel.
- Keine DB-Migrationen.
- Lovable AI Gateway bleibt aktiv und Default.

## Nach Implementierung
1. User fügt `OPENAI_API_KEY` hinzu (wird im Build über Secret-Dialog angefragt).
2. Optional: `AI_PROVIDER_GENERATE_PREPARATION_SUGGESTIONS=openai` setzen, um diese Funktion auf OpenAI umzustellen.
3. Test über `/termine` → Briefing-Vorschläge generieren.
