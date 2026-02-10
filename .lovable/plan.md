

# Plan: FallAkten-Detailansicht -- 13 Verbesserungen

## 1. Zustaendige Person in der Uebersichts-Card anzeigen

In `CaseFileCard.tsx` den `assigned_to`-Wert auslesen und den Namen des zugewiesenen Benutzers anzeigen. Da die Card keinen Join auf Profiles hat, wird ein kleiner Hook oder eine Inline-Abfrage benoetigt. Pragmatischer Ansatz: Im `useCaseFiles`-Hook das `assigned_to` als UUID belassen und in der Card-Komponente ueber einen kleinen Avatar+Name-Bereich anzeigen. Dafuer wird ein neuer lightweight Hook `useUserDisplay(userId)` erstellt, der gecached den Display-Namen und Avatar laedt.

**Dateien:** `CaseFileCard.tsx`, neuer Hook `useUserDisplay.tsx`

---

## 2. Abstand zur Navigation und zum rechten Seitenrand korrigieren

In `CaseFilesView.tsx` hat der Container bereits `p-6`, aber wenn die Detailansicht angezeigt wird (Zeile 144-150), wird `CaseFileDetail` direkt returned -- innerhalb desselben `p-6`-Containers. Das Problem: Beim Return der Detailansicht (Zeile 144-150) fehlt das `p-6`, weil der fruehe Return VOR dem `div` mit `p-6` passiert.

**Loesung:** Den fruehen Return fuer die Detailansicht ebenfalls in ein `div` mit passendem Padding wrappen: `<div className="space-y-6 p-6">`.

**Datei:** `CaseFilesView.tsx`

---

## 3. Card "Zustaendig" an erste Stelle in der linken Sidebar

In `CaseFileLeftSidebar.tsx` die Reihenfolge der Cards aendern: "Zustaendig" (derzeit 3. Position, Zeile 169-184) nach ganz oben verschieben, vor "Personen".

**Datei:** `CaseFileLeftSidebar.tsx`

---

## 4. Beteiligte korrekt nach Personen und Institutionen aufteilen

Die Logik in `CaseFileLeftSidebar.tsx` (Zeile 63-68) filtert bereits nach `contact_type`, aber das `contact`-Objekt im Interface hat bereits `contact_type`. Die Filterlogik sieht korrekt aus. Problem: Im `useCaseFileDetails`-Hook wird `contact_type` moeglicherweise nicht mit-abgefragt. Pruefen und sicherstellen, dass der `contacts`-Select auch `contact_type` enthaelt. 

Im Interface (Zeile 14-24 von `useCaseFileDetails.tsx`) ist `contact_type: string | null` bereits vorhanden. Der Select-Query muss gepreuft werden, ob `contact_type` im Join enthalten ist.

**Datei:** `useCaseFileDetails.tsx` (Query pruefen), `CaseFileLeftSidebar.tsx` (Institutions-Card immer anzeigen, nicht nur wenn > 0)

---

## 5. Metadaten: "Erstellt" unter "Aktualisiert"

In `CaseFileLeftSidebar.tsx` die Reihenfolge umdrehen: Zuerst "Aktualisiert: xxx", dann darunter "Erstellt: xxx".

**Datei:** `CaseFileLeftSidebar.tsx` (Zeilen 238-245 tauschen)

---

## 6. Suchfeld neben die Buttonleiste in der Chronologie

In `CaseFileUnifiedTimeline.tsx` das Suchfeld (Zeile 194-203) in dieselbe Zeile wie die Tabs (Zeile 184-192) verschieben. Layout: Tabs links, Suchfeld rechts -- in einer `flex`-Row mit `items-center gap-2`.

**Datei:** `CaseFileUnifiedTimeline.tsx`

---

## 7. Chronologie-Punkte neu layouten: Icon + Titel, darunter Beschreibung, darunter Datum (Uhrzeit im Tooltip)

Aktuell (Zeile 234-249): Icon + Datum in einer Zeile, Titel darunter, Beschreibung darunter.

Neues Layout:
- Zeile 1: Icon + Titel (font-medium)
- Zeile 2 (eingerueckt auf Titelhoehe): Beschreibung (text-xs, muted)
- Zeile 3 (eingerueckt): Datum ohne Uhrzeit, Uhrzeit nur im Tooltip

Verwendung von `Tooltip` aus `@radix-ui/react-tooltip` fuer die Uhrzeit.

**Datei:** `CaseFileUnifiedTimeline.tsx`

---

## 8. Aktueller Stand: Rich-Text-Editor statt Textarea

In `CaseFileCurrentStatus.tsx` das `Textarea` (Zeile 160-166) durch `SimpleRichTextEditor` ersetzen. Die Anzeige des gespeicherten Inhalts muss dann `dangerouslySetInnerHTML` oder `RichTextDisplay` verwenden.

**Datei:** `CaseFileCurrentStatus.tsx`

---

## 9. Status- und Prioritaets-Badges aus dem Header entfernen

In `CaseFileDetailHeader.tsx` die Badges fuer Status und Prioritaet (Zeile 119-141) entfernen. Nur das Processing-Status-Badge und die Quick-Action-Buttons bleiben.

**Datei:** `CaseFileDetailHeader.tsx`

---

## 10. Dokument-Link zum Oeffnen hinzufuegen

In der Chronologie (`CaseFileUnifiedTimeline.tsx`) und/oder im Dokument-Dialog: Beim Klick auf ein Dokument-Item soll das Dokument geoeffnet werden. Das `CaseFileDocument`-Interface hat bereits `document.id` und `document.file_name`. Ein Link oder Button zum Download/Oeffnen wird hinzugefuegt.

Loesung: Dokument-Titel in der Timeline als klickbaren Link rendern, der die Datei aus dem Storage-Bucket oeffnet. Dafuer muss die `file_path` im Document-Interface ergaenzt werden (oder aus der `documents`-Tabelle geladen werden).

**Dateien:** `CaseFileUnifiedTimeline.tsx`, `useCaseFileDetails.tsx` (file_path im document-Select ergaenzen)

---

## 11. Beschreibungsfeld fuer Aufgaben in der FallAkte

In `CaseFileNextSteps.tsx` soll neben dem Aufgabentitel auch eine kurze Beschreibung angezeigt werden koennen. Das `task`-Interface im Hook hat derzeit kein `description`-Feld. Dieses wird im Select-Query ergaenzt und in der UI angezeigt.

**Dateien:** `useCaseFileDetails.tsx` (description im task-Select), `CaseFileNextSteps.tsx` (Beschreibung anzeigen), Interface `CaseFileTask` erweitern

---

## 12. Tooltip bei Hover ueber Chronologie-Icons: Wer hat wann hinzugefuegt

Die Timeline-Items brauchen Informationen ueber den Ersteller. Fuer Notes, Documents, Tasks etc. gibt es `created_at`, aber keinen `user_id` / `created_by`. 

Pragmatischer Ansatz: Fuer manuelle Timeline-Eintraege den `user_id` aus der Tabelle laden. Fuer die anderen Items (Notes, Documents etc.) den Ersteller aus den jeweiligen Tabellen laden (falls dort ein `user_id` vorhanden ist).

Die Timeline-Items werden um ein `created_by_name`-Feld erweitert. Beim Hover ueber das Dot-Icon wird ein Tooltip mit "Hinzugefuegt von [Name] am [Datum]" angezeigt.

**Dateien:** `CaseFileUnifiedTimeline.tsx` (Tooltip), `useCaseFileDetails.tsx` (user info mit-laden), Interface erweitern

---

## 13. Notiz hinzufuegen mit Rich-Text-Editor

In `CaseFileNotesTab.tsx` das `Textarea` fuer neue Notizen und zum Bearbeiten durch `SimpleRichTextEditor` ersetzen. Die Anzeige der Notiz-Inhalte mit `RichTextDisplay` oder `dangerouslySetInnerHTML`.

**Datei:** `CaseFileNotesTab.tsx`

---

## Technische Zusammenfassung

| Datei | Aenderungen |
|-------|-------------|
| `CaseFileCard.tsx` | Zustaendige Person mit Name/Avatar anzeigen |
| `useUserDisplay.tsx` (neu) | Kleiner Hook zum Laden von User-Display-Infos |
| `CaseFilesView.tsx` | Padding fuer Detailansicht fixen |
| `CaseFileLeftSidebar.tsx` | "Zustaendig" nach oben, Metadaten-Reihenfolge, Institutionen immer zeigen |
| `CaseFileUnifiedTimeline.tsx` | Suchfeld neben Tabs, neues Item-Layout, Dokument-Links, Tooltip fuer Ersteller |
| `CaseFileCurrentStatus.tsx` | SimpleRichTextEditor statt Textarea |
| `CaseFileDetailHeader.tsx` | Status/Prioritaet-Badges entfernen |
| `CaseFileNextSteps.tsx` | Beschreibung bei Aufgaben anzeigen |
| `CaseFileNotesTab.tsx` | SimpleRichTextEditor fuer Notizen |
| `useCaseFileDetails.tsx` | file_path + description im Select, user-info fuer Timeline |

