## Beobachtung

- In der DB existieren 14 aktive/offene `task_decisions`, davon 9 sichtbar für `56188e2c…` (RPC-Test serverseitig).
- `get_my_work_decisions` ist `SECURITY INVOKER` (kein DEFINER) und verlässt sich vollständig auf die RLS von `task_decisions`. RLS verlangt `tenant_id = ANY(get_user_tenant_ids(auth.uid()))`.
- Es gibt aktuell keine Konsolen-/Netzwerk-Logs (User ist auf `/auth`), also kein Direktbefund. Ohne Login-Identität des betroffenen Users lässt sich nicht entscheiden, ob:
  1. der RPC clientseitig nie ausgelöst wird (z. B. `user?.id` undefined),
  2. der RPC eine PostgREST-Fehlerantwort liefert (RLS / `get_user_tenant_ids`-Permission-Denied → leere Liste),
  3. die Antwort zurückkommt, aber `filterDecisionsByTab` alles wegfiltert (z. B. weil die aktive Tab-Auswahl in `localStorage` einen Zustand hat, in dem alle Tabs ausgeblendet sind).

## Plan

1. **Diagnose-Hilfsausgabe ergänzen** in `useMyWorkDecisionsData.ts` und `useDecisionOverviewData.ts`:
   - Bei jedem Load `debugConsole.log` mit `userId`, Anzahl Roh-Entscheidungen aus RPC, Anzahl nach Dedupe.
   - Bei RPC-Fehler `notify.error` mit Code statt nur `setError`, damit der User den Hinweis sieht.
2. **Sichtbarer Empty-State** in `MyWorkDecisionsTab.tsx`: zusätzlich zur tabbezogenen Empty-Message einen Hinweis „0 Entscheidungen geladen" anzeigen, wenn `decisions.length === 0` (statt nur tab-spezifischer Text).
3. **Tab-Reset-Schutz**: in `useMyWorkSettings.tsx` sicherstellen, dass `hiddenDecisionTabs` niemals alle 4 Tabs ausblendet (Sanitizer ergänzen). Falls Storage einen kaputten Zustand enthält → auf Default zurückfallen.
4. **`get_my_work_decisions` zu `SECURITY DEFINER` umstellen** (Migration), damit ein Permission-Issue auf `get_user_tenant_ids` (anon-Aufrufe) RPC-Antworten nicht beeinflussen kann; intern weiterhin `tenant_id`-Check via `get_user_tenant_ids(p_user_id)`. Nur ausführen, wenn Schritt 1–3 das Problem nicht beseitigen.
5. **Verifikation**:
   - User bittet sich neu einzuloggen, Konsole zeigt jetzt RPC-Resultatlänge.
   - Falls `length > 0` → Filter-/Tab-Logik ist Ursache (Schritt 3 deckt's ab).
   - Falls `length === 0` mit Fehler → Schritt 4 ausführen und ggf. RLS prüfen.

## Rückfrage

Bevor ich Code ändere: bitte die Anzeige-Mail oder User-ID des betroffenen Accounts nennen, damit ich gezielt prüfen kann, ob `user_tenant_memberships` für diesen User aktiv sind und ob die RPC-Antwort > 0 ist. Andernfalls fahre ich mit den Diagnose-Schritten 1–3 fort.
