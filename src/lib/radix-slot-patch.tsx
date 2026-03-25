/**
 * Patched version of @radix-ui/react-slot to fix React 19 infinite loop.
 * See: https://github.com/radix-ui/primitives/issues/3799
 * See: https://github.com/radix-ui/primitives/pull/3804
 *
 * The fix: SlotClone uses useComposedRefs (memoized) instead of raw composeRefs.
 */
import * as React from "react";
import { Fragment, jsx } from "react/jsx-runtime";

type InteropRecord = Record<string, unknown>;

type SlotLikeProps = InteropRecord & {
  children?: React.ReactNode;
  ref?: React.Ref<unknown>;
};

type RadixTaggedComponent = {
  __radixId?: symbol;
};

const toRecord = (value: unknown): InteropRecord | null => {
  return value && typeof value === "object" ? (value as InteropRecord) : null;
};

// Inline compose-refs to avoid circular alias issues
function setRef<T>(ref: React.Ref<T> | undefined, value: T): void {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref !== null && ref !== undefined) {
    (ref as React.MutableRefObject<T>).current = value;
  }
}

function useComposedRefs<T>(...refs: (React.Ref<T> | undefined)[]): React.RefCallback<T> {
  const refsRef = React.useRef(refs);
  refsRef.current = refs;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useCallback((node: T) => {
    refsRef.current.forEach((ref) => setRef(ref, node));
  }, []);
}

// ---- Slot implementation ----

const SLOTTABLE_IDENTIFIER = Symbol("radix.slottable");

function isSlottable(child: React.ReactNode): child is React.ReactElement<SlotLikeProps> {
  if (!React.isValidElement(child)) return false;

  const childType = child.type;
  if (typeof childType !== "function") return false;

  const taggedType = childType as RadixTaggedComponent;
  return taggedType.__radixId === SLOTTABLE_IDENTIFIER;
}

function mergeProps(slotProps: InteropRecord, childProps: InteropRecord): InteropRecord {
  const overrideProps: InteropRecord = { ...childProps };

  for (const propName in childProps) {
    const slotPropValue = slotProps[propName];
    const childPropValue = childProps[propName];
    const isHandler = /^on[A-Z]/.test(propName);

    if (isHandler) {
      if (typeof slotPropValue === "function" && typeof childPropValue === "function") {
        overrideProps[propName] = (...args: unknown[]) => {
          const childResult = (childPropValue as (...handlerArgs: unknown[]) => unknown)(...args);
          (slotPropValue as (...handlerArgs: unknown[]) => unknown)(...args);
          return childResult;
        };
      } else if (slotPropValue !== undefined) {
        overrideProps[propName] = slotPropValue;
      }
    } else if (propName === "style") {
      const slotStyle = toRecord(slotPropValue) ?? {};
      const childStyle = toRecord(childPropValue) ?? {};
      overrideProps[propName] = { ...slotStyle, ...childStyle };
    } else if (propName === "className") {
      const classes = [slotPropValue, childPropValue].filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      );
      overrideProps[propName] = classes.join(" ");
    }
  }

  return { ...slotProps, ...overrideProps };
}

function getElementRef(element: React.ReactElement<SlotLikeProps>): React.Ref<unknown> | undefined {
  const elementRecord = toRecord(element);
  const elementPropsRecord = toRecord(element.props);

  const propsRefGetter = Object.getOwnPropertyDescriptor(element.props, "ref")?.get;
  if (propsRefGetter && "isReactWarning" in propsRefGetter) {
    return elementRecord?.ref as React.Ref<unknown> | undefined;
  }

  const elementRefGetter = Object.getOwnPropertyDescriptor(element, "ref")?.get;
  if (elementRefGetter && "isReactWarning" in elementRefGetter) {
    return elementPropsRecord?.ref as React.Ref<unknown> | undefined;
  }

  return (elementPropsRecord?.ref as React.Ref<unknown> | undefined) ??
    (elementRecord?.ref as React.Ref<unknown> | undefined);
}

// SlotClone - THE FIX: uses useComposedRefs instead of raw composeRefs
const SlotClone = React.forwardRef<unknown, SlotLikeProps>((props, forwardedRef) => {
  const { children, ...slotProps } = props;

  if (React.isValidElement<SlotLikeProps>(children)) {
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
const Slot = React.forwardRef<unknown, SlotLikeProps>((props, forwardedRef) => {
  const { children, ...slotProps } = props;
  const childrenArray = React.Children.toArray(children as React.ReactNode);
  const slottable = childrenArray.find(isSlottable);

  if (slottable && React.isValidElement<SlotLikeProps>(slottable)) {
    const newElement = slottable.props.children;
    const newChildren = childrenArray.map((child) => {
      if (child === slottable) {
        if (React.Children.count(newElement) > 1) return React.Children.only(null);
        if (!React.isValidElement<SlotLikeProps>(newElement)) return null;
        return newElement.props.children ?? null;
      }

      return child;
    });

    return jsx(SlotClone, {
      ...slotProps,
      ref: forwardedRef,
      children: React.isValidElement<SlotLikeProps>(newElement)
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
(Slottable as RadixTaggedComponent).__radixId = SLOTTABLE_IDENTIFIER;
Slottable.displayName = "Slottable";

function createSlot(ownerName: string) {
  const S = React.forwardRef<unknown, SlotLikeProps>((props, ref) => {
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
  (S as RadixTaggedComponent).__radixId = SLOTTABLE_IDENTIFIER;
  return S;
}

export { Slot, Slot as Root, Slottable, createSlot, createSlottable };
