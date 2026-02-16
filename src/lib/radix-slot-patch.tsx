/**
 * Patched version of @radix-ui/react-slot to fix React 19 infinite loop.
 * See: https://github.com/radix-ui/primitives/issues/3799
 * See: https://github.com/radix-ui/primitives/pull/3804
 * 
 * The fix: SlotClone uses useComposedRefs (memoized) instead of raw composeRefs.
 */
import * as React from "react";
import { jsx, Fragment } from "react/jsx-runtime";

// Inline compose-refs to avoid circular alias issues
function setRef<T>(ref: React.Ref<T> | undefined, value: T): void {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref !== null && ref !== undefined) {
    (ref as React.MutableRefObject<T>).current = value;
  }
}

function composeRefs<T>(...refs: (React.Ref<T> | undefined)[]): React.RefCallback<T> {
  return (node: T) => {
    let hasCleanup = false;
    const cleanups = refs.map((ref) => {
      if (typeof ref === "function") {
        const cleanup = ref(node);
        if (typeof cleanup === "function") {
          hasCleanup = true;
          return cleanup;
        }
      } else if (ref !== null && ref !== undefined) {
        (ref as React.MutableRefObject<T>).current = node;
      }
      return undefined;
    });

    if (hasCleanup) {
      return () => {
        for (let i = 0; i < cleanups.length; i++) {
          const cleanup = cleanups[i];
          if (typeof cleanup === "function") {
            cleanup();
          } else {
            setRef(refs[i], null as any);
          }
        }
      };
    }
  };
}

function useComposedRefs<T>(...refs: (React.Ref<T> | undefined)[]): React.RefCallback<T> {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useCallback(composeRefs(...refs), refs);
}

// ---- Slot implementation ----

const SLOTTABLE_IDENTIFIER = Symbol("radix.slottable");

function isSlottable(child: React.ReactNode): child is React.ReactElement {
  return (
    React.isValidElement(child) &&
    typeof child.type === "function" &&
    "__radixId" in child.type &&
    (child.type as any).__radixId === SLOTTABLE_IDENTIFIER
  );
}

function mergeProps(slotProps: Record<string, any>, childProps: Record<string, any>) {
  const overrideProps = { ...childProps };
  for (const propName in childProps) {
    const slotPropValue = slotProps[propName];
    const childPropValue = childProps[propName];
    const isHandler = /^on[A-Z]/.test(propName);
    if (isHandler) {
      if (slotPropValue && childPropValue) {
        overrideProps[propName] = (...args: any[]) => {
          const result = childPropValue(...args);
          slotPropValue(...args);
          return result;
        };
      } else if (slotPropValue) {
        overrideProps[propName] = slotPropValue;
      }
    } else if (propName === "style") {
      overrideProps[propName] = { ...slotPropValue, ...childPropValue };
    } else if (propName === "className") {
      overrideProps[propName] = [slotPropValue, childPropValue].filter(Boolean).join(" ");
    }
  }
  return { ...slotProps, ...overrideProps };
}

function getElementRef(element: React.ReactElement): any {
  let getter = Object.getOwnPropertyDescriptor(element.props, "ref")?.get;
  let mayWarn = getter && "isReactWarning" in getter && (getter as any).isReactWarning;
  if (mayWarn) {
    return (element as any).ref;
  }
  getter = Object.getOwnPropertyDescriptor(element, "ref")?.get;
  mayWarn = getter && "isReactWarning" in getter && (getter as any).isReactWarning;
  if (mayWarn) {
    return element.props.ref;
  }
  return element.props.ref || (element as any).ref;
}

// SlotClone - THE FIX: uses useComposedRefs instead of raw composeRefs
const SlotClone = React.forwardRef<any, any>((props, forwardedRef) => {
  const { children, ...slotProps } = props;
  if (React.isValidElement(children)) {
    const childrenRef = getElementRef(children);
    // FIX: Use memoized useComposedRefs instead of raw composeRefs
    const composedRef = useComposedRefs(forwardedRef, childrenRef);
    const mergedProps = mergeProps(slotProps, children.props);
    if (children.type !== React.Fragment) {
      mergedProps.ref = forwardedRef ? composedRef : childrenRef;
    }
    return React.cloneElement(children, mergedProps);
  }
  return React.Children.count(children) > 1 ? React.Children.only(null) : null;
});
SlotClone.displayName = "SlotClone";

// Slot
const Slot = React.forwardRef<any, any>((props, forwardedRef) => {
  const { children, ...slotProps } = props;
  const childrenArray = React.Children.toArray(children);
  const slottable = childrenArray.find(isSlottable);
  if (slottable && React.isValidElement(slottable)) {
    const slottableProps = slottable.props as any;
    const newElement = slottableProps.children;
    const newChildren = childrenArray.map((child) => {
      if (child === slottable) {
        if (React.Children.count(newElement) > 1) return React.Children.only(null);
        return React.isValidElement(newElement) ? (newElement.props as any).children : null;
      } else {
        return child;
      }
    });
    return jsx(SlotClone, {
      ...slotProps,
      ref: forwardedRef,
      children: React.isValidElement(newElement)
        ? React.cloneElement(newElement, undefined, newChildren)
        : null,
    });
  }
  return jsx(SlotClone, { ...slotProps, ref: forwardedRef, children });
});
Slot.displayName = "Slot";

// Slottable
const Slottable = ({ children }: { children: React.ReactNode }) => {
  return jsx(Fragment, { children });
};
(Slottable as any).__radixId = SLOTTABLE_IDENTIFIER;
Slottable.displayName = "Slottable";

function createSlot(ownerName: string) {
  const S = React.forwardRef<any, any>((props, ref) => {
    return jsx(Slot, { ...props, ref });
  });
  S.displayName = `${ownerName}.Slot`;
  return S;
}

function createSlottable(ownerName: string) {
  const S = ({ children }: { children: React.ReactNode }) => {
    return jsx(Fragment, { children });
  };
  S.displayName = `${ownerName}.Slottable`;
  (S as any).__radixId = SLOTTABLE_IDENTIFIER;
  return S;
}

export { Slot, Slot as Root, Slottable, createSlot, createSlottable };
