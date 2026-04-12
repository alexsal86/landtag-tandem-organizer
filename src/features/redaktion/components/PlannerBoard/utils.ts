import type { SocialContentVariant, SocialPlannerItem } from "@/features/redaktion/hooks/useSocialPlannerItems";
import { TEMPLATE_OPTIONS } from "./constants";
import type { SocialPlannerTemplateId } from "./types";

export function getChannelRules(slug: string) {
  switch (slug) {
    case "instagram":
      return { captionRequired: true, captionMax: 2200, firstCommentMax: 2200 };
    case "x":
    case "twitter":
      return { captionRequired: true, captionMax: 280, firstCommentMax: 280 };
    case "linkedin":
      return { captionRequired: true, captionMax: 3000, firstCommentMax: 1250 };
    case "facebook":
      return { captionRequired: true, captionMax: 63206, firstCommentMax: 8000 };
    default:
      return { captionRequired: false, captionMax: 5000, firstCommentMax: 2000 };
  }
}

export function validateVariant(variant: SocialContentVariant | undefined, channelSlug: string): string[] {
  const errors: string[] = [];
  if (!variant) {
    errors.push("Kanalvariante fehlt.");
    return errors;
  }
  const rules = getChannelRules(channelSlug);
  if (rules.captionRequired && !variant.caption.trim()) errors.push("Caption ist für diesen Kanal Pflicht.");
  if (variant.caption.length > rules.captionMax) errors.push(`Caption überschreitet das Limit (${rules.captionMax}).`);
  if (variant.first_comment.length > rules.firstCommentMax) errors.push(`First Comment überschreitet das Limit (${rules.firstCommentMax}).`);
  if (!variant.media_type) errors.push("Media Type ist ein Pflichtfeld.");
  if (variant.platform_status === "published" && !variant.caption.trim()) errors.push("Veröffentlichte Variante braucht eine Caption.");
  if (!variant.asset_ids.every((assetId) => /^[a-zA-Z0-9-_/]+$/.test(assetId))) errors.push("Asset IDs dürfen nur Buchstaben, Zahlen, '-', '_' und '/' enthalten.");
  return errors;
}

export function inferFormatType(item: SocialPlannerItem): "story" | "feed" | "other" {
  const normalized = [item.format, item.topic, item.draft_text].filter(Boolean).join(" ").toLowerCase();
  if (normalized.includes("story") || normalized.includes("stories")) return "story";
  if (normalized.includes("feed") || normalized.includes("post") || normalized.includes("carousel") || normalized.includes("reel")) return "feed";
  return "other";
}

export function applyTemplateToState(
  templateId: SocialPlannerTemplateId,
  setters: {
    setFormat: (value: string) => void;
    setContentGoal: (value: string) => void;
    setFormatVariant: (value: string) => void;
    setHook: (value: string) => void;
    setCta: (value: string) => void;
    setAssetRequirements: (value: string[]) => void;
  },
) {
  const template = TEMPLATE_OPTIONS.find((entry) => entry.id === templateId);
  if (!template) return;

  setters.setFormat(template.format);
  setters.setContentGoal(template.content_goal);
  setters.setFormatVariant(template.format_variant);
  setters.setHook(template.hook);
  setters.setCta(template.cta);
  setters.setAssetRequirements([...template.asset_requirements]);
}
