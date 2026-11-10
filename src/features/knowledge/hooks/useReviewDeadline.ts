import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { KnowledgeSummary } from "../types";

interface Clock {
  server: number;
  received: number;
  deadline: number;
}
const subscriptions = new Map<() => void, Clock>();
let timer: ReturnType<typeof setTimeout> | undefined;
let version = 0;
const snapshot = () => version;

function schedule() {
  clearTimeout(timer);
  timer = undefined;
  let next = Infinity;
  for (const clock of subscriptions.values()) {
    const remaining =
      clock.deadline - (clock.server + Date.now() - clock.received);
    if (remaining > 0) next = Math.min(next, remaining);
  }
  if (!Number.isFinite(next)) return;
  timer = setTimeout(
    () => {
      version += 1;
      subscriptions.forEach((_clock, notify) => notify());
      schedule();
    },
    Math.min(next, 2_147_483_647),
  );
}

// All mounted cards share one timer. Server time anchors the clock even if the
// workstation clock is wrong; cleanup removes deadlines when cards disappear.
export function useReviewDeadline(
  question: Pick<KnowledgeSummary, "server_now" | "review_due_at">,
) {
  const clock = useMemo(
    () => ({
      server: Date.parse(question.server_now),
      received: Date.now(),
      deadline: question.review_due_at
        ? Date.parse(question.review_due_at)
        : Infinity,
    }),
    [question.server_now, question.review_due_at],
  );
  const subscribe = useCallback(
    (notify: () => void) => {
      subscriptions.set(notify, clock);
      schedule();
      return () => {
        subscriptions.delete(notify);
        schedule();
      };
    },
    [clock],
  );
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return clock.server + Date.now() - clock.received;
}
