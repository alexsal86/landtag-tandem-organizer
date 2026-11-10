import { Button } from "@/components/ui/button";
import { useKnowledgeHistory } from "../hooks/useKnowledgeQuestions";
import { asObject } from "../logic";
import {
  formatKnowledgeDate,
  knowledgePersonName,
  KNOWLEDGE_EVENT_NAMES,
} from "./presentation";
import type { TenantProfileOption } from "@/hooks/useTenantProfiles";

export function HistoryPanel({
  questionId,
  profiles,
}: {
  questionId: string;
  profiles: TenantProfileOption[];
}) {
  const history = useKnowledgeHistory(questionId, true);
  return (
    <section aria-label="Änderungsverlauf" className="space-y-2 border-t pt-3">
      {history.isPending && <p className="text-sm">Verlauf wird geladen …</p>}
      {history.isError && (
        <p role="alert" className="text-sm text-destructive">
          Verlauf konnte nicht geladen werden.{" "}
          <button onClick={() => void history.refetch()}>
            Erneut versuchen
          </button>
        </p>
      )}
      {history.data?.pages
        .flatMap((page) => page.items)
        .map((event) => (
          <details key={event.id} className="rounded border p-2 text-sm">
            <summary className="cursor-pointer">
              {KNOWLEDGE_EVENT_NAMES[event.event_type] || "Änderung"} ·{" "}
              {knowledgePersonName(profiles, event.actor_id)} ·{" "}
              {formatKnowledgeDate(event.created_at)}
            </summary>
            <p className="mt-2 whitespace-pre-wrap">
              {String(
                asObject(event.snapshot)?.answer_text || "Noch keine Antwort",
              )}
            </p>
          </details>
        ))}
      {history.hasNextPage && (
        <Button
          variant="outline"
          disabled={history.isFetchingNextPage}
          onClick={() => void history.fetchNextPage()}
        >
          Ältere laden
        </Button>
      )}
    </section>
  );
}
