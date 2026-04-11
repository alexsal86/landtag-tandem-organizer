import type { PlannerWorkflowStatus, SocialContentMediaType, SocialContentPlatformStatus } from "@/features/redaktion/hooks/useSocialPlannerItems";

export const STATUS_COLUMNS: Array<{ id: PlannerWorkflowStatus; title: string }> = [
  { id: "ideas", title: "Ideen" },
  { id: "in_progress", title: "In Arbeit" },
  { id: "in_review", title: "In Freigabe" },
  { id: "approved", title: "Freigegeben" },
  { id: "scheduled", title: "Geplant" },
  { id: "published", title: "Veröffentlicht" },
];

export const SORT_OPTIONS = [
  { value: "scheduled", label: "Veröffentlichungsfenster" },
  { value: "topic", label: "Thema" },
  { value: "status", label: "Status" },
  { value: "campaign_phase", label: "Kampagnenphase" },
] as const;

export const CONTENT_PILLAR_OPTIONS = ["informieren", "mobilisieren", "service"] as const;

export const APPROVAL_LABELS: Record<string, string> = {
  draft: "Entwurf",
  pending_approval: "Angefragt",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
};

export const CONTENT_GOAL_OPTIONS = [
  "informieren",
  "mobilisieren",
  "Terminankündigung",
  "Rückblick",
  "Statement",
  "Bürgerdialog",
  "Presse-/Linkhinweis",
];

export const FORMAT_VARIANT_OPTIONS = ["Story", "Carousel", "Reel", "Feed-Post", "Link-Post"];
export const ASSET_OPTIONS = ["Bild nötig", "Video nötig", "Grafik nötig", "Zitatkarte nötig"];

export const FORMAT_VARIANT_CHAR_LIMITS: Record<string, number | null> = {
  "Story": null,
  "Reel": 2200,
  "Carousel": 2200,
  "Feed-Post": 2200,
  "Link-Post": 3000,
};

export const TEMPLATE_OPTIONS = [
  {
    id: "terminankuendigung",
    label: "Terminankündigung",
    content_goal: "Terminankündigung",
    format: "Feed-Post",
    format_variant: "Feed-Post",
    hook: "Schon vormerken: Wir sind vor Ort und freuen uns auf den Austausch.",
    cta: "Termin sichern und vorbeikommen.",
    asset_requirements: ["Bild nötig", "Grafik nötig"],
  },
  {
    id: "rueckblick",
    label: "Rückblick",
    content_goal: "Rückblick",
    format: "Carousel",
    format_variant: "Carousel",
    hook: "Danke für den starken gemeinsamen Termin – das nehmen wir mit.",
    cta: "Eindrücke teilen oder die wichtigsten Punkte nachlesen.",
    asset_requirements: ["Bild nötig", "Grafik nötig"],
  },
  {
    id: "statement",
    label: "Statement",
    content_goal: "Statement",
    format: "Reel",
    format_variant: "Reel",
    hook: "Meine klare Haltung zum Thema in drei Sätzen.",
    cta: "Position unterstützen oder in die Diskussion einsteigen.",
    asset_requirements: ["Video nötig", "Zitatkarte nötig"],
  },
  {
    id: "buergerdialog",
    label: "Bürgerdialog",
    content_goal: "Bürgerdialog",
    format: "Story",
    format_variant: "Story",
    hook: "Welche Fragen aus dem Wahlkreis sollen wir als Nächstes mitnehmen?",
    cta: "Fragen schicken oder direkt zum Gespräch kommen.",
    asset_requirements: ["Bild nötig", "Grafik nötig"],
  },
  {
    id: "presse-linkhinweis",
    label: "Presse-/Linkhinweis",
    content_goal: "Presse-/Linkhinweis",
    format: "Link-Post",
    format_variant: "Link-Post",
    hook: "Neu erschienen: Die wichtigsten Punkte auf einen Blick.",
    cta: "Artikel öffnen und weiterleiten.",
    asset_requirements: ["Grafik nötig", "Zitatkarte nötig"],
  },
] as const;

export const VARIANT_MEDIA_TYPES: Array<{ value: SocialContentMediaType; label: string }> = [
  { value: "image", label: "Bild" },
  { value: "video", label: "Video" },
  { value: "carousel", label: "Carousel" },
  { value: "link", label: "Link" },
  { value: "text", label: "Text" },
];

export const PLATFORM_STATUS_OPTIONS: Array<{ value: SocialContentPlatformStatus; label: string }> = [
  { value: "draft", label: "Entwurf" },
  { value: "ready", label: "Bereit" },
  { value: "scheduled", label: "Geplant" },
  { value: "published", label: "Veröffentlicht" },
  { value: "failed", label: "Fehlgeschlagen" },
];
