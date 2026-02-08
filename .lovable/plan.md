

# Analyse und Plan: Lexical-Editor Optimierung

## Aktueller Zustand -- Zusammenfassung der Probleme

### 1. Lexical-Version ist veraltet
- **Installiert**: v0.35.0
- **Aktuell verfuegbar**: v0.40.0 (veroeffentlicht am 01.02.2026)
- **Delta**: 5 Minor-Versionen mit mehreren Breaking Changes, Bug-Fixes und Performance-Verbesserungen
- Betrifft: `lexical`, `@lexical/react`, `@lexical/rich-text`, `@lexical/table`, `@lexical/list`, `@lexical/link`, `@lexical/code`, `@lexical/html`, `@lexical/mark`, `@lexical/yjs` (installiert aber nicht verwendet!)

### 2. Die Kollaboration ist eine Eigenentwicklung -- und kaputt
Lexical bietet ein **offizielles** Collaboration-Plugin (`@lexical/react/LexicalCollaborationPlugin`), das direkt mit Yjs integriert. Dieses wird **nicht verwendet**. Stattdessen gibt es eine komplexe Eigenentwicklung mit drei verschiedenen Ansaetzen, die nebeneinander existieren:

| Komponente | Ansatz | Probleme |
|------------|--------|----------|
| `LexicalYjsCollaborationPlugin.tsx` | Serialisiert den gesamten Lexical EditorState als JSON-String in ein `Y.Text`-Feld | Zerstoert die CRDT-Vorteile von Yjs komplett -- bei gleichzeitiger Bearbeitung ueberschreibt der letzte Schreiber alles |
| `ManualYjsCollaborationPlugin.tsx` | Gleicher Ansatz, aber mit `observeDeep` | Selbes Problem, leicht andere Race-Condition-Behandlung |
| `CollaborationPlugin` (in EnhancedLexicalEditor) | Supabase Realtime Broadcast fuer Content-Updates | Funktioniert nur als "Last-Write-Wins" -- keine echte Merge-Logik |
| `YjsProvider.tsx` | Eigener `SupabaseYjsProvider` mit Supabase Broadcast als Transport | Funktioniert technisch, aber die Yjs-Nutzung ist falsch (ganzer State statt Diff) |

**Das Kernproblem**: Der gesamte EditorState wird als JSON-String serialisiert und bei jeder Aenderung komplett in `Y.Text` geschrieben. Y.Text ist fuer zeichenweises Merge konzipiert -- nicht fuer den Austausch ganzer JSON-Objekte. Das fuehrt zu:
- Textverlust bei gleichzeitiger Bearbeitung
- "Content-Corruption" (mehrere JSON-Objekte verketten sich)
- Die `contentValidation.ts`-Utility existiert nur, um diese Corruption aufzufangen
- Race Conditions trotz Debouncing

### 3. Plugins sind Platzhalter-Implementierungen
Mehrere "Enhanced"-Plugins sind nur Stubs:

| Plugin | Problem |
|--------|---------|
| `ImagePlugin` | Fuegt Bilder als Markdown-Text ein (`![alt](url)`) statt als echten Image-Node |
| `CheckListPlugin` | Fuegt Unicode-Zeichen ein (`☐ `) statt echte CheckListItem-Nodes zu nutzen |
| `FileAttachmentPlugin` | Fuegt Dateien als Text-Link ein (`📎 [name](url)`) statt als Custom Node |
| `CollaborationDashboard` | Zeigt nur Hardcoded Mock-Daten im Activity-Feed |
| `AdvancedCursorPlugin` | Verwendet Pixel-Positionen fuer Cursor-Anzeige -- fragil und ungenau |
| `CommentPlugin` | Funktioniert grundsaetzlich, aber `CommentMarkNode` hat Serialisierungs-Probleme |

### 4. Doppelte Toolbar-Implementierungen
Es gibt **drei** Toolbar-Varianten:
- `ToolbarPlugin` (inline in `EnhancedLexicalEditor.tsx`, ~120 Zeilen, Unicode-Icons)
- `EnhancedLexicalToolbar` (separate Datei, ~420 Zeilen, Lucide-Icons)
- `FloatingTextFormatToolbar` (Schwebendes Format-Menue bei Textauswahl)

Die `ToolbarPlugin`-Variante wird bei Nicht-Yjs-Nutzung angezeigt, obwohl sie identische Features bietet wie `EnhancedLexicalToolbar`. Beide haben zudem fehlerhafte Heading-Formatierung (nested Paragraphs in Headings).

### 5. Presse-Editor hat keine Kollaboration
`PressReleaseEditor` verwendet `EnhancedLexicalEditor` ohne `enableCollaboration` oder `documentId`. Das ist vermutlich gewollt fuer den Moment, aber sobald mehrere Mitarbeiter gleichzeitig an einer Pressemitteilung arbeiten, fehlt die Funktion.

---

## Empfehlung: Editor zuerst perfektionieren, dann Kollaboration

**Klare Empfehlung: Zuerst den Editor stabil und perfekt machen, dann Kollaboration hinzufuegen.**

Gruende:
1. Die aktuelle Kollaboration ist grundsaetzlich fehlerhaft konzipiert -- sie kann nicht "repariert" werden, sie muss neu gebaut werden
2. Lexical bietet mit `@lexical/yjs` ein **offizielles** Collaboration-Plugin, das richtig funktioniert
3. Ein Update auf v0.40 kann Breaking Changes in der Eigenentwicklung verursachen -- weniger Code = weniger Migrationsprobleme
4. Die Eigenentwicklung (LexicalYjsCollaborationPlugin, ManualYjsCollaborationPlugin, SupabaseYjsProvider) kann komplett entfernt werden

---

## Umsetzungsplan: 3 Phasen

### Phase 1: Lexical auf v0.40 updaten und aufräumen

**Schritt 1.1: Pakete aktualisieren**
Alle Lexical-Pakete auf v0.40.0 aktualisieren:
- `lexical`
- `@lexical/react`
- `@lexical/rich-text`, `@lexical/table`, `@lexical/list`, `@lexical/link`, `@lexical/code`
- `@lexical/html`, `@lexical/mark`, `@lexical/hashtag`
- `@lexical/yjs` (wird fuer Phase 3 benoetigt)

**Schritt 1.2: Breaking Changes behandeln**
Bekannte Breaking Changes v0.35 -> v0.40:
- `$createTableCellNode` Signatur: `headerState` ist jetzt `number` (war schon so, aber Defaults haben sich geaendert)
- JSON-Serialisierung: `textFormat` und `textStyle` bei ElementNode werden nur noch bei Bedarf serialisiert
- `mergeRegister` und andere Utilities sind von `@lexical/utils` nach `lexical` verschoben (beide Orte funktionieren weiterhin)
- `$config` als neuer Mechanismus fuer Node-Konfiguration

**Schritt 1.3: Kollaborations-Code entfernen**
Folgende Dateien und Code-Abschnitte werden **entfernt** (werden in Phase 3 durch die offizielle Loesung ersetzt):
- `src/components/collaboration/LexicalYjsCollaborationPlugin.tsx`
- `src/components/collaboration/ManualYjsCollaborationPlugin.tsx`
- `src/components/collaboration/YjsProvider.tsx`
- `src/components/collaboration/YjsSyncStatus.tsx`
- `src/components/collaboration/CollaborationDashboard.tsx`
- `src/components/plugins/AdvancedCursorPlugin.tsx`
- `src/hooks/useCollaboration.tsx`
- `src/components/CollaborationStatus.tsx`
- `src/components/CollaborationTest.tsx`
- `src/utils/contentValidation.ts`

In `EnhancedLexicalEditor.tsx` und `SimpleLexicalEditor.tsx` werden alle Kollaborations-Abschnitte entfernt. Die Editoren werden zu sauberen Single-User-Editoren vereinfacht.

**Schritt 1.4: Toolbar konsolidieren**
- Die inline `ToolbarPlugin` aus `EnhancedLexicalEditor.tsx` entfernen
- Nur `EnhancedLexicalToolbar` verwenden (ueberall)
- `FloatingTextFormatToolbar` beibehalten (ist nuetzlich)
- Heading-Formatierung korrigieren (keine verschachtelten Paragraphs)

### Phase 2: Editor-Qualitaet verbessern

**Schritt 2.1: Echte Image-Nodes**
`ImagePlugin` umbauen, damit Bilder als Custom `ImageNode` (extends `DecoratorNode`) eingefuegt werden -- mit Resize, Alt-Text und korrekter Serialisierung.

**Schritt 2.2: Echte CheckList-Nodes**
`CheckListPlugin` auf Lexicals eingebaute CheckList-Unterstuetzung umstellen (`ListNode` mit `__listType = 'check'`).

**Schritt 2.3: Datei-Attachments verbessern**
`FileAttachmentPlugin` auf einen Custom `FileAttachmentNode` umstellen, der als dekorierter Block mit Download-Button gerendert wird.

**Schritt 2.4: ContentPlugin stabilisieren**
Den `ContentPlugin` in `EnhancedLexicalEditor.tsx` vereinfachen -- er soll nur beim **ersten Mount** den initialen Content laden, nicht bei jeder Prop-Aenderung (was zu Cursor-Spruengen fuehrt).

**Schritt 2.5: Testseiten aufraeumen**
- `EditorTestPage` aktualisieren fuer den neuen Editor
- `YjsCollaborationTestPage` entfernen (wird in Phase 3 neu gebaut)

### Phase 3: Kollaboration mit offiziellem @lexical/yjs (spaeterer Schritt)

Diese Phase wird als separates Projekt umgesetzt, nachdem der Editor stabil laeuft:

**Schritt 3.1: Offizielles CollaborationPlugin einbinden**
Lexical bietet ein fertiges Plugin:

```tsx
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin';

<CollaborationPlugin
  id={documentId}
  providerFactory={(id, yjsDocMap) => {
    const doc = new Y.Doc();
    yjsDocMap.set(id, doc);
    // Eigener SupabaseWebsocketProvider oder y-websocket
    return provider;
  }}
  shouldBootstrap={true}
/>
```

Dieses Plugin:
- Nutzt `Y.XmlFragment` (nicht `Y.Text`) fuer echtes strukturiertes Merge
- Handhabt Cursor-Awareness automatisch
- Unterstuetzt alle Node-Typen nativ
- Wird von Facebook/Meta aktiv gepflegt

**Schritt 3.2: Supabase als Transport**
Die bestehende `SupabaseYjsProvider`-Logik (Broadcast ueber Supabase Realtime) kann als Transport wiederverwendet werden, muss aber an die offizielle Provider-Schnittstelle angepasst werden.

**Schritt 3.3: Selektive Kollaboration**
Da nicht immer gleichzeitig bearbeitet wird, einen Toggle einbauen:
- Standard: Normaler Editor (schnell, kein Overhead)
- Bei Bedarf: "Gemeinsam bearbeiten" aktivieren -- laedt das CollaborationPlugin

---

## Auswirkungen auf bestehende Module

| Modul | Auswirkung |
|-------|-----------|
| **Briefe (LetterEditor)** | Editor wird einfacher und stabiler. Kollaboration faellt vorerst weg, kommt in Phase 3 zurueck |
| **Presse (PressReleaseEditor)** | Profitiert sofort von stabilerem Editor. Hat ohnehin keine Kollaboration |
| **Wissen (KnowledgeBaseView)** | Profitiert von stabilem Editor. Hatte keine Kollaboration |
| **E-Mails (EmailRichTextEditor)** | Nutzt eigenen einfachen Editor, nicht betroffen |
| **SimpleRichTextEditor** | Nutzt eigenen einfachen Editor, nicht betroffen |

---

## Zusammenfassung der Dateiaenderungen

| Aktion | Dateien |
|--------|---------|
| **Loeschen** | 10+ Dateien (Kollaboration, Tests, ContentValidation) |
| **Stark aendern** | `EnhancedLexicalEditor.tsx` (von 844 auf ca. 300 Zeilen), `SimpleLexicalEditor.tsx` (von 465 auf ca. 100 Zeilen) |
| **Anpassen** | `LetterEditor.tsx` (Kollaborations-Props entfernen), `PressReleaseEditor.tsx` (minimal), `KnowledgeBaseView.tsx` (minimal) |
| **Verbessern** | `ImagePlugin`, `CheckListPlugin`, `FileAttachmentPlugin`, `EnhancedLexicalToolbar` |
| **Aktualisieren** | `package.json` (alle Lexical-Pakete auf v0.40) |

## Vorgeschlagene Reihenfolge

Ich wuerde Phase 1 und Phase 2 zusammen umsetzen (ein grosser Schritt), da sie eng zusammenhaengen. Phase 3 (Kollaboration) kommt danach als separater Schritt.

