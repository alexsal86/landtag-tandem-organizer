

# Plan: Entscheidungen-Tab unter Meine Arbeit redesignen

## Ziel

Den bestehenden `MyWorkDecisionsTab` von einer einfachen, flachen Liste zu einem kompakten Schnellzugriff umbauen, der die wichtigsten Elemente der vollstaendigen `DecisionOverview`-Seite adaptiert -- aber bewusst kompakter und auf schnelle Aktionen optimiert.

## Vergleich: Aktuell vs. Neu

### Aktuell (MyWorkDecisionsTab)
- Flache Liste aller Entscheidungen ohne Filter-Tabs
- Einfache Karten mit Icon, Titel, Badge, Datum
- Keine Abstimmungsmoeglichkeit direkt in der Karte
- Keine Sidebar fuer Rueckfragen/Kommentare
- Kein Suchfeld
- Kein Ersteller-Aktionsmenue (Archivieren, Bearbeiten)

### DecisionOverview (volle Seite)
- 6 Filter-Tabs: Fuer mich, Beantwortet, Von mir, Oeffentlich, Rueckfragen, Archiv
- Detaillierte Karten mit Status-Badges, Beschreibung, Ersteller-Avatar, AvatarStack, Abstimmungsstand
- Inline-Abstimmung (Ja/Nein/Rueckfrage) direkt in der Karte
- Rechte Sidebar mit offenen Rueckfragen und neuen Kommentaren
- Suche, Ersteller-Aktionen, Kommentar-Sheet
- Aufgabe aus Entscheidung erstellen

### Neues Design (kompakter Schnellzugriff)
Die besten Elemente beider Welten:

```text
+------------------------------------------------------------+
| [Suche...]                          [+ Neue Entscheidung]  |
+------------------------------------------------------------+
| [Fuer mich (3)] [Beantwortet] [Von mir] [Oeffentlich]      |
+------------------------------------------------------------+
|                                                             |
| Hauptbereich (75%)              | Sidebar (25%)            |
|                                 |                          |
| +--[orange]--------------------+| Offene Rueckfragen (2)   |
| | ! Rueckfrage offen           || +---------------------+  |
| | Titel der Entscheidung       || | Entscheidungstitel  |  |
| | Kurze Beschreibung...        || | von Max Mueller     |  |
| | Avatar Name | 07.02 | Stand  || | "Wie sollen wir..." |  |
| | [Ja] [Nein] [Rueckfrage]     || | [Antworten]         |  |
| +------------------------------+| +---------------------+  |
|                                 |                          |
| +--[grau]----- ----------------+| Neue Kommentare (1)     |
| | 2 ausstehend                 || +---------------------+  |
| | Titel der Entscheidung       || | Entscheidungstitel  |  |
| | Avatar Name | 05.02 | Stand  || | Anna -> Ja          |  |
| +------------------------------+| +---------------------+  |
|                                 |                          |
+------------------------------------------------------------+
```

## Konkrete Aenderungen

### 1. Filter-Tabs hinzufuegen (4 statt 6)

Kompaktere Auswahl als die volle Seite -- kein Archiv und keine separaten Rueckfragen (die sind in der Sidebar):

- **Fuer mich**: Offene Entscheidungen, auf die ich antworten muss (Badge mit Anzahl)
- **Beantwortet**: Entscheidungen, bei denen ich bereits abgestimmt habe
- **Von mir**: Entscheidungen, die ich erstellt habe
- **Oeffentlich**: Oeffentliche Entscheidungen anderer

### 2. Karten wie DecisionOverview, aber kompakter

Jede Karte erhaelt:
- **Header**: Status-Badge (farbig ausgefuellt: Orange/Gruen/Grau) -- wie in DecisionOverview
- **Titel**: Fett, `text-base` -- wie in DecisionOverview
- **Beschreibung**: Truncated, 1 Zeile
- **Footer**: Ersteller-Avatar + Name (fett), Datum, Sichtbarkeit, Abstimmungsstand (`Stand: 2/1/0`)
- **Inline-Abstimmung**: Wenn Teilnehmer und noch nicht geantwortet: `TaskDecisionResponse`-Buttons direkt in der Karte
- **Aktionsmenue**: Fuer eigene Entscheidungen: 3-Punkte-Menue mit Bearbeiten, Archivieren, Aufgabe erstellen

### 3. Kompakte Sidebar

Rechts neben den Karten eine schmale Sidebar (adaptiert von `DecisionSidebar`):
- Offene Rueckfragen: Klick oeffnet Details-Dialog
- Neue Kommentare: Klick oeffnet Details-Dialog
- Inline-Antwort-Moeglichkeit bei Rueckfragen
- Nur auf groesseren Bildschirmen sichtbar (`hidden lg:block`)

### 4. Daten-Laden erweitern

Die `loadDecisions`-Funktion muss erweitert werden, um dieselben Daten wie `DecisionOverview` zu laden:
- Teilnehmer mit Profilen und Antworten (fuer AvatarStack und Abstimmungsstand)
- Ersteller-Avatare
- Attachment-Count
- Topic-IDs

Die bestehende Lade-Logik wird angepasst, um aus den Participant-Daten auch die `getResponseSummary`-Werte zu berechnen (analog zu DecisionOverview).

### 5. Dialoge und Aktionen

Folgende Aktionen werden integriert (via bestehende Komponenten):
- `TaskDecisionDetails`: Oeffnet sich bei Klick auf eine Karte (bereits vorhanden)
- `TaskDecisionResponse`: Inline-Abstimmung in der Karte (neu)
- `DecisionEditDialog`: Bearbeitung via Aktionsmenue (neu)
- `StandaloneDecisionCreator`: Erstellen (bereits vorhanden)
- Archivieren/Loeschen (neu, Code aus DecisionOverview uebernommen)

## Technische Details

### Dateiaenderungen

| Datei | Aenderung |
|-------|-----------|
| **MyWorkDecisionsTab.tsx** | Kompletter Umbau: Tabs, erweiterte Karten, Sidebar, Inline-Abstimmung, Aktionsmenue |

### Wiederverwendete Komponenten (kein Code-Dopplung)

- `TaskDecisionResponse` -- Abstimmungsbuttons
- `TaskDecisionDetails` -- Detail-Dialog
- `DecisionEditDialog` -- Bearbeitungsdialog
- `StandaloneDecisionCreator` -- Erstellungsdialog
- `DecisionViewerComment` -- Viewer-Kommentar bei oeffentlichen
- `UserBadge` -- Ersteller-Anzeige
- `AvatarStack` -- Teilnehmer-Anzeige
- `TopicDisplay` -- Themen
- `RichTextDisplay` -- Beschreibung

### Neue Importe in MyWorkDecisionsTab

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { TaskDecisionResponse } from "@/components/task-decisions/TaskDecisionResponse";
import { DecisionEditDialog } from "@/components/task-decisions/DecisionEditDialog";
import { DecisionViewerComment } from "@/components/task-decisions/DecisionViewerComment";
import { TopicDisplay } from "@/components/topics/TopicSelector";
```

### Erweitertes Decision-Interface

```tsx
interface Decision {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  created_by: string;
  participant_id: string | null;
  hasResponded: boolean;
  isCreator: boolean;
  isParticipant: boolean;
  pendingCount: number;
  responseType?: string | null;
  isPublic?: boolean;
  visible_to_all?: boolean;
  attachmentCount?: number;
  topicIds?: string[];
  creator?: {
    user_id: string;
    display_name: string | null;
    badge_color: string | null;
    avatar_url: string | null;
  };
  participants?: Array<{
    id: string;
    user_id: string;
    profile?: {
      display_name: string | null;
      badge_color: string | null;
      avatar_url: string | null;
    };
    responses: Array<{
      id: string;
      response_type: 'yes' | 'no' | 'question';
      comment: string | null;
      creator_response: string | null;
      created_at: string;
    }>;
  }>;
}
```

### Sidebar-Daten (inline berechnet, keine separate Komponente)

Die Sidebar-Logik wird direkt im Tab berechnet (aehnlich wie `sidebarData` in DecisionOverview), aber kompakter gerendert -- keine separate `DecisionSidebar`-Komponente, sondern ein leichtgewichtiger Inline-Block, der nur die wesentlichen Informationen anzeigt.

### Layout-Struktur

```tsx
<div className="space-y-3">
  {/* Suchleiste + Erstellen-Button */}
  <div className="flex items-center gap-3">
    <Input ... />
    <StandaloneDecisionCreator ... />
  </div>

  {/* Tabs */}
  <Tabs value={activeTab} onValueChange={setActiveTab}>
    <TabsList className="grid w-full grid-cols-4 h-9">
      <TabsTrigger value="for-me">Fuer mich {count}</TabsTrigger>
      <TabsTrigger value="answered">Beantwortet ({count})</TabsTrigger>
      <TabsTrigger value="my-decisions">Von mir ({count})</TabsTrigger>
      <TabsTrigger value="public">Oeffentlich ({count})</TabsTrigger>
    </TabsList>

    <TabsContent value={activeTab} className="mt-3">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* Karten */}
        <ScrollArea>
          <div className="space-y-2">
            {filteredDecisions.map(renderCard)}
          </div>
        </ScrollArea>

        {/* Kompakte Sidebar */}
        <aside className="hidden lg:block space-y-3">
          {/* Offene Rueckfragen */}
          {/* Neue Kommentare */}
        </aside>
      </div>
    </TabsContent>
  </Tabs>
</div>
```

### Unterschiede zur DecisionOverview (bewusst kompakter)

| Feature | DecisionOverview | MyWork Tab |
|---------|-----------------|------------|
| Tabs | 6 (inkl. Rueckfragen, Archiv) | 4 (ohne Archiv/Rueckfragen) |
| Sidebar-Breite | 340px | 280px |
| Beschreibung | Expandierbar (mehr/weniger) | Nur 1 Zeile, truncated |
| Suche | Volle Breite | Kompakter |
| Ersteller-Aktionen | Umfangreiches Dropdown | Gleiches Dropdown, aber nur fuer eigene |
| Aufgabe erstellen | Ja (wenn alle geantwortet) | Ja (uebernommen) |
| Karten-Padding | p-4 | p-3 (kompakter) |
| Seitenheader | Grosser Titel + Untertitel | Kein separater Header (Tab-Kontext reicht) |

