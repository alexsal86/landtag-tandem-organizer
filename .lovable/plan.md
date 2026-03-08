
## Benachrichtigungen & Badges für Vorgänge — Umgesetzt

### Was wurde gemacht:

1. **DB: Neue `notification_types` für Kategorie `cases`** (alle 3 Tenants)
   - `case_item_created`, `case_item_assigned`, `case_item_status_changed`, `case_item_comment`

2. **DB: `notification_navigation_mapping`** — alle 4 Typen auf `navigation_context = 'mywork'` gemappt, damit Sidebar-Badge korrekt zählt.

3. **UI: `NotificationSettings.tsx`** — Kategorie `cases` / "Vorgänge" mit Icon 📋 eingefügt (Order 3).

4. **Code: `useCaseItems.tsx`** — `create_notification` RPC-Aufrufe bei:
   - Vorgang erstellen → Benachrichtigung an zugewiesenen Owner
   - Status-Änderung → Benachrichtigung an Ersteller + Owner
   - Zuweisung-Änderung → Benachrichtigung an neuen Owner
   - Kommentar/Interaktion → Benachrichtigung an Ersteller + Owner

5. **Badge-System**: Sidebar-Badge für "Meine Arbeit" zählt nun auch Vorgang-Benachrichtigungen (via `navigation_context = 'mywork'` Trigger). Interne Tab-Badges bleiben über `useMyWorkNewCounts` (Zeitstempel-basiert).
