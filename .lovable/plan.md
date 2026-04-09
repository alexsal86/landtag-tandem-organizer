

## Plan: Mention-Share vereinfachen & erweitern

### Ist-Zustand
- `MentionSharePromptDialog` existiert bereits mit Checkboxen pro User + Berechtigungs-Auswahl (view/edit)
- Funktioniert in `MyWorkQuickCapture` und `GlobalQuickNoteDialog`
- `CaseItemInteractionQuickCapture` (Anruf, E-Mail, Social) nutzt ein normales `Textarea` — dort sind keine @-Mentions möglich

### Änderungen

**1. `MentionSharePromptDialog.tsx` — Vereinfachen auf Ja/Nein**
- Checkboxen und Permission-Select entfernen
- Stattdessen: einfache Auflistung der erwähnten Personen als Text + zwei Buttons ("Freigeben" / "Nicht freigeben")
- Permission wird automatisch auf `"edit"` gesetzt
- Alle erwähnten User werden geteilt (kein An/Abwählen)

**2. `CaseItemInteractionQuickCapture.tsx` — Mention-Support hinzufügen**
- Das "Details"-Feld von `Textarea` auf `SimpleRichTextEditor` umstellen (unterstützt @-Mentions)
- Nach dem Speichern: `extractMentionedUserIds` auf `subject` + `details` anwenden
- Bei gefundenen Mentions: `MentionSharePromptDialog` anzeigen
- Share-Logik analog zu `useQuickCaptureActions` (Insert in `quick_note_shares`, Benachrichtigungen)

### Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/components/shared/MentionSharePromptDialog.tsx` | Vereinfachtes Ja/Nein-UI |
| `src/components/my-work/CaseItemInteractionQuickCapture.tsx` | SimpleRichTextEditor für Details + Mention-Share-Logik |

