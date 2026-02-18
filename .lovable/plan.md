

## Egress-Reduktion: PostgREST und Realtime optimieren

### Phase 1 -- ERLEDIGT ✅

1. **`RealTimeSync.tsx`**: `removeAllChannels()` durch `supabase.removeChannel(channelRef)` ersetzt
2. **`CombinedMessagesWidget.tsx`**: RPC-Doppelaufruf eliminiert (1 statt 2 Calls)
3. **Realtime-Subscriptions**: Filter (tenant_id/user_id) und Debouncing hinzugefuegt:
   - `MyWorkView.tsx`: 2s Debounce + user_id-Filter auf 8 Tabellen
   - `useCounts.tsx`: 2 Channels → 1 Channel, 2s Debounce
   - `useNavigationNotifications.tsx`: 1s Debounce
   - `BlackBoard.tsx`: 1s Debounce, INSERT-only auf messages
   - `MessageSystem.tsx`: 1s Debounce, INSERT-only auf messages

### Phase 2 -- ERLEDIGT ✅

4. **Messages-Subscriptions konsolidiert**: Neuer `useMessagesRealtime` Hook ersetzt 3 separate Channels:
   - `BlackBoard.tsx`, `MessageSystem.tsx`, `CombinedMessagesWidget.tsx` nutzen jetzt einen einzigen geteilten Channel
   - Singleton-Pattern: Nur 1 Realtime-Channel fuer messages/confirmations/recipients, egal wie viele Komponenten subscriben
   - Eingebautes 1s Debouncing

5. **Notifications-Subscriptions konsolidiert**: 
   - `useNavigationNotifications.tsx` hat keinen eigenen `notifications`-Channel mehr
   - Reagiert stattdessen auf Custom Events (`notifications-changed`) von `useNotifications.tsx`
   - Behaelt nur den `user_navigation_visits`-Channel

### Phase 3 -- Select-Optimierung (offen)

6. **`select('*')` schrittweise ersetzen**: Priorisiert contacts, event_plannings, documents
7. **MyWorkView Debouncing**: Bereits in Phase 1 umgesetzt ✅

### Erwartete Reduktion (kumuliert)

- Phase 1: ~40-50% weniger Realtime-Egress
- Phase 2: ~20-30% weniger PostgREST-Egress (weniger redundante Queries durch geteilte Channels)
- Phase 3: ~10-20% weniger PostgREST-Egress (kleinere Payloads)
