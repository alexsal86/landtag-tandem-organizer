/**
 * Patched version of @radix-ui/react-compose-refs to fix React 19 infinite loop.
 * See: https://github.com/radix-ui/primitives/issues/3799
 * 
 * The issue: SlotClone calls composeRefs() directly (not memoized) on every render.
 * In React 19, ref callbacks can return cleanup functions. When composeRefs creates
 * a new function each render, React sees a new callback ref → unmounts old → mounts new
 * → infinite loop.
 * 
 * Fix: Make setRef not return the cleanup function to prevent React 19 from treating
 * the composed ref as having cleanup, breaking the recursive cycle.
 */
import * as React from "react";

function setRef<T>(ref: React.Ref<T> | undefined, value: T): void {
  if (typeof ref === "function") {
    // Don't return the result — in React 19, returning a function from a ref callback
    // is treated as a cleanup function, which causes infinite re-mount loops
    // when combined with non-memoized composeRefs in SlotClone.
    ref(value);
  } else if (ref !== null && ref !== undefined) {
    (ref as React.MutableRefObject<T>).current = value;
  }
}

export function composeRefs<T>(...refs: (React.Ref<T> | undefined)[]): React.RefCallback<T> {
  return (node: T) => {
    refs.forEach((ref) => setRef(ref, node));
  };
}

export function useComposedRefs<T>(...refs: (React.Ref<T> | undefined)[]): React.RefCallback<T> {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useCallback(composeRefs(...refs), refs);
}
