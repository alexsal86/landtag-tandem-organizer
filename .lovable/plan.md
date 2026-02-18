

## Fix: Infinite-Loop in den Radix-Patches endgueltig beheben

### Ursache

Die `composeRefs`-Funktion in beiden Patch-Dateien sammelt immer noch Cleanup-Funktionen und gibt sie zurueck (Zeilen 28-45 in `radix-compose-refs-patch.ts`, Zeilen 24-47 in `radix-slot-patch.tsx`). 

Wenn `composeRefs` **nicht memoized** aufgerufen wird (was Radix intern in `SlotClone` tut), erzeugt jeder Render eine neue Ref-Callback-Funktion. React 19 erkennt, dass diese Funktion eine Cleanup-Funktion zurueckgibt, ruft die Cleanup auf, setzt den Ref neu, bekommt wieder eine Cleanup, und so weiter -- Endlosschleife.

### Loesung

`composeRefs` darf **niemals** eine Cleanup-Funktion zurueckgeben. Stattdessen wird `setRef` verwendet, das den Ref-Wert setzt ohne den Rueckgabewert weiterzuleiten.

### Aenderungen

**Datei 1: `src/lib/radix-compose-refs-patch.ts`**

Die `composeRefs`-Funktion wird vereinfacht -- kein Sammeln von Cleanups, kein Return:

```typescript
export function composeRefs<T>(...refs: (React.Ref<T> | undefined)[]): React.RefCallback<T> {
  return (node: T) => {
    refs.forEach((ref) => setRef(ref, node));
  };
}
```

**Datei 2: `src/lib/radix-slot-patch.tsx`**

Die interne `composeRefs`-Funktion wird identisch vereinfacht:

```typescript
function composeRefs<T>(...refs: (React.Ref<T> | undefined)[]): React.RefCallback<T> {
  return (node: T) => {
    refs.forEach((ref) => setRef(ref, node));
  };
}
```

### Warum das sicher ist

- `setRef` ruft die Ref-Funktion auf, verwirft aber den Rueckgabewert
- React 19 sieht keine Cleanup-Funktion und loest keinen Detach/Reattach-Zyklus aus
- `useComposedRefs` bleibt als memoized Variante fuer Komponenten, die Cleanup benoetigen

### Zusammenfassung

| Datei | Aenderung |
|---|---|
| `src/lib/radix-compose-refs-patch.ts` | `composeRefs` gibt keine Cleanup mehr zurueck |
| `src/lib/radix-slot-patch.tsx` | Interne `composeRefs` gibt keine Cleanup mehr zurueck |

2 Dateien, rein mechanische Aenderung. Keine Logik-Aenderungen an der restlichen App.

