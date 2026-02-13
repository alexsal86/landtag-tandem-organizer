
# Plan: 12 Verbesserungen -- Entscheidungen, Briefvorlagen, Push und Navigation

## 1. Browser-Push reparieren

**Analyse:** Der Trigger funktioniert korrekt. Die `pg_net`-Logs zeigen, dass die Edge Function bei der Entscheidung "sdfsdfsdsdfsdf" (Notification um 20:39:52) aufgerufen wurde. Die Antwort war: `"No active push subscriptions found for user ff0e6d83-..."`. Zu diesem Zeitpunkt war die Subscription des Users inaktiv (alle alten Subscriptions haben `is_active: false`). Erst um 20:54:10 wurde eine neue Subscription erstellt.

**Problem:** Der Auto-Sync-Mechanismus (`pushSubscriptionAutoSync`) erneuert die Subscription nicht zuverlaessig. Der Endpoint laeuft ab, aber der Check erkennt das nicht.

**Loesung:**
- Im Auto-Sync beim App-Start die bestehende Subscription gegen den aktuellen Service-Worker-Endpoint vergleichen. Wenn der Endpoint in der DB nicht mit dem aktuellen Browser-Endpoint uebereinstimmt, neu registrieren.
- Beim Senden: Wenn Status 410/404 zurueckkommt, sofort die alte Subscription deaktivieren (bereits implementiert). Zusaetzlich: beim naechsten App-Start automatisch neu subscriben.
- Edge Function: Logging verbessern fuer bessere Fehlersuche.

**Dateien:** `src/hooks/usePushNotifications.ts` oder aehnlicher Hook fuer Auto-Sync

## 2. Doppelte "Vorschau" im Entscheidungs-Creator entfernen

**Problem:** Im Creator steht "Vorschau" als Label UND die `ResponseOptionsPreview`-Komponente zeigt intern nochmal "Vorschau:" an (Zeile 32 in `ResponseOptionsPreview.tsx`).

**Loesung:** Das interne "Vorschau:"-Label in `ResponseOptionsPreview.tsx` entfernen (Zeile 32).

**Dateien:** `src/components/task-decisions/ResponseOptionsPreview.tsx` (Zeile 32 entfernen)

## 3. Eigene-Optionen-Eingabefeld ueberlaeuft Container

**Problem:** Der `ResponseOptionsEditor` hat Eingabefelder die zu breit sind und den Container sprengen.

**Loesung:** Im `ResponseOptionsEditor` `overflow-hidden` und `max-w-full` auf den Container setzen. Die Eingabefelder bekommen `w-full` statt fester Breiten.

**Dateien:** `src/components/task-decisions/ResponseOptionsEditor.tsx`

## 4. Titel in "Meine Arbeit" Cards ueber zwei Zeilen + Beschreibung sichtbar

**Problem:** In `MyWorkDecisionCard.tsx` (Zeile 196-205) hat der Titel-Container `max-h-[4.5rem] overflow-hidden` und der Titel wechselt on hover von `line-clamp-1` zu `line-clamp-2`. Dadurch verschwindet die Beschreibung.

**Loesung:** `max-h-[4.5rem] overflow-hidden` entfernen. Titel immer `line-clamp-2` zeigen (nicht erst on hover). Gleiche Aenderung fuer `DecisionOverview.tsx` (Zeile 946-955), falls dort aehnliches Problem existiert.

**Dateien:**
- `src/components/my-work/decisions/MyWorkDecisionCard.tsx` (Zeilen 196-205)
- `src/components/task-decisions/DecisionOverview.tsx` (Zeile 946-955, falls betroffen)

## 5. Sidebar-Text groesser + Antwort-Button in MyWorkDecisionSidebar

**Problem:** In `MyWorkDecisionSidebar.tsx` sind Schriftgroessen `text-[9px]`, `text-[10px]`, `text-[7px]` -- kaum lesbar. Titel mit `truncate` werden abgeschnitten.

**Loesung:**
- Alle `text-[9px]` auf `text-xs` (12px) aendern
- Alle `text-[10px]` auf `text-xs` aendern
- Alle `text-[7px]` auf `text-[8px]` oder `text-xs` aendern
- `truncate` bei Titeln auf `line-clamp-2` aendern
- Antwort-Buttons bei "Begruendungen" hinzufuegen (wie bei Rueckfragen -- bereits in `DecisionSidebar.tsx` implementiert, fehlt aber in `MyWorkDecisionSidebar.tsx`)

**Dateien:** `src/components/my-work/decisions/MyWorkDecisionSidebar.tsx`

## 6. Entscheidungszaehler: Optionen statt Zahlen anzeigen

**Problem:** Der Zaehler unten rechts zeigt immer `yesCount / questionCount / noCount` als Zahlen. Bei benutzerdefinierten Templates (Option A/B/C, Bewertung 1-5) waere es besser, die Option-Labels mit Farben und Tooltips anzuzeigen.

**Aktueller Stand:** In `MyWorkDecisionCard.tsx` (Zeilen 300-326) wird bereits `customSummary` mit Labels und Farben gerendert! In `DecisionOverview.tsx` (Zeilen 1027-1038) fehlt das aber -- dort werden immer nur die Standard-Zaehler angezeigt.

**Loesung:** Die `customSummary`-Logik aus `MyWorkDecisionCard` auch in `DecisionOverview.tsx` einbauen. Bei Kenntnisnahme: Ein Badge "Kenntnisnahme" in Gruen/Rot anzeigen (statt Zahlen).

**Dateien:** `src/components/task-decisions/DecisionOverview.tsx` (Zeilen 1025-1040)

## 7. Brief-Anlaesse: Endlosschleife endgueltig beheben

**Problem:** Die `seedDefaults()`-Funktion ruft am Ende `loadOccasions()` auf (Zeile 144). `loadOccasions()` prueft ob die Tabelle leer ist und ruft `seedDefaults()` erneut auf. Der Guard `seedingRef` verhindert nur den zweiten Aufruf, aber wenn die Inserts durch RLS-Policies fehlschlagen, bleibt die Tabelle leer und die Seite haengt im Ladezustand.

**Loesung:**
- `seedDefaults()` darf NICHT `loadOccasions()` aufrufen -- stattdessen die Daten direkt nach dem Insert setzen
- RLS-Pruefen: Sicherstellen, dass INSERT-Policy fuer die aktuelle Rolle existiert
- Guard verbessern: Nach `seedDefaults()` setze `loading = false` direkt und setze die eingefuegten Daten als State
- Fehlerbehandlung: Bei Insert-Fehlern Toast anzeigen und trotzdem `loading = false` setzen

**Dateien:** `src/components/administration/LetterOccasionManager.tsx`

## 8. "Absenderinformationen" und "Informationsbloeecke" Cards auf Hauptseite entfernen

**Problem:** In `LetterTemplateManager.tsx` gibt es auf der Hauptansicht (nicht in den Tabs) separate Cards fuer "Absenderinformationen" und "Informationsbloeecke". Diese sind bereits in den Tabs integriert (Tab "Ruecksende" hat SenderInformationManager, Tab "Info-Block" hat InformationBlockManager).

**Loesung:** Die standalone-Cards auf der Hauptseite identifizieren und entfernen. Aktuell sehe ich in der Datei keine separaten Cards ausserhalb der Tabs -- das Problem koennte in einer uebergeordneten Administrations-Seite liegen.

**Dateien:** `src/pages/Administration.tsx` -- pruefen, ob dort die Cards direkt gerendert werden

## 9. Header-Tab: Bild-Upload und -Galerie mit Blob-URLs

**Aktueller Stand:** Der Header-Editor hat bereits einen "Bild hinzufuegen"-Button und eine Elemente-Liste in der Sidebar. Allerdings fehlt eine richtige Bild-Galerie (hochgeladene Bilder als Thumbnails, Drag-and-Drop auf Canvas). Die aktuelle Bild-Sektion zeigt nur die vorhandenen Elemente, nicht eine Galerie der verfuegbaren Bilder.

**Loesung:**
- Separate Bild-Galerie hinzufuegen: Lade alle Bilder aus dem Storage-Bucket (`letter-assets/{tenant_id}/header-images/`) mit Blob-URLs
- Bilder als Thumbnail-Grid anzeigen
- Drag-and-Drop von der Galerie auf den Canvas
- Loeschen-Button pro Galerie-Bild

**Dateien:** `src/components/letters/StructuredHeaderEditor.tsx`

## 10. Header-Tab: Bloecke-Management wiederherstellen

**Aktueller Stand:** Das `HeaderBlock`-Interface existiert (Zeilen 33-49), wird aber in der UI nicht genutzt. Die Sidebar hat nur "Text-Block ziehen" und "Bild hinzufuegen".

**Loesung:**
- Neuen Abschnitt "Bloecke" in der Sidebar ergaenzen
- Block erstellen: Titel, Inhalt, Breite, Schrift, Farbe
- Bloecke als gruppierte Elemente auf dem Canvas rendern
- Orientierung am Footer-Editor (`StructuredFooterEditor.tsx`), der Bloecke bereits implementiert

**Dateien:** `src/components/letters/StructuredHeaderEditor.tsx`

## 11. Canvas-Designer: Elemente benennen, umbenennen, Farbe zuordnen, neue hinzufuegen, loeschen

**Aktueller Stand:** In `LetterLayoutCanvasDesigner.tsx` sind die 8 Bloecke fest definiert (`BLOCKS`-Array, Zeile 36-45). Man kann sie ein-/ausschalten, aber nicht umbenennen oder neue hinzufuegen.

**Loesung:**
- Die BLOCKS von einer Konstante zu einem State machen, der in den `layoutSettings` persistiert wird
- Umbenennen: Klick auf den Block-Namen in der Sidebar oeffnet ein Eingabefeld
- Farbe aendern: Farb-Picker oder Farbauswahl-Dropdown pro Block
- Neue Elemente hinzufuegen: "+ Element"-Button, der einen neuen Block mit Standard-Position erstellt
- Loeschen: Bestehende Bloecke koennen entfernt werden (mit Bestaetigung)
- Die Default-Bloecke bleiben als Startpunkt erhalten

**Dateien:** `src/components/letters/LetterLayoutCanvasDesigner.tsx`

## 12. Navigations-Badges verschwinden nicht nach Seitenbesuch

**Problem:** `markNavigationAsVisited` setzt den Count fuer einen spezifischen Kontext auf 0, aber die uebergeordneten Gruppen-Badges summieren die SubItem-Counts. Wenn ein Realtime-Event kommt, ueberschreibt `loadNavigationCounts()` den State wieder, trotz `suppressReloadUntil`.

**Moegliche Ursachen:**
1. `markNavigationAsVisited` wird mit dem falschen `context`-String aufgerufen
2. Die 2-Sekunden-Suppression ist zu kurz
3. "Alle als gelesen markieren" loest kein `setNavigationCounts` Update aus

**Loesung:**
- `suppressReloadUntil` auf 5 Sekunden erhoehen
- Nach "Alle als gelesen markieren": `setNavigationCounts({})` direkt aufrufen (alle Counts auf 0)
- Pruefen, ob der NotificationContext die Badge-Counts korrekt synchronisiert

**Dateien:** `src/hooks/useNavigationNotifications.tsx`, `src/contexts/NotificationContext.tsx`

---

## Build-Fehler beheben

Der aktuelle Build-Fehler betrifft die Edge-Function (Deno/Supabase):
```
Could not find a matching package for 'npm:@supabase/realtime-js@2.95.3'
```
Dies ist ein Deno-Kompatibilitaetsproblem mit der `@supabase/supabase-js`-Version in der Edge Function. Die Edge Function importiert von `esm.sh` und loeist eine Version auf, die `realtime-js` als npm-Dependency braucht.

**Loesung:** Die Supabase-Client-Import-URL in der Edge Function pinnen:
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
```

**Dateien:** `supabase/functions/send-push-notification/index.ts`

---

## Zusammenfassung

| Nr. | Thema | Aufwand | Hauptdateien |
|-----|-------|---------|--------------|
| Build | Edge Function Build-Fehler | Gering | send-push-notification/index.ts |
| 1 | Push-Subscription Auto-Sync | Mittel | usePushNotifications |
| 2 | Doppelte "Vorschau" | Gering | ResponseOptionsPreview |
| 3 | Optionen-Feld Overflow | Gering | ResponseOptionsEditor |
| 4 | Titel 2 Zeilen + Description | Gering | MyWorkDecisionCard, DecisionOverview |
| 5 | Sidebar Text groesser | Gering | MyWorkDecisionSidebar |
| 6 | Optionen statt Zahlen | Mittel | DecisionOverview |
| 7 | Brief-Anlaesse Loop | Gering | LetterOccasionManager |
| 8 | Cards auf Hauptseite entfernen | Gering | Administration / LetterTemplateManager |
| 9 | Header Bild-Galerie | Mittel | StructuredHeaderEditor |
| 10 | Header Bloecke | Mittel | StructuredHeaderEditor |
| 11 | Canvas-Designer Elemente | Hoch | LetterLayoutCanvasDesigner |
| 12 | Navigation Badges Sync | Gering | useNavigationNotifications |
