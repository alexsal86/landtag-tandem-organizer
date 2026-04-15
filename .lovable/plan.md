

## Plan: Build-Fehler beheben + PostgREST-Egress analysieren

### Kontext: Egress am 14. April
Das Bild zeigt klar: **2.931 GB PostgREST Egress (99.5%)** — fast ausschließlich Datenbankabfragen. Auth, Storage, Realtime und Functions sind vernachlässigbar. Das deutet auf häufige/große `.select('*')`-Abfragen oder fehlende Query-Caching hin.

---

### Teil 1: Build-Fehler beheben (5 Probleme)

**1a) 4 Edge Functions mit Parse-Error** (`matrix-decision-handler`, `matrix-bot-handler`, `send-matrix-morning-greeting`, `sync-external-calendar`)
- Diese nutzen das alte `serve()` von `deno.land/std`. Das erzeugt Parse-Konflikte mit dem Deno-Checker.
- Fix: `import { serve }` entfernen und `serve(` durch `Deno.serve(` ersetzen (wie bei den funktionierenden Functions).

**1b) `respond-public-event-invitation` — TS2589 + TS2322**
- Die `index.ts` hat ein "excessively deep" Type-Problem wegen des `withSafeHandler`-Wrappers um `handleRespondPublicEventInvitation`.
- Die `.test.ts` hat ein Typ-Mismatch: `provider: "turnstile"` wird als `string` inferiert statt als Literal.
- Fix index.ts: Expliziter Return-Type-Cast oder `as` Assertion.
- Fix test.ts: `provider: "turnstile" as const` im Mock.

**1c) `ContactInfoTab.tsx` — Property `actionExternal` fehlt**
- Die `contactInfoRows`-Array-Items haben kein `actionExternal`-Feld, aber es wird an `InfoRow` übergeben.
- Fix: `actionExternal: true` bei den E-Mail/Telefon-Einträgen ergänzen, oder das Feld optional in der Übergabe machen (nur übergeben wenn vorhanden).

---

### Teil 2: Egress-Ursachen identifizieren

Nach Behebung der Build-Fehler werde ich gezielt die häufigsten Egress-Verursacher im Code suchen:

1. **Alle `.select('*')` Aufrufe finden** — diese laden komplette Zeilen inkl. großer Text-/JSON-Felder
2. **Hooks ohne `staleTime` prüfen** — fehlende Cache-Zeiten erzeugen bei jedem Mount einen neuen Netzwerk-Request
3. **Realtime-Subscriptions ohne Filter prüfen** — ungefilterte Subscriptions auf große Tabellen
4. **Besonders große Tabellen identifizieren** (Kontakte, Aufgaben, Benachrichtigungen) und deren Abfragemuster prüfen

Die Ergebnisse werden als Bericht zusammengefasst, damit wir gezielt die Top-Verursacher optimieren können.

---

### Betroffene Dateien
- `supabase/functions/matrix-decision-handler/index.ts`
- `supabase/functions/matrix-bot-handler/index.ts`
- `supabase/functions/send-matrix-morning-greeting/index.ts`
- `supabase/functions/sync-external-calendar/index.ts`
- `supabase/functions/respond-public-event-invitation/index.ts`
- `supabase/functions/respond-public-event-invitation/respond-public-event-invitation.test.ts`
- `src/components/contacts/ContactInfoTab.tsx`

