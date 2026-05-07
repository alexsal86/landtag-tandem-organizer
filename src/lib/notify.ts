import { toast as sonnerToast, type ExternalToast } from "sonner";

/**
 * Phase E — unified toast helpers.
 * Use these instead of calling sonner directly so success/error/warn/info
 * styling stays consistent across the app.
 *
 * Usage:
 *   notify.success("Gespeichert");
 *   notify.error("Fehler beim Speichern", { description: err.message });
 *   notify.info("Synchronisiert", { description: "12 Einträge aktualisiert" });
 */

type Opts = ExternalToast;

export const notify = {
  success: (message: string, opts?: Opts) => sonnerToast.success(message, opts),
  error: (message: string, opts?: Opts) => sonnerToast.error(message, opts),
  warning: (message: string, opts?: Opts) => sonnerToast.warning(message, opts),
  info: (message: string, opts?: Opts) => sonnerToast.message(message, opts),
  message: (message: string, opts?: Opts) => sonnerToast(message, opts),
  loading: (message: string, opts?: Opts) => sonnerToast.loading(message, opts),
  promise: sonnerToast.promise,
  dismiss: sonnerToast.dismiss,
};

export { sonnerToast as toast };
