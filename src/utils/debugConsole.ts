export const isDebugConsoleEnabled = () => {
  try {
    return localStorage.getItem('matrix_debug_console') === 'true';
  } catch {
    return false;
  }
};

export const debugConsole = {
  log: (...args: unknown[]) => {
    if (isDebugConsoleEnabled()) {
      globalThis.console.log(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (isDebugConsoleEnabled()) {
      globalThis.console.info(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (isDebugConsoleEnabled()) {
      globalThis.console.warn(...args);
    }
  },
  error: (...args: unknown[]) => {
    if (isDebugConsoleEnabled()) {
      globalThis.console.error(...args);
    }
  },
};
