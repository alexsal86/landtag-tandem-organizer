

# Plan: Bugfixes, Multi-Status FallAkten, Sicherheits-Sessions

## 1. Logo in Allgemeinen Einstellungen nicht angezeigt

**Analyse:** Die Daten in der DB sind korrekt (URL existiert mit tenant_id). Die Lade-Logik sieht korrekt aus. Das Problem ist wahrscheinlich, dass der SVG-File aus Supabase Storage ohne korrektes `crossOrigin`-Attribut geladen wird und der `onError`-Handler `logoLoadFailed` auf `true` setzt, wodurch das Bild verschwindet.

**Loesung:**
- `crossOrigin="anonymous"` zum `<img>`-Tag hinzufuegen (Zeile 257-265 in `GeneralSettings.tsx`)
- Einen zusaetzlichen Debug-Log im `onError` hinzufuegen, der die tatsaechliche URL anzeigt
- Sicherstellen, dass der `logoLoadFailed`-State beim initialen Laden korrekt zurueckgesetzt wird

**Datei:** `src/components/GeneralSettings.tsx`

---

## 2. Favicon ist nicht das Logo

**Analyse:** Der `useFavicon`-Hook wird in `AppNavigation.tsx` und `Navigation.tsx` mit `appSettings.app_logo_url` aufgerufen. Die `index.html` hat bereits ein Standard-Favicon-Tag (Zeile 28). Der Hook setzt dynamisch das Favicon. Das Problem: Wenn `app_logo_url` ein leerer String ist (z.B. weil die Settings noch laden), wird der Fallback `/src/assets/sunflower.svg` verwendet. Aber in der Production-Build ist `/src/assets/sunflower.svg` nicht unter diesem Pfad erreichbar.

**Loesung:**
- In `useFavicon.ts`: Den Fallback-Pfad korrigieren -- stattdessen `new URL('@/assets/sunflower.svg', import.meta.url).href` verwenden oder den Pfad als importiertes Asset referenzieren
- Alternativ: Das Sunflower-SVG als statischen Import verwenden und als Fallback nutzen
- Sicherstellen, dass der Hook nicht ueberschrieben wird, wenn `app_logo_url` leer ist waehrend des Ladens

**Datei:** `src/hooks/useFavicon.ts`

---

## 3. Entscheidungen unter Meine Arbeit -- Build-Fehler

**Problem:** `SidebarDiscussionComment` wird in `MyWorkDecisionsTab.tsx` (Zeile 373, 406) und `MyWorkDecisionSidebar.tsx` (Zeile 38) verwendet, aber nicht importiert. Ebenso fehlen `formatDistanceToNow` und `de` in `MyWorkDecisionSidebar.tsx` (Zeile 133).

**Loesung:**
- In `MyWorkDecisionsTab.tsx` (Zeile 22): `SidebarDiscussionComment` zum bestehenden Import hinzufuegen:
  ```
  import { MyWorkDecision, SidebarOpenQuestion, SidebarNewComment, SidebarDiscussionComment, getResponseSummary } from "./decisions/types";
  ```
- In `MyWorkDecisionSidebar.tsx`: Drei fehlende Imports hinzufuegen:
  ```
  import { SidebarDiscussionComment } from "./types";
  import { formatDistanceToNow } from "date-fns";
  import { de } from "date-fns/locale";
  ```

**Dateien:** `src/components/my-work/MyWorkDecisionsTab.tsx`, `src/components/my-work/decisions/MyWorkDecisionSidebar.tsx`

---

## 4. Mehrere Zustaende fuer FallAkten (Multi-Status)

**Analyse:** Aktuell speichert `case_files.processing_status` einen einzelnen Text-Wert. Die UI toggelt zwischen einem Status und null. Gewuenscht: Mehrere Statuse gleichzeitig (z.B. "Antwort ausstehend" + "Politisch sensibel").

**Loesung:**

### 4a. Datenbank-Migration
- Neue Spalte `processing_statuses text[] DEFAULT '{}'` zur Tabelle `case_files` hinzufuegen
- Bestehende Werte migrieren: `UPDATE case_files SET processing_statuses = ARRAY[processing_status] WHERE processing_status IS NOT NULL`

### 4b. CaseFileCurrentStatus.tsx anpassen
- `currentProcessingStatus` (string) ersetzen durch `currentProcessingStatuses` (string[])
- Toggle-Logik aendern: Klick fuegt Status zum Array hinzu oder entfernt ihn (statt Ersetzen)
- Callback-Signatur aendern: `onUpdateProcessingStatus?: (statuses: string[]) => Promise<boolean>`

### 4c. CaseFileCard.tsx und CaseFileDetailHeader.tsx
- Statt einem einzelnen Badge: alle aktiven Statuse als Badges anzeigen
- `processing_statuses` Array auslesen statt `processing_status`

### 4d. useCaseFileDetails.tsx
- `updateProcessingStatus` anpassen: `processing_statuses` Array an DB senden

### 4e. CaseFileRightSidebar.tsx
- Prop-Typ aktualisieren

**Dateien:**
- SQL-Migration
- `src/components/case-files/CaseFileCurrentStatus.tsx`
- `src/components/case-files/CaseFileCard.tsx`
- `src/components/case-files/CaseFileDetailHeader.tsx`
- `src/components/case-files/CaseFileRightSidebar.tsx`
- `src/hooks/useCaseFileDetails.tsx`

---

## 5. Sicherheit: Aktive Sitzungen und globales Logout

### 5a. Datenbank
Neue Tabelle `user_sessions`:
```text
id          uuid PK
user_id     uuid (FK auth.users, ON DELETE CASCADE)
device_info text (User-Agent)
ip_address  text
last_active_at timestamptz
created_at  timestamptz DEFAULT now()
is_current  boolean DEFAULT false
```
RLS: Benutzer sehen/loeschen nur eigene Sessions.

### 5b. Session-Tracking in useAuth.tsx
- Bei `SIGNED_IN`-Event: Eintrag in `user_sessions` erstellen mit `navigator.userAgent`
- Bei App-Start: `last_active_at` der aktuellen Session aktualisieren
- Bei `SIGNED_OUT`: Session-Eintrag loeschen

### 5c. Neue Komponente ActiveSessionsCard
- Zeigt alle aktiven Sessions: Geraet (aus User-Agent geparst), letzter Zugriff, aktuelle Session markiert
- Button "Von allen anderen Geraeten abmelden"
- Integration in die Profilseite (`EditProfile.tsx`)

### 5d. Edge-Function global-logout
- Empfaengt authentifizierte Anfrage
- Ruft `supabase.auth.admin.signOut(userId, 'global')` auf
- Loescht alle `user_sessions`-Eintraege des Benutzers (ausser aktuelle)

**Dateien:**
- SQL-Migration
- `src/hooks/useAuth.tsx`
- Neue Datei: `src/components/account/ActiveSessionsCard.tsx`
- `src/pages/EditProfile.tsx`
- Neue Datei: `supabase/functions/global-logout/index.ts`
- `supabase/config.toml`

---

## 6. Groesstes Potential der Plattform

Die Plattform hat in folgenden Bereichen das groesste Entwicklungspotential:

- **Workflow-Automatisierung**: Fristbasierte Erinnerungen, automatische Eskalation bei ueberfaelligen Vorgaengen, Status-Uebergaenge bei FallAkten
- **Analytik/Reporting**: Dashboards fuer Bearbeitungszeiten, Entscheidungs-Statistiken, RSVP-Auswertungen
- **KI-Integration**: Zusammenfassungen von Diskussionen, intelligente Kategorisierung, Entwuerfe fuer Antwortschreiben
- **Mobile/PWA**: Offline-Faehigkeit, Push-Benachrichtigungen fuer zeitkritische Vorgaenge
- **Echtzeit-Kollaboration**: Gemeinsames Bearbeiten von Dokumenten, Live-Updates in FallAkten

---

## Zusammenfassung und Reihenfolge

| # | Aufgabe | Dateien | Prioritaet |
|---|---------|---------|------------|
| 3 | Build-Fehler Entscheidungen (Imports) | `MyWorkDecisionsTab.tsx`, `MyWorkDecisionSidebar.tsx` | Kritisch |
| 1 | Logo-Anzeige in Einstellungen | `GeneralSettings.tsx` | Hoch |
| 2 | Favicon = Logo | `useFavicon.ts` | Hoch |
| 4 | Multi-Status FallAkten | SQL-Migration, 5 Komponenten, 1 Hook | Mittel |
| 5 | Aktive Sessions + globales Logout | SQL-Migration, `useAuth.tsx`, neue Komponente, Edge-Function | Mittel |

