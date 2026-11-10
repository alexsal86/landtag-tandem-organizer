/**
 * Unwraps the default export of a CommonJS module imported via ESM.
 * Vite/esbuild and Rollup can deliver `module`, `module.default` or
 * `module.default.default` depending on pre-bundling state, which caused
 * intermittent "x is not a function" crashes.
 */
export function resolveCjsDefault<T extends (...args: never[]) => unknown>(mod: unknown): T {
  let current: unknown = mod;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current === 'function') return current as T;
    if (current && typeof current === 'object' && 'default' in current) {
      current = (current as { default: unknown }).default;
      continue;
    }
    break;
  }
  throw new TypeError('CommonJS-Modul liefert keine Funktion als Default-Export');
}
