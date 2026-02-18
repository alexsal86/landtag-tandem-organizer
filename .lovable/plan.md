

## Egress-Reduktion: PostgREST und Realtime optimieren

### Analyse der Hauptverursacher

Die App hat drei systematische Probleme, die zu exzessivem Egress fuehren:

---

### Problem 1: Realtime-Subscriptions ohne Filter loesen vollstaendige Refetches aus

Fast alle Realtime-Subscriptions verwenden `event: '*'` ohne tenant_id-Filter und loesen bei JEDEM Change auf der Tabelle einen kompletten Refetch aus -- auch bei Aenderungen anderer Tenants/User.

**Betroffene Stellen (18 Dateien):**

| Datei | Tabellen | Auswirkung |
|---|---|---|
| `MyWorkView.tsx` | tasks, task_decisions, meetings, case_files, event_plannings + 5 weitere | 10 Subscriptions, jeder Change ruft `loadCounts()` + `refreshCounts()` auf |
| `CombinedMessagesWidget.tsx` | messages, message_confirmations, message_recipients | 3 Subscriptions, jeder Change ruft `fetchUnreadCounts()` auf (2x RPC!) |
| `BlackBoard.tsx` | messages, message_confirmations | 2 Subscriptions, jeder Change ruft `fetchPublicMessages()` auf |
| `MessageSystem.tsx` | messages, message_recipients, message_confirmations | 3 Subscriptions, jeder Change ruft `fetchMessages()` auf (N+1 Queries!) |
| `useNavigationNotifications.tsx` | notifications, user_navigation_visits | 2 Subscriptions, jeder Change ruft `loadNavigationCounts()` auf |
| `useCounts.tsx` | contacts, distribution_lists | 2 Subscriptions, jeder Change ruft `fetchCounts()` auf (4 Queries) |
| `useTeamAnnouncements.ts` | team_announcements, team_announcement_dismissals | 2 Subscriptions |
| `useStakeholderPreload.tsx` | contacts | 1 Subscription, laedt ALLE Kontakte neu |
| `useAllPersonContacts.tsx` | contacts | 1 Subscription, laedt ALLE Kontakte neu |

**Fix:** Filter auf `filter: \`tenant_id=eq.\${currentTenant.id}\`` setzen wo moeglich, und bei user-spezifischen Tabellen auf `user_id=eq.${user.id}`. Events auf `INSERT` oder `UPDATE` einschraenken statt `*`.

---

### Problem 2: Doppelte und dreifache Subscriptions auf dieselben Tabellen

Wenn ein User das Dashboard oeffnet, laufen gleichzeitig:

- `BlackBoard.tsx` hoert auf `messages` + `message_confirmations`
- `CombinedMessagesWidget.tsx` hoert auf `messages` + `message_confirmations` + `message_recipients`
- `MessageSystem.tsx` hoert auf `messages` + `message_recipients` + `message_confirmations`

Das sind **3 separate Channels** die auf dieselben 3 Tabellen hoeren. Jede Aenderung loest 3 separate Refetches aus.

Dazu kommt:
- `useNotifications.tsx` hoert auf `notifications` (INSERT + UPDATE)
- `useNavigationNotifications.tsx` hoert ebenfalls auf `notifications` (alle Events)

**Fix:** Nachrichten-Subscriptions in einen gemeinsamen Hook zusammenfuehren. Notifications-Subscriptions konsolidieren.

---

### Problem 3: `select('*')` statt gezielter Spaltenauswahl

122 Dateien verwenden `.select('*')`. Das laedt alle Spalten, auch wenn nur 2-3 gebraucht werden. Bei Tabellen mit JSONB-Feldern (z.B. `layout_data`, `content`) vervielfacht das den Egress.

**Wichtigste Kandidaten:**
- `contacts`-Tabelle: Hat viele Spalten, wird aber oft nur fuer Name + Avatar gebraucht
- `event_plannings`: Wird mit `select('*')` geladen, obwohl nur Titel und Datum gezeigt werden
- `documents`: Wird mit `select('*')` geladen, kann grosse content-Felder haben

**Fix:** Schrittweise `.select('*')` durch explizite Spaltenauswahl ersetzen, priorisiert nach Tabellengroesse.

---

### Problem 4: `removeAllChannels()` in RealTimeSync

In `RealTimeSync.tsx` Zeile 239 steht `supabase.removeAllChannels()`. Das entfernt ALLE Channels im gesamten Client -- auch die von Notifications, Counts, etc. Diese muessen sich dann alle neu verbinden, was zusaetzlichen Overhead erzeugt.

**Fix:** Nur den eigenen Channel entfernen, nicht alle.

---

### Problem 5: CombinedMessagesWidget ruft RPC zweimal auf

`fetchUnreadCounts()` ruft `get_user_messages` zweimal auf (Zeile 28 und 37) -- einmal fuer Blackboard-Count, einmal fuer Messages-Count. Das ist derselbe RPC-Call mit denselben Daten.

**Fix:** Einmal aufrufen, Ergebnis in zwei Filter aufteilen.

---

### Umsetzungsplan (priorisiert nach Impact)

**Phase 1 -- Sofort-Fixes (groesster Impact, geringstes Risiko):**

1. **`RealTimeSync.tsx`**: `removeAllChannels()` durch `supabase.removeChannel(channel)` ersetzen
2. **`CombinedMessagesWidget.tsx`**: RPC-Doppelaufruf eliminieren (1 statt 2 Calls)
3. **Alle Realtime-Subscriptions**: `filter` Parameter hinzufuegen (tenant_id oder user_id)

**Phase 2 -- Konsolidierung (mittel):**

4. **Messages-Subscriptions zusammenfuehren**: Ein `useMessagesRealtime`-Hook statt 3 separate Channels auf messages/confirmations/recipients
5. **Notifications-Subscriptions zusammenfuehren**: `useNotifications` und `useNavigationNotifications` teilen sich einen Channel

**Phase 3 -- Select-Optimierung (laengerfristig):**

6. **`select('*')` schrittweise ersetzen**: Priorisiert contacts, event_plannings, documents
7. **MyWorkView Debouncing**: 10 Tabellen-Subscriptions die alle `loadCounts()` aufrufen -- Debounce auf 2 Sekunden

### Erwartete Reduktion

- Phase 1: ~40-50% weniger Realtime-Egress (Filter verhindern irrelevante Events)
- Phase 2: ~20-30% weniger PostgREST-Egress (weniger redundante Queries)
- Phase 3: ~10-20% weniger PostgREST-Egress (kleinere Payloads)
