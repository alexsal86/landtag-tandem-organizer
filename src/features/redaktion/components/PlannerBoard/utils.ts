import type { SocialContentVariant, SocialPlannerItem } from "@/features/redaktion/hooks/useSocialPlannerItems";
import { effectiveCaption } from "@/features/redaktion/utils/plannerRules";
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

export function validateVariant(variant: SocialContentVariant | undefined, channelSlug: string, masterText = ""): string[] {
  const errors: string[] = [];
  const rules = getChannelRules(channelSlug);
  const caption = effectiveCaption(variant?.caption, masterText);
  if (rules.captionRequired && !caption.trim()) errors.push("Bitte Haupttext oder einen Text für diesen Kanal eingeben.");
  if (caption.length > rules.captionMax) errors.push(`Text überschreitet das Limit (${rules.captionMax} Zeichen).`);
  if ((variant?.first_comment || "").length > rules.firstCommentMax) errors.push(`Erster Kommentar überschreitet das Limit (${rules.firstCommentMax} Zeichen).`);
  if (variant?.media_type && !["image", "video", "carousel", "link", "text"].includes(variant.media_type)) errors.push("Unbekannter Medientyp.");
  if (variant?.platform_status === "published" && !caption.trim()) errors.push("Veröffentlichte Variante braucht einen Text.");
  if (!(variant?.asset_ids || []).every((assetId) => /^[a-zA-Z0-9-_/]+$/.test(assetId))) errors.push("Asset IDs dürfen nur Buchstaben, Zahlen, '-', '_' und '/' enthalten.");
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
