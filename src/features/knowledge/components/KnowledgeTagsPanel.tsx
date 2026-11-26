import { useState } from "react";
import { TopicDisplay, TopicSelector } from "@/components/topics/TopicSelector";
import {
  useKnowledgeExtraWrite,
  useKnowledgeQuestionTopics,
} from "../hooks/useKnowledgeExtras";
import { useTopicModuleSettings } from "@/features/topics/useTopicModuleSettings";
import type { KnowledgeCard } from "../types";
import styles from "./KnowledgeWorkspace.module.css";

export function KnowledgeTagsPanel({
  question,
  canWrite,
}: {
  question: KnowledgeCard;
  canWrite: boolean;
}) {
  const rule = useTopicModuleSettings("knowledge_questions");
  const assigned = useKnowledgeQuestionTopics(question.id);
  const write = useKnowledgeExtraWrite();
  const [error, setError] = useState("");
  const topicIds = assigned.data ?? [];
  const editable = Boolean(
    canWrite && question.answered_at && !question.archived_at,
  );

  if (!rule.isEnabled) return null;

  const update = async (next: string[]) => {
    setError("");
    if (next.join() === topicIds.join()) return;
    try {
      await write.mutateAsync({
        name: "knowledge_qa_set_topics",
        args: {
          p_question: question.id,
          p_expected_revision: question.revision,
          p_topic_ids: next,
        },
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Themen konnten nicht gespeichert werden.",
      );
    }
  };

  return (
    <section
      className={`${styles.slideCard} ${styles.topicsPanel} space-y-3`}
      aria-label="Themen"
    >
      <h3 className="font-medium">Themen</h3>
      {assigned.isLoading ? (
        <p className="text-sm text-muted-foreground">Themen werden geladen …</p>
      ) : assigned.isError ? (
        <p role="alert" className="text-sm">
          Themen konnten nicht geladen werden.
        </p>
      ) : editable ? (
        <TopicSelector
          selectedTopicIds={topicIds}
          onTopicsChange={(next) => void update(next)}
          module="knowledge_questions"
          maxTopics={rule.maxTopics}
          placeholder="Thema hinzufügen..."
          disabled={write.isPending}
        />
      ) : topicIds.length > 0 ? (
        <TopicDisplay topicIds={topicIds} />
      ) : (
        <p className="text-sm text-muted-foreground">Noch keine Themen.</p>
      )}
      {rule.requirement === "required" && topicIds.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Mindestens ein Thema ist erforderlich.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
