import type { TopicModule } from "./moduleRules";

export type TopicEntityType = "contact" | "document" | "case_file";

export interface EntityTopicConfig {
  table: "contact_topics" | "document_topics" | "case_file_topics";
  idColumn: "contact_id" | "document_id" | "case_file_id";
  module: TopicModule;
}

export const ENTITY_TOPIC_CONFIG: Record<TopicEntityType, EntityTopicConfig> = {
  contact: { table: "contact_topics", idColumn: "contact_id", module: "contacts" },
  document: { table: "document_topics", idColumn: "document_id", module: "documents" },
  case_file: { table: "case_file_topics", idColumn: "case_file_id", module: "case_files" },
};
