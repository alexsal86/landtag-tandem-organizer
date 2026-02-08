

# Plan: Erwaehnung (@Mention) mit offiziellem Lexical-Plugin

## Zusammenfassung

Die aktuelle `MentionsPlugin`-Implementation ist eine Eigenentwicklung, die Text manuell manipuliert statt echte Lexical-Nodes zu verwenden. Sie wird komplett ersetzt durch:

1. Einen echten `MentionNode` (basierend auf dem Playground-Pattern, erweitert um `userId` und `badgeColor`)
2. Ein neues `MentionsPlugin` basierend auf dem offiziellen `LexicalTypeaheadMenuPlugin`
3. Eine `onMentionsChange`-Callback-Schnittstelle am `EnhancedLexicalEditor`, damit Eltern-Komponenten (Briefe, Presse, Quick Notes, Aufgaben) bei Erwaehnung Benachrichtigungen erzeugen koennen

---

## Technische Details

### Schritt 1: MentionNode erstellen

**Neue Datei:** `src/components/nodes/MentionNode.ts`

Basierend auf dem offiziellen Playground `MentionNode` (extends `TextNode`), erweitert um:
- `userId: string` -- zum Identifizieren des erwaehnten Benutzers fuer Benachrichtigungen
- `badgeColor: string` -- fuer die farbliche Darstellung im Editor

```text
Serialisiertes Format:
{
  type: 'mention',
  mentionName: string,   // Display-Name
  userId: string,        // User-ID fuer Benachrichtigungen
  badgeColor: string,    // z.B. '#3b82f6'
  ...TextNode-Felder
}
```

Der Node rendert sich als `<span>` mit der badge_color des Benutzers als Hintergrund (abgedunkelt auf 20% Opazitaet). Er ist nicht editierbar (segmented mode), d.h. er wird als Einheit behandelt -- Loeschen entfernt die komplette Erwaehnung.

### Schritt 2: MentionsPlugin komplett neu schreiben

**Datei:** `src/components/plugins/MentionsPlugin.tsx` (komplett ersetzen)

Nutzt das offizielle `LexicalTypeaheadMenuPlugin` aus `@lexical/react/LexicalTypeaheadMenuPlugin`:
- `useBasicTypeaheadTriggerMatch('@', { minLength: 0 })` fuer die Trigger-Erkennung
- `MenuOption`-Klasse wird erweitert um `userId`, `displayName`, `avatarUrl`, `badgeColor`
- Benutzer werden aus der `profiles`-Tabelle geladen (gefiltert nach `tenant_id`)
- Badge-Color kommt aus `profiles.badge_color`, Fallback ueber `getHashedColor(userId)`
- Dropdown zeigt Avatar, Name und Farbpunkt fuer jeden Benutzer
- Bei Auswahl wird ein `MentionNode` mit userId und badgeColor eingefuegt
- Das Menu wird als React-Portal gerendert (wie im Playground)

**Neue Props:**
```tsx
interface MentionsPluginProps {
  onMentionInsert?: (userId: string, displayName: string) => void;
}
```

Der Callback `onMentionInsert` wird aufgerufen, wenn ein Benutzer erwaehnt wird. Die Eltern-Komponente kann dann entscheiden, ob/wann eine Benachrichtigung gesendet wird (typischerweise beim Speichern).

### Schritt 3: EnhancedLexicalEditor erweitern

**Datei:** `src/components/EnhancedLexicalEditor.tsx`

Aenderungen:
1. `MentionNode` in die `nodes`-Liste aufnehmen
2. Neue Props:
   - `onMentionInsert?: (userId: string, displayName: string) => void` -- wird an MentionsPlugin weitergereicht
3. Theme erweitern fuer `.mention`-Klasse (wird aber hauptsaechlich inline via createDOM gehandhabt)

### Schritt 4: Benachrichtigungen bei Speichern

**Dateien:** `PressReleaseEditor.tsx`, `LetterEditor.tsx`

Pattern:
- Beim Einfuegen einer Erwaehnung wird die userId in ein lokales Set `pendingMentions` gespeichert (via `onMentionInsert`)
- Beim Speichern des Dokuments werden fuer alle neuen Erwaehungen Benachrichtigungen via `create_notification` erzeugt
- Nach dem Senden werden die pending Mentions geleert

```tsx
// Beispiel: Benachrichtigung erzeugen
await supabase.rpc('create_notification', {
  user_id_param: mentionedUserId,
  type_name: 'document_mention',
  title_param: 'Erwaehnung in Dokument',
  message_param: `${currentUserName} hat Sie in "${documentTitle}" erwaehnt`,
  data_param: { documentId, documentType: 'press_release' | 'letter' }
});
```

### Schritt 5: Quick Notes und Aufgaben

Fuer Quick Notes (`SimpleRichTextEditor`) und Aufgaben-Beschreibungen, die den `SimpleRichTextEditor` nutzen:
- Der `SimpleRichTextEditor` ist ein minimaler Editor ohne MentionNode-Support
- Statt den `SimpleRichTextEditor` umzubauen, wird in den relevanten Stellen (Quick Notes, Aufgaben-Beschreibung) geprueft, ob `EnhancedLexicalEditor` besser passt oder ob ein leichtgewichtiger Ansatz gewuenscht ist
- Da die Aufgabe "in den Editor integrieren, den ich bei Quick Notes und Aufgaben nutze" lautet, wird der `SimpleRichTextEditor` um den `MentionNode` und ein vereinfachtes `MentionsPlugin` erweitert

### Schritt 6: CSS-Styles fuer Mention-Dropdown

Globales CSS fuer das Typeahead-Menu:
```css
.typeahead-popover {
  background: white;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  max-height: 200px;
  overflow-y: auto;
  z-index: 50;
}
.typeahead-popover .item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
}
.typeahead-popover .item.selected,
.typeahead-popover .item:hover {
  background: hsl(var(--accent));
}
```

---

## Betroffene Dateien

| Aktion | Datei |
|--------|-------|
| Neu | `src/components/nodes/MentionNode.ts` |
| Komplett ersetzen | `src/components/plugins/MentionsPlugin.tsx` |
| Bearbeiten | `src/components/EnhancedLexicalEditor.tsx` (MentionNode registrieren, Props erweitern) |
| Bearbeiten | `src/components/press/PressReleaseEditor.tsx` (onMentionInsert + Benachrichtigung bei Speichern) |
| Bearbeiten | `src/components/LetterEditor.tsx` (onMentionInsert + Benachrichtigung bei Speichern) |
| Bearbeiten | `src/components/ui/SimpleRichTextEditor.tsx` (MentionNode + MentionsPlugin hinzufuegen) |
| Bearbeiten | `src/index.css` (Typeahead-Styles hinzufuegen) |

---

## Reihenfolge

1. `MentionNode.ts` erstellen (Playground-basiert, erweitert um userId + badgeColor)
2. `MentionsPlugin.tsx` komplett neu schreiben (LexicalTypeaheadMenuPlugin)
3. `EnhancedLexicalEditor.tsx` aktualisieren (Node + Props)
4. CSS-Styles hinzufuegen
5. `PressReleaseEditor.tsx` + `LetterEditor.tsx` integrieren (Benachrichtigungen)
6. `SimpleRichTextEditor.tsx` erweitern (fuer Quick Notes / Aufgaben)
7. Testen

