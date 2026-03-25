// Simple debounce utility without external dependencies

type DebounceArgs = readonly unknown[];
type DebouncedCallback<TArgs extends DebounceArgs> = (...args: TArgs) => void;

export interface DebouncedFunction<TArgs extends DebounceArgs> {
  (...args: TArgs): void;
  cancel: () => void;
}

export function debounce<TArgs extends DebounceArgs>(
  fn: DebouncedCallback<TArgs>,
  delay = 300,
): DebouncedFunction<TArgs> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced: DebouncedFunction<TArgs> = (...args) => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      fn(...args);
    }, delay);
  };

  debounced.cancel = (): void => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = null;
  };

  return debounced;
}

export function leadingEdgeDebounce<TArgs extends DebounceArgs>(
  fn: DebouncedCallback<TArgs>,
  delay = 300,
): DebouncedCallback<TArgs> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let invoked = false;

  return (...args: TArgs): void => {
    if (!invoked) {
      fn(...args);
      invoked = true;
    }

    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout((): void => {
      invoked = false;
    }, delay);
  };
}
