## Problem

Im Tab „Quick Notes" (Meine Arbeit → Capture) kollabieren beide Karten („Quick Notes" und „Meine Notizen") auf ~50–80 px Breite. Texte und Platzhalter brechen wortweise um, obwohl mittig genug Platz ist. Andere Tabs (Vorgänge, Aufgaben …) sind unauffällig.

## Vermutete Ursachen (in Reihenfolge)

1. **Lexical-Editor erzwingt `min-content`-Breite über die `prose`-Klasse.** `SimpleRichTextEditor` rendert `<ContentEditable className="p-3 prose prose-sm max-w-none">`. In Tailwind v4 (mit `@tailwindcss/typography`) setzt `prose-sm` zusätzlich Eigenschaften, die das Eltern-Wrapper-`<div className="border rounded-lg">` nicht zu `width:100%` zwingen. Da das umgebende `relative`-`<div>` keine eigene Breite vorgibt, schrumpft alles auf den Inhalt – und der Inhalt ist nur der absolut positionierte Placeholder.
2. **Container `mx-auto w-full max-w-3xl space-y-6`** ist korrekt, aber die Cards selbst tragen flex-only-Klassen (`self-start` in `MyWorkQuickCapture`, `flex-1` in `MyWorkNotesList`), die im Block-Parent wirkungslos sind und Verwirrung stiften – sollten entfernt/ersetzt werden, damit `w-full` greift.
3. Tailwind v4 generiert `prose`-Klassen ohne unsere Erwartung an Default-Breite – möglicherweise fehlt ein `w-full` auf dem äußeren Editor-Wrapper.

## Umsetzung

1. **`src/components/ui/SimpleRichTextEditor.tsx`** (Zeile ~427-456):
   - Äußerem Wrapper `w-full block` hinzufügen.
   - `<div className="relative">` → `<div className="relative w-full">`.
   - `ContentEditable` className: `block w-full` ergänzen.
2. **`src/components/my-work/MyWorkQuickCapture.tsx`** (Zeile 89):
   - `self-start` durch `w-full` ersetzen, damit die Card explizit volle Breite einnimmt.
3. **`src/components/my-work/MyWorkNotesList.tsx`** (Zeile 28):
   - `flex-1` → `w-full`.
4. **`src/features/dashboard/components/MyWorkView.tsx`** (Zeile 239):
   - Container von `mx-auto w-full max-w-3xl space-y-6` → `mx-auto w-full max-w-3xl flex flex-col gap-6`. Dadurch ist klar, dass beide Karten als Block-Items volle Breite halten, und `space-y` wird nicht durch fragmentierte Kind-Listen umgangen.
5. Live im Preview prüfen (Karten ≈ 768 px breit, Placeholder einzeilig).

## Hinweis

Falls das Problem nach diesen Anpassungen weiterbesteht, ist der nächste Schritt, im laufenden Preview per DevTools das `min-width`/`width` jedes Vorfahren der Card auszulesen – das deutet dann auf eine andere globale CSS-Regel (z. B. in `lexical-editor.css` oder `index.css`).
