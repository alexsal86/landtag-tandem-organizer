

## Fix: `useComposedRefs` muss eine stabile Referenz zurueckgeben

### Ursache (endgueltig identifiziert)

Radix Select uebergibt **Inline-Funktionen** an `useComposedRefs`:

```typescript
// node_modules/@radix-ui/react-select/dist/index.mjs:907-912
const composedRefs = useComposedRefs(
  forwardedRef,
  (node) => setItemTextNode(node),      // NEU bei jedem Render!
  itemContext.onItemTextChange,
  (node) => contentContext.itemTextRefCallback?.(...)  // NEU bei jedem Render!
);
```

Unsere aktuelle `useComposedRefs`-Implementierung:

```typescript
return React.useCallback(composeRefs(...refs), refs);
//                                              ^^^^ refs aendert sich JEDES MAL
```

Da die Inline-Funktionen bei jedem Render eine neue Identitaet haben, aendert sich die `refs`-Dependency immer. `useCallback` erstellt daher jedes Mal eine neue Funktion. React erkennt einen neuen Ref-Callback, ruft Detach (null) und Attach (node) auf, was `setState` triggert, was einen Re-Render ausloest -- Endlosschleife.

### Loesung

`useComposedRefs` muss eine **stabile** Callback-Funktion zurueckgeben, die intern immer die aktuellsten Refs liest:

```typescript
export function useComposedRefs<T>(...refs: (React.Ref<T> | undefined)[]): React.RefCallback<T> {
  const refsRef = React.useRef(refs);
  refsRef.current = refs;  // Immer aktuelle Refs speichern
  return React.useCallback((node: T) => {
    refsRef.current.forEach((ref) => setRef(ref, node));
  }, []);  // Stabile Funktion - aendert sich NIE
}
```

### Aenderungen

| Datei | Aenderung |
|---|---|
| `src/lib/radix-compose-refs-patch.ts` | `useComposedRefs` mit stabiler Referenz via `useRef` |
| `src/lib/radix-slot-patch.tsx` | Identische Aenderung an der internen `useComposedRefs` |

### Warum das funktioniert

- Die zurueckgegebene Funktion hat immer dieselbe Identitaet (leeres Dependency-Array)
- React sieht keinen neuen Ref-Callback, fuehrt kein Detach/Attach durch
- Intern werden trotzdem immer die aktuellsten Refs verwendet (`refsRef.current`)
- Kein setState-Trigger, kein Re-Render, keine Endlosschleife

### Risiko

Minimal. Die Funktion ist funktional identisch, nur die Identitaet ist stabil. Alle bestehenden Radix-Komponenten (Dialog, Tooltip, Popover, etc.) profitieren ebenfalls davon.

