

# Alle `dangerouslySetInnerHTML`-Stellen mit `sanitizeRichHtml` absichern

## Betroffene Dateien (unsanitized)

| Datei | Zeile(n) | Inhalt |
|---|---|---|
| `EmailHistory.tsx` | 502 | `selectedEmail.body_html` |
| `EmailComposer.tsx` | 196 | `hook.replaceVariables(hook.bodyHtml, ...)` |
| `DecisionAttachmentPreviewDialog.tsx` | 137, 176 | `html` (Datei-Preview) |
| `TemplateGrid.tsx` | 49 | `previewHtml` (Template-Vorschau) |
| `ArchivedLetterDetails.tsx` | 251 | `letterDetails.content` |
| `DIN5008LetterLayout.tsx` | 604, 750, 832, 909 | `template.letterhead_html`, `content`, `template.letterhead_css` |
| `DashboardAppointments.tsx` | 80 | `specialDayHint.text` (Markdown→HTML) |
| `MermaidRenderer.tsx` | 73 | `svg` (Mermaid-Output) |
| `TwoFactorSettings.tsx` | 316 | `qrCode` (QR-SVG) |

Bereits abgesichert (kein Handlungsbedarf):
- `RichTextDisplay.tsx` — nutzt `sanitizeRichHtml`
- `ProtocolViewer.tsx` — nutzt `sanitizeRichHtml`
- `ProtocolRawData.tsx` — nutzt `sanitizeRichHtml`
- `CaseItemDetailPanel.tsx` — nutzt `safeNoteHtml` (pre-sanitized)

## Umsetzung

**Für jede betroffene Datei:**
1. `import { sanitizeRichHtml } from '@/utils/htmlSanitizer';` hinzufügen
2. Jeden `dangerouslySetInnerHTML={{ __html: xyz }}` Aufruf ersetzen durch `dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(xyz) }}`

**Sonderfälle:**
- **`DIN5008LetterLayout.tsx` Zeile 909** (`<style dangerouslySetInnerHTML>`): CSS-Sanitization braucht eine eigene Funktion, da `sanitizeRichHtml` CSS-Tags entfernt. Hier eine neue `sanitizeCss`-Funktion in `htmlSanitizer.ts` ergänzen, die gefährliche CSS-Konstrukte (`expression()`, `url()`, `@import`) entfernt.
- **`MermaidRenderer.tsx`** und **`TwoFactorSettings.tsx`**: SVG-Output von trusted Libraries (Mermaid, QR-Generator). Trotzdem absichern mit `sanitizeRichHtml`, da DOMPurify SVG unterstützt.
- **`DashboardAppointments.tsx`**: Einfacher Markdown→HTML-Ersatz (`**bold**` + `\n`→`<br/>`). Absichern mit `sanitizeRichHtml`.

## Neue Funktion in `htmlSanitizer.ts`

```typescript
export const sanitizeCss = (css: string): string => {
  return css
    .replace(/expression\s*\(/gi, '')
    .replace(/@import\b/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/url\s*\(\s*['"]?\s*javascript:/gi, '');
};
```

## Zusammenfassung

- **9 Dateien** bearbeiten
- **~12 Stellen** absichern
- **1 neue Funktion** (`sanitizeCss`) für CSS-Sonderfall

