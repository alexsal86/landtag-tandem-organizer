

# Fix: Redaktion-Tab crashed wegen Realtime-Subscription

## Ursache

In `src/features/redaktion/hooks/useTopicBacklog.ts` (Zeile 301-325) wird der Realtime-Channel mit dem Namen `topic-backlog-${currentTenant.id}` erstellt. Dieser Name ist **nicht eindeutig pro Mount**.

Das Problem: `loadTopics` ist im Dependency-Array des `useEffect` (Zeile 325). Da `loadTopics` per `useCallback` von `[currentTenant?.id, user?.id]` abhängt, ändert sich seine Referenz bei jedem Render-Zyklus, in dem sich einer dieser Werte stabilisiert. Dadurch wird der Effect neu ausgeführt -- aber wenn der alte Channel noch nicht vollständig entfernt wurde oder in React 18 Strict Mode der gleiche Channelname wiederverwendet wird, wirft Supabase den Fehler:

> `cannot add postgres_changes callbacks for realtime:topic-backlog-... after subscribe()`

Dieser Fehler ist **nicht gefangen** und propagiert bis zur ErrorBoundary.

## Lösung

Zwei Änderungen in `src/features/redaktion/hooks/useTopicBacklog.ts`:

### 1. Eindeutigen Channel-Namen pro Mount verwenden
Einen `useRef(crypto.randomUUID())` anlegen und diesen als Suffix im Channel-Namen verwenden. Das folgt dem bestehenden Projekt-Muster (siehe Memory: real-time-robustness-and-subscription-pattern).

### 2. `loadTopics` aus dem Dependency-Array des Realtime-Effects entfernen
Stattdessen `loadTopics` über einen `useRef` referenzieren, damit der Effect nur bei Änderung von `currentTenant?.id` neu läuft -- nicht bei jeder Referenzänderung von `loadTopics`.

### Ergebnis
- Channel-Name ist pro Mount eindeutig → kein Konflikt bei Re-Mount
- Effect läuft nur bei Tenant-Wechsel neu → kein unnötiges Neu-Subscriben
- Fehler tritt nicht mehr auf → Redaktion-Tab und Themenspeicher funktionieren wieder

