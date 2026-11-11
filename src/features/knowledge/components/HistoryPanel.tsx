import styles from "./KnowledgeWorkspace.module.css";
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
    <section aria-label="Änderungsverlauf" className={styles.history}>
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
          <details key={event.id} className={styles.historyEvent}>
            <summary className="cursor-pointer">
              <strong>
                {KNOWLEDGE_EVENT_NAMES[event.event_type] || "Änderung"}
              </strong>{" "}
              · {knowledgePersonName(profiles, event.actor_id)} ·{" "}
              {formatKnowledgeDate(event.created_at)}
            </summary>
            <p className="mt-2 whitespace-pre-wrap">
              {event.event_type === "tags_changed"
                ? `Tags: ${(() => {
                    const tags = asObject(event.snapshot)?.tags;
                    return Array.isArray(tags)
                      ? tags
                          .map((tag) => String(asObject(tag)?.name || ""))
                          .filter(Boolean)
                          .join(", ") || "Keine Tags"
                      : "Tags geändert";
                  })()}`
                : String(
                    (["comment_added", "outdated_reported"].includes(
                      event.event_type,
                    )
                      ? asObject(event.snapshot)?.metadata_note
                      : asObject(event.snapshot)?.answer_text) ||
                      (event.event_type === "outdated_reported"
                        ? "Ohne Kommentar"
                        : "Noch keine Antwort"),
                  )}
            </p>
          </details>
        ))}
      {history.hasNextPage && (
        <Button
          className={styles.button}
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
