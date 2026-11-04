import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

type Draft = { title: string; content: string; baseRevision?: number };
const EMPTY: Draft = { title: "", content: "" };

/** Writes on every change so a reload cannot race a debounce or an effect. */
export function useQuickNoteDraft(scope: string, initial: Draft = EMPTY) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const key = user?.id && currentTenant?.id
    ? `quick-note-draft:${user.id}:${currentTenant.id}:${scope}` : null;
  const stored = (() => {
    try {
      const value: unknown = key ? JSON.parse(localStorage.getItem(key) || "null") : null;
      if (value && typeof value === "object" && "title" in value && "content" in value &&
          typeof value.title === "string" && typeof value.content === "string") {
        return { title: value.title, content: value.content, baseRevision: "baseRevision" in value && typeof value.baseRevision === "number" ? value.baseRevision : undefined };
      }
    } catch { /* A blocked or malformed store must not prevent editing. */ }
    return null;
  })();
  const [state, setState] = useState<{ key: string | null; value: Draft } | null>(null);
  const [failed, setFailed] = useState(false);
  const value = state?.key === key ? state.value : stored ?? initial;
  const write = (next: Draft) => {
    setState({ key, value: next });
    try {
      if (key) {
        if (next.title || next.content) localStorage.setItem(key, JSON.stringify(next));
        else localStorage.removeItem(key);
      }
      setFailed(false);
    } catch { setFailed(true); }
  };
  return {
    ...value,
    draftBaseRevision: value.baseRevision,
    draftRestored: stored !== null,
    setTitle: (title: string) => write({ ...value, title }),
    setContent: (content: string) => write({ ...value, content }),
    clearDraft: () => {
      write(EMPTY);
      setState(null);
    },
    draftStatus: failed || !key ? "Entwurf kann nicht lokal gesichert werden" :
      (state?.key === key || stored) && (value.title || value.content) ? "Entwurf lokal gesichert" : "",
  };
}
