// Simple debounce utility without external dependencies
export function debounce<T extends (...args: any[]) => void>(fn: T, delay = 300) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function leadingEdgeDebounce<T extends (...args: any[]) => void>(fn: T, delay = 300) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let invoked = false;
  return (...args: Parameters<T>) => {
    if (!invoked) {
      fn(...args);
      invoked = true;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      invoked = false;
    }, delay);
  };
}