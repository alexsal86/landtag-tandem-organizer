import React from "react";
import { TopicSelector } from "./TopicSelector";
import type { TopicModule } from "@/features/topics/moduleRules";
import {
  useEntityTopics,
  type TopicEntityType,
} from "@/features/topics/useEntityTopics";

interface TopicPickerProps {
  /** Controlled mode; omit together with entityType to bind the picker to a record. */
  selectedTopicIds?: string[];
  onTopicsChange?: (topicIds: string[]) => void;
  entityType?: TopicEntityType;
  entityId?: string | null;
  module?: TopicModule;
  compact?: boolean;
  placeholder?: string;
  disabled?: boolean;
  maxTopics?: number;
}

/**
 * Shared picker for contact/document/case-file topics. In controlled mode the
 * parent stores and persists the selection; with entityType/entityId the picker
 * reads and replaces the junction rows through useEntityTopics.
 */
export function TopicPicker({
  selectedTopicIds,
  onTopicsChange,
  entityType,
  entityId,
  module,
  compact,
  placeholder,
  disabled,
  maxTopics,
}: TopicPickerProps) {
  const entityTopics = useEntityTopics(entityType ?? null, entityId ?? null);
  const bound = Boolean(entityType && entityId && onTopicsChange === undefined);
  const selected = selectedTopicIds ?? (bound ? entityTopics.topicIds : []);
  const handleChange = onTopicsChange ?? ((topicIds: string[]) => {
    void entityTopics.setTopics(topicIds);
  });

  return (
    <TopicSelector
      selectedTopicIds={selected}
      onTopicsChange={handleChange}
      module={module ?? (entityType ? (entityType === "contact" ? "contacts" : entityType === "document" ? "documents" : "case_files") : undefined)}
      compact={compact}
      placeholder={placeholder}
      disabled={disabled || (bound && (entityTopics.loading || entityTopics.saving))}
      maxTopics={maxTopics}
    />
  );
}
