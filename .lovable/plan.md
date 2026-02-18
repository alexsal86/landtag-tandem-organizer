

# Gesamtplan: Egress-Optimierung (PostgREST, Storage, Realtime)

## Ubersicht

Die Analyse zeigt erhebliches Einsparpotenzial in allen drei Egress-Bereichen. Die Massnahmen sind nach Aufwand/Wirkung priorisiert.

---

## Bereich 1: PostgREST Egress (hochste Prioritat)

### 1.1 TanStack Query Caching aktivieren (Sofortwirkung, niedriger Aufwand)

**Problem**: Keiner der 15+ `useQuery`-Hooks hat `staleTime` oder `gcTime` konfiguriert. Das bedeutet: Bei jedem Komponentenwechsel oder Remount wird sofort ein neuer Netzwerk-Request gesendet.

**Massnahme**: Globalen QueryClient mit sinnvollen Defaults konfigurieren:
- `staleTime: 2 * 60 * 1000` (2 Minuten) -- Daten gelten 2 Min als frisch, kein Refetch
- `gcTime: 10 * 60 * 1000` (10 Minuten) -- Cache bleibt 10 Min erhalten
- `refetchOnWindowFocus: false` -- Kein automatischer Refetch bei Tab-Wechsel

**Betroffene Datei**: `src/App.tsx` oder dort wo `QueryClient` erstellt wird

**Geschatztes Sparpotenzial**: 40-60% weniger PostgREST-Requests durch vermiedene Doppel-Fetches

### 1.2 select('*') durch gezielte Spaltenauswahl ersetzen (mittlerer Aufwand)

**Problem**: 102 Dateien mit 856 Vorkommen von `select('*')`. Jede Abfrage ladt ALLE Spalten, auch wenn nur 2-3 benotigt werden. Besonders problematisch bei grossen Tabellen wie `contacts`, `tasks`, `case_files`.

**Massnahme**: Die 10 meistgenutzten/grossten Tabellen priorisieren:

| Hook/Datei | Tabelle | Aktuell | Optimiert auf |
|---|---|---|---|
| `useAllPersonContacts` | contacts | `*` (alle ~30 Spalten) | `id, name, email, phone, role, organization, category` |
| `useStakeholderPreload` | contacts | `*` | `id, name, organization, coordinates, contact_type` |
| `useCaseFiles` | case_files | `*` | `id, title, status, case_number, created_at, updated_at` |
| `useContactDocuments` | documents | `*` | `id, title, file_path, file_name, tags, created_at` |
| `TaskArchiveView` | archived_tasks | `*` | `id, title, status, priority, archived_at, category` |
| `useCounts` | contacts (Archive) | `phone` | Bereits optimiert (nur `phone`) |
| `useDecisionComments` | task_decision_comments | `decision_id` | Bereits optimiert |

**Geschatztes Sparpotenzial**: 30-50% weniger Datentransfer pro Request

### 1.3 Count-Queries mit head:true optimieren (niedriger Aufwand)

**Problem**: `useDecisionComments` ladt alle Kommentar-Rows nur um sie zu zahlen.

**Massnahme**: Auf `select('decision_id', { count: 'exact', head: true })` umstellen oder eine gruppierte RPC-Funktion verwenden.

---

## Bereich 2: Realtime Egress (mittlere Prioritat)

### 2.1 Fehlende Filter auf Channels hinzufugen (hohe Wirkung)

**Problem**: Mehrere Channels haben KEINE `filter`-Klausel und empfangen dadurch Updates von ALLEN Nutzern/Mandanten:

| Channel | Tabelle | Filter fehlt |
|---|---|---|
| `shared-messages-realtime` | messages, message_recipients, message_confirmations | Kein Filter -- empfangt ALLE Nachrichten aller Nutzer |
| `tags-changes` | tags | Kein Filter -- empfangt alle Tag-Anderungen |
| `document-categories-changes` | document_categories | Kein Filter |
| `knowledge-documents-changes` | knowledge_documents | Kein Filter |
| `contacts_map_changes` | contacts | Nur `contact_type` Filter, kein `tenant_id` |
| `my-work-realtime` | task_decisions, task_decision_responses | Kein Filter -- empfangt ALLE Entscheidungen |

**Massnahme**: `tenant_id`- oder `user_id`-Filter auf alle Channels anwenden:

- `useMessagesRealtime`: Filter `author_id=eq.{userId}` oder besser: Dedicated RPC notification statt Breitband-Listener
- `useTags`: Selten geandert, akzeptabel ohne Filter (globale Tabelle)
- `useDocumentCategories`: Selten geandert, akzeptabel
- `KnowledgeBaseView`: `created_by=eq.{userId}` oder Event-Pattern verwenden
- `KarlsruheDistrictsMap`: `tenant_id=eq.{tenantId}` hinzufugen
- `MyWorkView` (task_decisions/responses): `user_id`-Filter hinzufugen oder auf Shared-Hook umstellen

### 2.2 Redundante Channels konsolidieren (mittlerer Aufwand)

**Problem**: `QuickNotesList` und `MyWorkView` horen beide auf `quick_notes` mit separaten Channels.

**Massnahme**: Das Singleton-Pattern von `useMessagesRealtime` auf weitere Tabellen ausdehnen:
- `useQuickNotesRealtime` -- shared hook fur quick_notes
- `useTasksRealtime` -- shared hook fur tasks + task_decisions

### 2.3 RealTimeSync-Component bereinigen (niedriger Aufwand)

**Problem**: `RealTimeSync.tsx` erstellt 2 separate Channels (`dashboard_presence` + `dashboard_changes`), wobei `dashboard_changes` auf `team_dashboards` hort mit einem fehlerhaften Filter (`user_id` statt `owner_id`).

**Massnahme**: Fehlerhaften Channel entfernen oder Filter korrigieren.

### 2.4 Debouncing standardisieren

**Problem**: Verschiedene Debounce-Zeiten (1s, 2s, kein Debounce) uber die Codebase verteilt.

**Massnahme**: Standard-Debounce von 1s fur alle Realtime-Handler einfuhren. `QuickNotesList` hat aktuell KEIN Debouncing.

---

## Bereich 3: Storage Egress (niedrigste Prioritat)

### 3.1 getPublicUrl statt download() fur offentliche Buckets (Sofortwirkung)

**Problem**: Einige Stellen verwenden `download()` fur Buckets die eigentlich public sind.

**Offentliche Buckets**: `avatars`, `dashboard-covers`, `letter-assets`
**Private Buckets**: `documents`, `task-documents`, `decision-attachments`, `planning-documents`, `parliament-protocols`, `archived-letters`

**Massnahme**: Fur die offentlichen Buckets `getPublicUrl` verwenden statt `download()` -- das erlaubt Browser-Caching und vermeidet Server-Egress. Betrifft hauptsachlich `LetterTemplateManager.tsx` wo `download()` fur `letter-assets` verwendet wird.

### 3.2 Vorschau-Bilder/Thumbnails cachen (mittlerer Aufwand)

**Problem**: Jedes Mal wenn ein Nutzer eine Dateivorschau offnet, wird die komplette Datei heruntergeladen.

**Massnahme**: 
- Einmal heruntergeladene Blobs im Speicher cachen (Map oder sessionStorage)
- Fur haufig angesehene Dateien (z.B. Logos, Header-Bilder) einen lokalen Cache-Layer implementieren

### 3.3 Externe Auslagerung (langfristig, hoher Aufwand)

**Option**: Dateien auf Cloudflare R2 oder BunnyCDN auslagern. Dies wurde erfordern:
- Edge Function als Proxy fur Uploads
- URL-Umschreibung in der gesamten Codebase
- **Empfehlung**: Nur sinnvoll wenn Storage-Egress tatsachlich ein Kostenfaktor ist. Aktuell sind die internen Optimierungen ausreichend.

---

## Priorisierte Umsetzungsreihenfolge

| Phase | Massnahme | Aufwand | Wirkung | Status |
|---|---|---|---|---|
| **Phase 1** | QueryClient staleTime/gcTime Defaults | 15 Min | Hoch -- sofort 40-60% weniger PostgREST-Requests | ✅ Erledigt |
| **Phase 2** | Realtime-Filter auf ungefilterte Channels | 30 Min | Hoch -- eliminiert Cross-Tenant Broadcasts | ✅ Erledigt |
| **Phase 3** | Top-10 select('*') durch Spaltenauswahl ersetzen | 45 Min | Mittel -- 30-50% weniger Datentransfer | ✅ Erledigt (useAllPersonContacts, useStakeholderPreload, useCaseFiles, useContactDocuments, TaskArchiveView, useDecisionComments) |
| **Phase 4** | QuickNotes Debouncing + Redundanz entfernen | 15 Min | Niedrig-Mittel | ✅ Erledigt |
| **Phase 5** | getPublicUrl fur letter-assets | 10 Min | Niedrig -- ermoglicht Browser-Caching | ✅ Erledigt |
| **Phase 6** | Blob-Cache fur Vorschaubilder | 30 Min | Niedrig | ⏳ Offen |

---

## Technische Details

### Phase 1 -- QueryClient Defaults

Datei: Dort wo `new QueryClient()` erstellt wird (vermutlich `src/App.tsx` oder `src/main.tsx`):

```text
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,    // 2 Minuten
      gcTime: 10 * 60 * 1000,       // 10 Minuten  
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

### Phase 2 -- Realtime-Filter

`useMessagesRealtime.tsx` -- Die `messages`-Tabelle hat kein `tenant_id`. Alternative: Auf die `message_recipients`-Tabelle mit `recipient_id=eq.{userId}` filtern und die `messages`-Subscription auf `author_id=eq.{userId}` einschranken. Da beides relevant ist (eigene und empfangene), werden zwei getrennte Filter-Events gebraucht oder das bestehende Debouncing reicht als Schutz.

`MyWorkView.tsx` -- `task_decisions` und `task_decision_responses` brauchen einen `user_id`-Filter.

### Phase 3 -- Spaltenauswahl

Jede Datei einzeln anpassen. Dabei beachten:
- Alle Stellen prufen die auf die Daten zugreifen (TypeScript hilft hier)
- Nur die tatsachlich gerenderten/genutzten Felder in `select()` aufnehmen

