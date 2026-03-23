import { format, type Locale } from "date-fns";
import { debugConsole } from "@/utils/debugConsole";

const loggedInvalidDateWarnings = new Set<string>();

export const formatDateSafe = (
  value: string | number | Date | null | undefined,
  pattern: string,
  fallback = "–",
  options?: { locale?: Locale; warnKey?: string; warnItemId?: string; warnField?: string },
) => {
  if (!value) return fallback;
  const parsedDate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    if (options?.warnKey && !loggedInvalidDateWarnings.has(options.warnKey)) {
      loggedInvalidDateWarnings.add(options.warnKey);
      debugConsole.warn("Invalid date in case workspace item", {
        itemId: options.warnItemId,
        field: options.warnField,
        value,
      });
    }
    return fallback;
  }
  return format(parsedDate, pattern, options?.locale ? { locale: options.locale } : undefined);
};
