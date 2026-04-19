import type { PlannerWorkflowStatus, SocialContentVariant } from "@/features/redaktion/hooks/useSocialPlannerItems";
import { TEMPLATE_OPTIONS } from "./constants";

export type SocialPlannerDraftPayload = {
  topic: string;
  tags: string[];
  channel_ids: string[];
  format: string | null;
  content_goal: string | null;
  format_variant: string | null;
  asset_requirements: string[];
  approval_required: boolean;
  publish_link: string | null;
  performance_notes: string | null;
  hook: string | null;
  core_message: string | null;
  draft_text: string | null;
  cta: string | null;
  notes: string | null;
  responsible_user_id: string | null;
  scheduled_for: string | null;
  approval_state: string;
  workflow_status: PlannerWorkflowStatus;
  hashtags: string[];
  hashtags_in_comment: boolean;
  alt_text: string | null;
  image_url: string | null;
  variants: Record<string, SocialContentVariant>;
  campaign_id: string | null;
  content_pillar: string | null;
  appointment_id?: string | null;
  published_at?: string | null;
  recurrence_group_id?: string | null;
  recurrence_rule?: Record<string, unknown> | null;
};

export type SocialPlannerTemplateId = (typeof TEMPLATE_OPTIONS)[number]["id"];
export type PlannerFormatFilter = "all" | "story" | "feed";
