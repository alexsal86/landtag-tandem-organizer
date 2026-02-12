

# Plan: Fix "Maximum update depth exceeded" in Dialog

## Ursache

Die benutzerdefinierte `dialog.tsx` rendert `DialogPrimitive.Content` als **Kind-Element** innerhalb von `DialogOverlay`. In Kombination mit React 19 und den Radix UI Primitives (FocusScope, Slot) entsteht eine Endlosschleife bei `setRef`-Callbacks.

Das Standard-Radix-Pattern sieht vor, dass `Overlay` und `Content` **Geschwister-Elemente** innerhalb des Portals sind -- nicht verschachtelt.

## Loesung

Die `DialogContent`-Komponente in `src/components/ui/dialog.tsx` wird auf das Standard-Radix-Pattern zurueckgesetzt:

```text
Aktuell (fehlerhaft):
  Portal
    -> Overlay (enthalt Content als Kind)
        -> Content

Standard (korrekt):
  Portal
    -> Overlay (eigenstaendig)
    -> Content (Geschwister)
```

## Aenderung in `src/components/ui/dialog.tsx`

**DialogOverlay** wird auf die Standard-Implementierung zurueckgesetzt (ohne Kinder, ohne Flex-Centering):

```
const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
```

**DialogContent** wird als Geschwister neben dem Overlay gerendert (Standard Radix/shadcn Pattern):

```
const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ...">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
```

Die wesentlichen Unterschiede:
- Content wird nicht mehr in einen `overflow-y-auto`-Wrapper gepackt (die LetterTemplateManager-Dialoge haben bereits eigenes `overflow-y-auto` via className)
- Content ist per `fixed + translate` zentriert (Standard) statt per Flex auf dem Overlay
- Overlay und Content sind Geschwister im Portal

## Betroffene Datei

| Datei | Aenderung |
|-------|-----------|
| `src/components/ui/dialog.tsx` | DialogOverlay und DialogContent auf Standard-Radix/shadcn-Pattern zuruecksetzen |

Keine weiteren Dateien betroffen. Die `className`-Overrides in LetterTemplateManager (`max-w-6xl max-h-[80vh] overflow-y-auto`) funktionieren weiterhin, da sie direkt auf `DialogPrimitive.Content` angewendet werden.

