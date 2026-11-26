export const TOPIC_MODULES = [
  "tasks",
  "case_items",
  "case_files",
  "documents",
  "appointments",
  "decisions",
  "contacts",
  "knowledge_questions",
  "knowledge_documents",
  "map_flags",
] as const;

export type TopicModule = (typeof TOPIC_MODULES)[number];

export type TopicCreationPolicy = "admins" | "members";
export type TopicRequirement = "optional" | "required";

export interface TopicModuleRule {
  isEnabled: boolean;
  requirement: TopicRequirement;
  maxTopics: number;
  creationPolicy: TopicCreationPolicy;
  showFilter: boolean;
}

export interface TopicModuleRuleRow {
  is_enabled: boolean | null;
  requirement: string | null;
  max_topics: number | null;
  creation_policy: string | null;
  show_filter: boolean | null;
}

export const DEFAULT_TOPIC_MODULE_RULE: TopicModuleRule = {
  isEnabled: true,
  requirement: "optional",
  maxTopics: 5,
  creationPolicy: "admins",
  showFilter: true,
};

export function normalizeTopicModuleRule(
  row?: TopicModuleRuleRow | null,
): TopicModuleRule {
  return {
    isEnabled: row?.is_enabled ?? DEFAULT_TOPIC_MODULE_RULE.isEnabled,
    requirement:
      row?.requirement === "required"
        ? "required"
        : DEFAULT_TOPIC_MODULE_RULE.requirement,
    maxTopics: Math.min(
      20,
      Math.max(1, row?.max_topics ?? DEFAULT_TOPIC_MODULE_RULE.maxTopics),
    ),
    creationPolicy:
      row?.creation_policy === "members"
        ? "members"
        : DEFAULT_TOPIC_MODULE_RULE.creationPolicy,
    showFilter: row?.show_filter ?? DEFAULT_TOPIC_MODULE_RULE.showFilter,
  };
}

export function canAddTopic(
  selectedCount: number,
  rule: TopicModuleRule,
): boolean {
  return rule.isEnabled && selectedCount < rule.maxTopics;
}

export function canCreateTopic(
  rule: TopicModuleRule,
  hasAdminAccess: boolean,
): boolean {
  return (
    rule.isEnabled &&
    (rule.creationPolicy === "members" || hasAdminAccess)
  );
}

export function validateTopicSelection(
  selectedCount: number,
  rule: TopicModuleRule,
): string | null {
  if (!rule.isEnabled) return "Themen sind für dieses Modul deaktiviert.";
  if (selectedCount > rule.maxTopics)
    return `Höchstens ${rule.maxTopics} Themen pro Eintrag.`;
  if (rule.requirement === "required" && selectedCount === 0)
    return "Bitte mindestens ein Thema auswählen.";
  return null;
}
