import * as React from "react";

type OptionalRef<T> = React.Ref<T> | undefined;
type Cleanup = () => void;

function setRef<T>(ref: OptionalRef<T>, value: T | null): void | Cleanup {
  if (typeof ref === "function") {
    return ref(value);
  }
  if (ref != null) {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

interface RefCache {
  children: WeakMap<object, RefCache>;
  callback?: React.RefCallback<unknown>;
}

const composedRefsCache: RefCache = { children: new WeakMap() };

/**
 * Radix also calls composeRefs directly during render. Reuse the callback for
 * the same refs so React does not detach/attach them on each state update.
 * Weak keys let callbacks and component refs be collected after unmount.
 */
export function composeRefs<T>(...refs: OptionalRef<T>[]): React.RefCallback<T> {
  const activeRefs = refs.filter((ref): ref is React.RefCallback<T> | React.RefObject<T> => ref != null);
  let cache = composedRefsCache;
  for (const ref of activeRefs) {
    let child = cache.children.get(ref);
    if (!child) {
      child = { children: new WeakMap() };
      cache.children.set(ref, child);
    }
    cache = child;
  }
  if (!cache.callback) {
    cache.callback = ((node: T | null) => {
      const cleanups = activeRefs.map(ref => setRef(ref, node));
      if (cleanups.some(cleanup => typeof cleanup === "function")) {
        return () => {
          activeRefs.forEach((ref, index) => {
            const cleanup = cleanups[index];
            if (typeof cleanup === "function") cleanup();
            else setRef(ref, null);
          });
        };
      }
    }) as React.RefCallback<unknown>;
  }
  return cache.callback as React.RefCallback<T>;
}

export function useComposedRefs<T>(...refs: OptionalRef<T>[]): React.RefCallback<T> {
  const refsRef = React.useRef(refs);
  refsRef.current = refs;
  return React.useCallback((node: T | null) => composeRefs(...refsRef.current)(node), []);
}
