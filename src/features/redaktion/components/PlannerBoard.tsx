import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckSquare, ClipboardList, Filter, Image, Pencil, Plus, Upload, X, type LucideIcon } from "lucide-react";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";
import { Kalenderansicht } from "./Kalenderansicht";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select-simple";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/ui/tag-input";
import { cn } from "@/lib/utils";
import { useTenantUsers } from "@/hooks/useTenantUsers";
import { useAuth } from "@/hooks/useAuth";
import {
  type SocialContentMediaType,
  type SocialContentPlatformStatus,
  type SocialContentVariant,
  type SocialPlannerItem,
  PlannerWorkflowStatus,
  useSocialPlannerItems,
} from "@/features/redaktion/hooks/useSocialPlannerItems";
import { useTopicBacklog } from "@/features/redaktion/hooks/useTopicBacklog";
import { usePlannerNotes } from "@/features/redaktion/hooks/usePlannerNotes";
import { useSocialCampaigns } from "@/features/redaktion/hooks/useSocialCampaigns";
import { useToast } from "@/hooks/use-toast";
import type { SpecialDay } from "@/utils/dashboard/specialDays";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";

const STATUS_COLUMNS: Array<{ id: PlannerWorkflowStatus; title: string }> = [
  { id: "ideas", title: "Ideen" },
  { id: "in_progress", title: "In Arbeit" },
  { id: "in_review", title: "In Freigabe" },
  { id: "approved", title: "Freigegeben" },
  { id: "scheduled", title: "Geplant" },
  { id: "published", title: "Veröffentlicht" },
];

const SORT_OPTIONS = [
  { value: "scheduled", label: "Veröffentlichungsfenster" },
  { value: "topic", label: "Thema" },
  { value: "status", label: "Status" },
  { value: "campaign_phase", label: "Kampagnenphase" },
] as const;
const CONTENT_PILLAR_OPTIONS = ["informieren", "mobilisieren", "service"] as const;

const APPROVAL_LABELS: Record<string, string> = {
  draft: "Entwurf",
  pending_approval: "Angefragt",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
};

const CONTENT_GOAL_OPTIONS = [
  "informieren",
  "mobilisieren",
  "Terminankündigung",
  "Rückblick",
  "Statement",
  "Bürgerdialog",
  "Presse-/Linkhinweis",
];

const FORMAT_VARIANT_OPTIONS = ["Story", "Carousel", "Reel", "Feed-Post", "Link-Post"];
const ASSET_OPTIONS = ["Bild nötig", "Video nötig", "Grafik nötig", "Zitatkarte nötig"];

const FORMAT_VARIANT_CHAR_LIMITS: Record<string, number | null> = {
  "Story": null,
  "Reel": 2200,
  "Carousel": 2200,
  "Feed-Post": 2200,
  "Link-Post": 3000,
};

const TEMPLATE_OPTIONS = [
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

type SocialPlannerDraftPayload = {
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
};

const VARIANT_MEDIA_TYPES: Array<{ value: SocialContentMediaType; label: string }> = [
  { value: "image", label: "Bild" },
  { value: "video", label: "Video" },
  { value: "carousel", label: "Carousel" },
  { value: "link", label: "Link" },
  { value: "text", label: "Text" },
];

const PLATFORM_STATUS_OPTIONS: Array<{ value: SocialContentPlatformStatus; label: string }> = [
  { value: "draft", label: "Entwurf" },
  { value: "ready", label: "Bereit" },
  { value: "scheduled", label: "Geplant" },
  { value: "published", label: "Veröffentlicht" },
  { value: "failed", label: "Fehlgeschlagen" },
];

function getChannelRules(slug: string) {
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

function validateVariant(variant: SocialContentVariant | undefined, channelSlug: string): string[] {
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

type SocialPlannerTemplateId = (typeof TEMPLATE_OPTIONS)[number]["id"];
type PlannerFormatFilter = "all" | "story" | "feed";

function inferFormatType(item: SocialPlannerItem): "story" | "feed" | "other" {
  const normalized = [item.format, item.topic, item.draft_text].filter(Boolean).join(" ").toLowerCase();
  if (normalized.includes("story") || normalized.includes("stories")) return "story";
  if (normalized.includes("feed") || normalized.includes("post") || normalized.includes("carousel") || normalized.includes("reel")) return "feed";
  return "other";
}

function applyTemplateToState(
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

function CharCounter({ text, limit }: { text: string; limit: number | null }) {
  const count = text.length;
  if (limit === null) {
    return <span className="text-xs text-muted-foreground">{count} Zeichen</span>;
  }
  const remaining = limit - count;
  return (
    <span className={cn(
      "text-xs tabular-nums",
      remaining < 0 ? "text-destructive font-medium" :
      remaining < 50 ? "text-amber-500" :
      "text-muted-foreground",
    )}>
      {count} / {limit}
    </span>
  );
}

function BriefingGroup({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

interface SocialPlannerEditDialogProps {
  item: SocialPlannerItem | null;
  open: boolean;
  users: Array<{ id: string; display_name: string }>;
  channels: Array<{ id: string; name: string; slug: string }>;
  campaigns: Array<{ id: string; name: string }>;
  tagSuggestions: string[];
  onOpenChange: (open: boolean) => void;
  onSave: (itemId: string, payload: SocialPlannerDraftPayload) => Promise<void>;
}

function SocialPlannerEditDialog({ item, open, users, channels, campaigns, tagSuggestions, onOpenChange, onSave }: SocialPlannerEditDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("none");
  const [topic, setTopic] = useState("");
  const [tagsValue, setTagsValue] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [formatValue, setFormatValue] = useState("");
  const [contentGoal, setContentGoal] = useState("");
  const [formatVariant, setFormatVariant] = useState("");
  const [assetRequirements, setAssetRequirements] = useState<string[]>([]);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [publishLink, setPublishLink] = useState("");
  const [performanceNotes, setPerformanceNotes] = useState("");
  const [hookValue, setHookValue] = useState("");
  const [coreMessage, setCoreMessage] = useState("");
  const [draftText, setDraftText] = useState("");
  const [ctaValue, setCtaValue] = useState("");
  const [notesValue, setNotesValue] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState<string>("none");
  const [scheduledDate, setScheduledDate] = useState("");
  const [approvalState, setApprovalState] = useState("draft");
  const [workflowStatus, setWorkflowStatus] = useState<PlannerWorkflowStatus>("ideas");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagsInComment, setHashtagsInComment] = useState(false);
  const [altText, setAltText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string>("none");
  const [contentPillar, setContentPillar] = useState<string>("none");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeVariantChannelId, setActiveVariantChannelId] = useState<string>("");
  const [variantsByChannel, setVariantsByChannel] = useState<Record<string, SocialContentVariant>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!item) return;

    setSelectedTemplate("none");
    setTopic(item.topic);
    setTagsValue(item.tags || []);
    setSelectedChannels(item.channel_ids);
    setFormatValue(item.format || "");
    setContentGoal(item.content_goal || "");
    setFormatVariant(item.format_variant || item.format || "");
    setAssetRequirements(item.asset_requirements || []);
    setApprovalRequired(item.approval_required ?? true);
    setPublishLink(item.publish_link || "");
    setPerformanceNotes(item.performance_notes || "");
    setHookValue(item.hook || "");
    setCoreMessage(item.core_message || "");
    setDraftText(item.draft_text || "");
    setCtaValue(item.cta || "");
    setNotesValue(item.notes || "");
    setResponsibleUserId(item.responsible_user_id || "none");
    setScheduledDate(item.scheduled_for ? item.scheduled_for.slice(0, 16) : "");
    setApprovalState(item.approval_state || "draft");
    setWorkflowStatus(item.workflow_status);
    setHashtags(item.hashtags || []);
    setHashtagsInComment(item.hashtags_in_comment ?? false);
    setAltText(item.alt_text || "");
    setImageUrl(item.image_url || null);
    setVariantsByChannel(item.variants || {});
    setActiveVariantChannelId(item.channel_ids[0] || "");
    setCampaignId(item.campaign_id || "none");
    setContentPillar(item.content_pillar || "none");
  }, [item]);

  useEffect(() => {
    setVariantsByChannel((current) => {
      const next: Record<string, SocialContentVariant> = {};
      selectedChannels.forEach((channelId) => {
        next[channelId] = current[channelId] || {
          channel_id: channelId,
          caption: draftText || "",
          first_comment: "",
          media_type: "",
          asset_ids: [],
          platform_metadata: {},
          platform_status: "draft",
        };
      });
      return next;
    });
    setActiveVariantChannelId((current) => (selectedChannels.includes(current) ? current : (selectedChannels[0] || "")));
  }, [draftText, selectedChannels]);

  const channelOptions = useMemo(
    () => channels.map((channel) => ({ value: channel.id, label: channel.name })),
    [channels],
  );

  const handleTemplateChange = (value: string) => {
    setSelectedTemplate(value);
    if (value === "none") return;

    applyTemplateToState(value as SocialPlannerTemplateId, {
      setFormat: setFormatValue,
      setContentGoal,
      setFormatVariant,
      setHook: setHookValue,
      setCta: setCtaValue,
      setAssetRequirements,
    });
  };

  const handleSave = async () => {
    if (!item) return;

    if (!topic.trim()) {
      toast({ title: "Thema fehlt", description: "Bitte ein Thema eintragen.", variant: "destructive" });
      return;
    }

    const variantErrors = selectedChannels.flatMap((channelId) => {
      const channelSlug = channels.find((channel) => channel.id === channelId)?.slug || "";
      return validateVariant(variantsByChannel[channelId], channelSlug).map((error) => `${channels.find((channel) => channel.id === channelId)?.name || channelId}: ${error}`);
    });
    if (variantErrors.length > 0) {
      toast({ title: "Varianten unvollständig", description: variantErrors[0], variant: "destructive" });
      return;
    }

    try {
      setIsSaving(true);
      await onSave(item.id, {
        topic: topic.trim(),
        tags: tagsValue,
        channel_ids: selectedChannels,
        format: formatValue.trim() || null,
        content_goal: contentGoal.trim() || null,
        format_variant: formatVariant.trim() || null,
        asset_requirements: assetRequirements,
        approval_required: approvalRequired,
        publish_link: publishLink.trim() || null,
        performance_notes: performanceNotes.trim() || null,
        hook: hookValue.trim() || null,
        core_message: coreMessage.trim() || null,
        draft_text: draftText.trim() || null,
        cta: ctaValue.trim() || null,
        notes: notesValue.trim() || null,
        responsible_user_id: responsibleUserId === "none" ? null : responsibleUserId,
        scheduled_for: scheduledDate ? new Date(scheduledDate).toISOString() : null,
        approval_state: approvalState,
        workflow_status: workflowStatus,
        hashtags,
        hashtags_in_comment: hashtagsInComment,
        alt_text: altText.trim() || null,
        image_url: imageUrl,
        variants: variantsByChannel,
        campaign_id: campaignId === "none" ? null : campaignId,
        content_pillar: contentPillar === "none" ? null : contentPillar,
      });
      onOpenChange(false);
    } catch {
      toast({ title: "Änderungen konnten nicht gespeichert werden", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Beitrag bearbeiten</DialogTitle>
          <DialogDescription>
            Pflege Inhalte, Kanäle, Briefing und Veröffentlichungsstatus direkt im Social Planner.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-topic">Thema</Label>
              <Input id="edit-topic" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Thema des Beitrags" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Vorlage</Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                <SelectTrigger><SelectValue placeholder="Vorlage anwenden" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Vorlage</SelectItem>
                  {TEMPLATE_OPTIONS.map((template) => (
                    <SelectItem key={template.id} value={template.id}>{template.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Kanäle</Label>
              <MultiSelect
                options={channelOptions}
                selected={selectedChannels}
                onChange={setSelectedChannels}
                placeholder="Kanäle auswählen"
              />
            </div>

            {selectedChannels.length > 0 && (
              <div className="space-y-2 md:col-span-2 rounded-md border p-3">
                <Label>Kanalvariante bearbeiten</Label>
                <Select value={activeVariantChannelId} onValueChange={setActiveVariantChannelId}>
                  <SelectTrigger><SelectValue placeholder="Kanalvariante wählen" /></SelectTrigger>
                  <SelectContent>
                    {selectedChannels.map((channelId) => {
                      const channel = channels.find((entry) => entry.id === channelId);
                      return <SelectItem key={channelId} value={channelId}>{channel?.name || channelId}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
                {activeVariantChannelId && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label>Caption</Label>
                      <Textarea
                        rows={4}
                        value={variantsByChannel[activeVariantChannelId]?.caption || ""}
                        onChange={(event) => setVariantsByChannel((current) => ({
                          ...current,
                          [activeVariantChannelId]: { ...current[activeVariantChannelId], caption: event.target.value },
                        }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>First Comment</Label>
                      <Textarea
                        rows={3}
                        value={variantsByChannel[activeVariantChannelId]?.first_comment || ""}
                        onChange={(event) => setVariantsByChannel((current) => ({
                          ...current,
                          [activeVariantChannelId]: { ...current[activeVariantChannelId], first_comment: event.target.value },
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Media Type</Label>
                      <Select
                        value={variantsByChannel[activeVariantChannelId]?.media_type || "none"}
                        onValueChange={(value) => setVariantsByChannel((current) => ({
                          ...current,
                          [activeVariantChannelId]: { ...current[activeVariantChannelId], media_type: value === "none" ? "" : value as SocialContentMediaType },
                        }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Medium" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Bitte wählen</SelectItem>
                          {VARIANT_MEDIA_TYPES.map((entry) => <SelectItem key={entry.value} value={entry.value}>{entry.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Platform Status</Label>
                      <Select
                        value={variantsByChannel[activeVariantChannelId]?.platform_status || "draft"}
                        onValueChange={(value) => setVariantsByChannel((current) => ({
                          ...current,
                          [activeVariantChannelId]: { ...current[activeVariantChannelId], platform_status: value as SocialContentPlatformStatus },
                        }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                          {PLATFORM_STATUS_OPTIONS.map((entry) => <SelectItem key={entry.value} value={entry.value}>{entry.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Asset IDs (Komma-getrennt)</Label>
                      <Input
                        value={(variantsByChannel[activeVariantChannelId]?.asset_ids || []).join(", ")}
                        onChange={(event) => setVariantsByChannel((current) => ({
                          ...current,
                          [activeVariantChannelId]: {
                            ...current[activeVariantChannelId],
                            asset_ids: event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                          },
                        }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Platform Metadata (JSON)</Label>
                      <Textarea
                        rows={3}
                        value={JSON.stringify(variantsByChannel[activeVariantChannelId]?.platform_metadata || {}, null, 2)}
                        onChange={(event) => {
                          try {
                            const parsed = JSON.parse(event.target.value) as Record<string, unknown>;
                            setVariantsByChannel((current) => ({
                              ...current,
                              [activeVariantChannelId]: { ...current[activeVariantChannelId], platform_metadata: parsed },
                            }));
                          } catch {
                            // handled via inline validation hint below
                          }
                        }}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      {validateVariant(
                        variantsByChannel[activeVariantChannelId],
                        channels.find((channel) => channel.id === activeVariantChannelId)?.slug || "",
                      ).map((error) => (
                        <p key={error} className="text-xs text-destructive">{error}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label>Interne Tags</Label>
              <TagInput
                tags={tagsValue}
                onTagsChange={setTagsValue}
                placeholder="Tag hinzufügen (Enter oder Komma)…"
                suggestions={tagSuggestions}
              />
              <p className="text-xs text-muted-foreground">
                Interne Labels zur Organisation – nicht öffentlich sichtbar.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Kampagne</Label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger><SelectValue placeholder="Kampagne (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Kampagne</SelectItem>
                  {campaigns.map((campaign) => <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Content-Pillar</Label>
              <Select value={contentPillar} onValueChange={setContentPillar}>
                <SelectTrigger><SelectValue placeholder="Pillar (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nicht festgelegt</SelectItem>
                  {CONTENT_PILLAR_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <BriefingGroup title="Wofür ist der Beitrag?" description="Lege Nutzen, Aufhänger und Ziel des Beitrags fest." icon={ClipboardList}>
            <div className="space-y-2">
              <Label>Beitragsziel</Label>
              <Select value={contentGoal || "none"} onValueChange={(value) => setContentGoal(value === "none" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="Ziel wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nicht festgelegt</SelectItem>
                  {CONTENT_GOAL_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-hook">Hook</Label>
              <Input id="edit-hook" value={hookValue} onChange={(event) => setHookValue(event.target.value)} placeholder="Einstieg oder Aufhänger" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-core-message">Kernaussage</Label>
              <Input id="edit-core-message" value={coreMessage} onChange={(event) => setCoreMessage(event.target.value)} placeholder="Was soll hängen bleiben?" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-cta">CTA</Label>
              <Input id="edit-cta" value={ctaValue} onChange={(event) => setCtaValue(event.target.value)} placeholder="z. B. Jetzt kommentieren oder teilen" />
            </div>
          </BriefingGroup>

          <BriefingGroup title="Welches Format ist geplant?" description="Definiere Kanal-Logik und Ausgabeformat für Redaktion und Produktion." icon={Pencil}>
            <div className="space-y-2">
              <Label htmlFor="edit-format">Format</Label>
              <Input id="edit-format" value={formatValue} onChange={(event) => setFormatValue(event.target.value)} placeholder="z. B. Reel, Carousel" />
            </div>

            <div className="space-y-2">
              <Label>Formatvariante</Label>
              <Select value={formatVariant || "none"} onValueChange={(value) => setFormatVariant(value === "none" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="Formatvariante wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nicht festgelegt</SelectItem>
                  {FORMAT_VARIANT_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-draft-text">Entwurfstext</Label>
                <CharCounter text={draftText} limit={FORMAT_VARIANT_CHAR_LIMITS[formatVariant] ?? null} />
              </div>
              <Textarea id="edit-draft-text" rows={6} value={draftText} onChange={(event) => setDraftText(event.target.value)} placeholder="Textentwurf für den Beitrag" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Hashtags</Label>
                <span className={cn(
                  "text-xs tabular-nums",
                  hashtags.length > 30 ? "text-destructive font-medium" : "text-muted-foreground",
                )}>
                  {hashtags.length} / 30 (Instagram-Limit)
                </span>
              </div>
              <TagInput
                tags={hashtags}
                onTagsChange={setHashtags}
                placeholder="#hashtag hinzufügen…"
              />
              <div className="flex items-center gap-2 mt-1">
                <Switch
                  id="hashtags-in-comment"
                  checked={hashtagsInComment}
                  onCheckedChange={setHashtagsInComment}
                />
                <Label htmlFor="hashtags-in-comment" className="text-sm font-normal cursor-pointer">
                  Im ersten Kommentar posten (Instagram-Strategie)
                </Label>
              </div>
            </div>
          </BriefingGroup>

          <BriefingGroup title="Welche Assets werden gebraucht?" description="Halte Materialbedarf für Grafik, Foto, Video und Posting sauber fest." icon={CheckSquare}>
            <div className="space-y-3 md:col-span-2">
              <Label>Asset-Checkliste</Label>
              <div className="grid gap-3 md:grid-cols-2">
                {ASSET_OPTIONS.map((asset) => {
                  const checked = assetRequirements.includes(asset);
                  return (
                    <label key={asset} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(nextChecked) => {
                          setAssetRequirements((current) => nextChecked ? [...current, asset] : current.filter((entry) => entry !== asset));
                        }}
                      />
                      <span>{asset}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 md:col-span-2">
              <Label>Bild hochladen</Label>
              {imageUrl ? (
                <div className="relative inline-block">
                  <img src={imageUrl} alt="Vorschau" className="max-h-40 rounded-md border object-contain" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={() => setImageUrl(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = async () => {
                      const file = input.files?.[0];
                      if (!file) return;
                      setUploadingImage(true);
                      try {
                        const fileExt = file.name.split('.').pop();
                        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
                        const filePath = `${user?.id}/planner-images/${fileName}`;
                        const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
                        if (uploadError) throw uploadError;
                        const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
                        setImageUrl(data.publicUrl);
                        toast({ title: "Bild hochgeladen" });
                      } catch (err) {
                        console.error("Image upload error:", err);
                        toast({ title: "Upload fehlgeschlagen", description: String(err instanceof Error ? err.message : err), variant: "destructive" });
                      } finally {
                        setUploadingImage(false);
                      }
                    };
                    input.click();
                  }}
                >
                  <Upload className="h-4 w-4" />
                  <span>{uploadingImage ? "Wird hochgeladen…" : "Bild auswählen oder hierher ziehen"}</span>
                </div>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-alt-text">Alt-Text / Bildbeschreibung</Label>
              <Textarea
                id="edit-alt-text"
                rows={2}
                value={altText}
                onChange={(event) => setAltText(event.target.value)}
                placeholder="Beschreibung des Bildes für Screenreader und Barrierefreiheit"
              />
              <p className="text-xs text-muted-foreground">
                Pflichtfeld für barrierefreie Veröffentlichungen (WCAG).
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-notes">Interne Notizen</Label>
              <Textarea id="edit-notes" rows={4} value={notesValue} onChange={(event) => setNotesValue(event.target.value)} placeholder="Interne Hinweise, Freigabekommentare oder To-dos" />
            </div>
          </BriefingGroup>

          <BriefingGroup title="Was fehlt noch bis zur Veröffentlichung?" description="Behalte Freigabe, Termin, Link und spätere Learnings gemeinsam im Blick." icon={CalendarDays}>
            <div className="flex items-center justify-between gap-4 rounded-md border p-3 md:col-span-2">
              <div>
                <Label htmlFor="edit-approval-required">Freigabe erforderlich</Label>
                <p className="text-xs text-muted-foreground">Aktiviere dies, wenn der Beitrag vor Veröffentlichung redaktionell freigegeben werden muss.</p>
              </div>
              <Switch id="edit-approval-required" checked={approvalRequired} onCheckedChange={setApprovalRequired} />
            </div>

            <div className="space-y-2">
              <Label>Freigabestatus</Label>
              <Select value={approvalState} onValueChange={setApprovalState}>
                <SelectTrigger><SelectValue placeholder="Freigabestatus wählen" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(APPROVAL_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status im Board</Label>
              <Select value={workflowStatus} onValueChange={(value) => setWorkflowStatus(value as PlannerWorkflowStatus)}>
                <SelectTrigger><SelectValue placeholder="Status wählen" /></SelectTrigger>
                <SelectContent>
                  {STATUS_COLUMNS.map((status) => (
                    <SelectItem key={status.id} value={status.id}>{status.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Verantwortliche Person</Label>
              <Select value={responsibleUserId} onValueChange={setResponsibleUserId}>
                <SelectTrigger><SelectValue placeholder="Person auswählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nicht zugewiesen</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>{user.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-scheduled-for">Veröffentlichungsdatum</Label>
              <Input id="edit-scheduled-for" type="datetime-local" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-publish-link">Publish-Link</Label>
              <Input id="edit-publish-link" value={publishLink} onChange={(event) => setPublishLink(event.target.value)} placeholder="https://…" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-performance-notes">Performance-Notizen</Label>
              <Textarea id="edit-performance-notes" rows={3} value={performanceNotes} onChange={(event) => setPerformanceNotes(event.target.value)} placeholder="z. B. starke Reichweite bei Carousel, CTA im ersten Slide gut funktioniert" />
            </div>
          </BriefingGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Abbrechen</Button>
          <Button onClick={() => void handleSave()} disabled={isSaving}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PlannerBoardProps {
  specialDays?: SpecialDay[];
}

export function PlannerBoard({ specialDays = [] }: PlannerBoardProps) {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { users } = useTenantUsers();
  const { topics, createTopic } = useTopicBacklog();
  const { campaigns } = useSocialCampaigns();
  const { items, channels, loading, updateItem, createItem, deleteItem } = useSocialPlannerItems();
  const { notes, createNote, updateNote, deleteNote } = usePlannerNotes();
  debugConsole.log("[PlannerBoard] render", { hasUsers: !!users, topicsCount: topics?.length, itemsCount: items?.length, channelsCount: channels?.length, loading });

  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formatFilter, setFormatFilter] = useState<PlannerFormatFilter>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [pillarFilter, setPillarFilter] = useState<string>("all");
  const [tagSearch, setTagSearch] = useState("");
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]["value"]>("scheduled");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [createTemplate, setCreateTemplate] = useState<string>("none");
  const [createTopicId, setCreateTopicId] = useState<string>("none");
  const [createTopicTitle, setCreateTopicTitle] = useState("");
  const [createChannelIds, setCreateChannelIds] = useState<string[]>([]);
  const [createFormat, setCreateFormat] = useState("");
  const [createContentGoal, setCreateContentGoal] = useState("");
  const [createFormatVariant, setCreateFormatVariant] = useState("");
  const [createAssetRequirements, setCreateAssetRequirements] = useState<string[]>([]);
  const [createApprovalRequired, setCreateApprovalRequired] = useState(true);
  const [createPublishLink, setCreatePublishLink] = useState("");
  const [createPerformanceNotes, setCreatePerformanceNotes] = useState("");
  const [createHook, setCreateHook] = useState("");
  const [createCoreMessage, setCreateCoreMessage] = useState("");
  const [createDraftText, setCreateDraftText] = useState("");
  const [createCta, setCreateCta] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createResponsibleUserId, setCreateResponsibleUserId] = useState<string>("none");
  const [createApprovalState, setCreateApprovalState] = useState("draft");
  const [createWorkflowStatus, setCreateWorkflowStatus] = useState<PlannerWorkflowStatus>("ideas");
  const [createScheduledDate, setCreateScheduledDate] = useState("");
  const [createVariantsByChannel, setCreateVariantsByChannel] = useState<Record<string, SocialContentVariant>>({});
  const [createActiveVariantChannelId, setCreateActiveVariantChannelId] = useState<string>("");
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [createCampaignId, setCreateCampaignId] = useState<string>("none");
  const [createContentPillar, setCreateContentPillar] = useState<string>("none");

  const editingItem = useMemo(
    () => items.find((item) => item.id === editingItemId) || null,
    [editingItemId, items],
  );
  const deleteCandidate = useMemo(
    () => items.find((item) => item.id === deleteItemId) || null,
    [deleteItemId, items],
  );

  const channelOptions = useMemo(
    () => channels.map((channel) => ({ value: channel.id, label: channel.name })),
    [channels],
  );

  const allTagSuggestions = useMemo(
    () => [...new Set(items.flatMap((item) => item.tags))].sort(),
    [items],
  );

  const filteredItems = useMemo(() => {
    const search = tagSearch.trim().toLowerCase();

    return items
      .filter((item) => {
        if (channelFilter !== "all" && !item.channel_ids.includes(channelFilter)) return false;
        if (ownerFilter !== "all" && item.responsible_user_id !== ownerFilter) return false;
        if (statusFilter !== "all" && item.workflow_status !== statusFilter) return false;
        if (formatFilter !== "all" && inferFormatType(item) !== formatFilter) return false;
        if (campaignFilter !== "all" && item.campaign_id !== campaignFilter) return false;
        if (pillarFilter !== "all" && item.content_pillar !== pillarFilter) return false;
        if (!search) return true;

        return (
          item.topic.toLowerCase().includes(search) ||
          item.tags.some((tag) => tag.toLowerCase().includes(search)) ||
          item.content_goal?.toLowerCase().includes(search) ||
          item.format_variant?.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => {
        if (sortBy === "topic") return a.topic.localeCompare(b.topic);
        if (sortBy === "status") return a.workflow_status.localeCompare(b.workflow_status);
        if (sortBy === "campaign_phase") {
          const getPhaseRank = (item: SocialPlannerItem) => {
            if (!item.campaign_start_date || !item.campaign_end_date) return 3;
            const now = new Date();
            const start = new Date(item.campaign_start_date);
            const end = new Date(item.campaign_end_date);
            if (now < start) return 0;
            if (now > end) return 2;
            return 1;
          };
          return getPhaseRank(a) - getPhaseRank(b);
        }

        const aTime = a.scheduled_for ? new Date(a.scheduled_for).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.scheduled_for ? new Date(b.scheduled_for).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });
  }, [items, channelFilter, ownerFilter, statusFilter, formatFilter, campaignFilter, pillarFilter, tagSearch, sortBy]);

  const handleSaveItem = useCallback(async (itemId: string, payload: SocialPlannerDraftPayload) => {
    await updateItem(itemId, payload);
    toast({ title: "Beitrag aktualisiert", description: "Änderungen sind im Board und Kalender sichtbar." });
  }, [toast, updateItem]);

  const resetCreateDialog = () => {
    setCreateTemplate("none");
    setCreateTopicId("none");
    setCreateTopicTitle("");
    setCreateChannelIds([]);
    setCreateFormat("");
    setCreateContentGoal("");
    setCreateFormatVariant("");
    setCreateAssetRequirements([]);
    setCreateApprovalRequired(true);
    setCreatePublishLink("");
    setCreatePerformanceNotes("");
    setCreateHook("");
    setCreateCoreMessage("");
    setCreateDraftText("");
    setCreateCta("");
    setCreateNotes("");
    setCreateResponsibleUserId("none");
    setCreateApprovalState("draft");
    setCreateWorkflowStatus("ideas");
    setCreateScheduledDate("");
    setCreateVariantsByChannel({});
    setCreateActiveVariantChannelId("");
    setCreateCampaignId("none");
    setCreateContentPillar("none");
  };

  const handleCreateTemplateChange = (value: string) => {
    setCreateTemplate(value);
    if (value === "none") return;

    applyTemplateToState(value as SocialPlannerTemplateId, {
      setFormat: setCreateFormat,
      setContentGoal: setCreateContentGoal,
      setFormatVariant: setCreateFormatVariant,
      setHook: setCreateHook,
      setCta: setCreateCta,
      setAssetRequirements: setCreateAssetRequirements,
    });
  };

  useEffect(() => {
    setCreateVariantsByChannel((current) => {
      const next: Record<string, SocialContentVariant> = {};
      createChannelIds.forEach((channelId) => {
        next[channelId] = current[channelId] || {
          channel_id: channelId,
          caption: createDraftText,
          first_comment: "",
          media_type: "",
          asset_ids: [],
          platform_metadata: {},
          platform_status: "draft",
        };
      });
      return next;
    });
    setCreateActiveVariantChannelId((current) => (createChannelIds.includes(current) ? current : (createChannelIds[0] || "")));
  }, [createChannelIds, createDraftText]);

  const createDraft = async () => {
    const trimmedTopicTitle = createTopicTitle.trim();
    if (createTopicId === "none" && !trimmedTopicTitle) {
      toast({ title: "Bitte Thema auswählen oder neu eingeben", variant: "destructive" });
      return;
    }

    const createVariantErrors = createChannelIds.flatMap((channelId) => {
      const slug = channels.find((channel) => channel.id === channelId)?.slug || "";
      return validateVariant(createVariantsByChannel[channelId], slug);
    });
    if (createVariantErrors.length > 0) {
      toast({ title: "Kanalvarianten prüfen", description: createVariantErrors[0], variant: "destructive" });
      return;
    }

    try {
      setIsCreatingDraft(true);

      let topicBacklogId = createTopicId;
      if (topicBacklogId === "none") {
        const createdTopic = await createTopic({
          topic: trimmedTopicTitle,
          status: "idea",
        });

        if (!createdTopic?.id) {
          throw new Error("topic-create-failed");
        }

        topicBacklogId = createdTopic.id;
      }

      await createItem({
        topic_backlog_id: topicBacklogId,
        workflow_status: createWorkflowStatus,
        approval_state: createApprovalState,
        format: createFormat.trim() || null,
        content_goal: createContentGoal.trim() || null,
        format_variant: createFormatVariant.trim() || null,
        asset_requirements: createAssetRequirements,
        approval_required: createApprovalRequired,
        publish_link: createPublishLink.trim() || null,
        performance_notes: createPerformanceNotes.trim() || null,
        hook: createHook.trim() || null,
        core_message: createCoreMessage.trim() || null,
        draft_text: createDraftText.trim() || null,
        cta: createCta.trim() || null,
        notes: createNotes.trim() || null,
        campaign_id: createCampaignId === "none" ? null : createCampaignId,
        content_pillar: createContentPillar === "none" ? null : createContentPillar,
        responsible_user_id: createResponsibleUserId === "none" ? null : createResponsibleUserId,
        scheduled_for: createScheduledDate ? new Date(`${createScheduledDate}T09:00:00`).toISOString() : null,
        channel_ids: createChannelIds,
        variants: createChannelIds.map((channelId) => createVariantsByChannel[channelId]).filter(Boolean),
      });

      toast({ title: "Entwurf erstellt", description: "Der Beitrag wurde mit Briefing-Feldern im Social Planner angelegt." });
      setIsCreateDialogOpen(false);
      resetCreateDialog();
    } catch {
      toast({ title: "Entwurf konnte nicht erstellt werden", variant: "destructive" });
    } finally {
      setIsCreatingDraft(false);
    }
  };


  const handleDeleteItem = useCallback(async () => {
    if (!deleteItemId) return;

    try {
      await deleteItem(deleteItemId);
      if (editingItemId === deleteItemId) setEditingItemId(null);
      setDeleteItemId(null);
      toast({ title: "Beitrag gelöscht", description: "Der Social-Media-Entwurf wurde aus dem Planner entfernt." });
    } catch {
      toast({ title: "Beitrag konnte nicht gelöscht werden", variant: "destructive" });
    }
  }, [deleteItem, deleteItemId, editingItemId, toast]);

  const clearFilters = () => {
    setChannelFilter("all");
    setOwnerFilter("all");
    setStatusFilter("all");
    setFormatFilter("all");
    setCampaignFilter("all");
    setPillarFilter("all");
    setTagSearch("");
    setSortBy("scheduled");
  };

  const handleCalendarScheduleUpdate = useCallback(async (itemId: string, isoDate: string) => {
    try {
      await updateItem(itemId, { scheduled_for: isoDate } as Parameters<typeof updateItem>[1]);
    } catch {
      toast({ title: "Zeitpunkt konnte nicht geändert werden", variant: "destructive" });
    }
  }, [updateItem, toast]);

  const hasActiveFilters = channelFilter !== "all" || ownerFilter !== "all" || statusFilter !== "all" || formatFilter !== "all" || campaignFilter !== "all" || pillarFilter !== "all" || tagSearch.trim().length > 0 || sortBy !== "scheduled";

  useEffect(() => {
    const highlightId = searchParams.get("highlight");
    if (!highlightId || items.length === 0) return;

    const targetItem = items.find((item) => item.id === highlightId);
    if (!targetItem) return;

    const timeout = window.setTimeout(() => {
      const element = document.querySelector(`[data-social-planner-item-id="${highlightId}"]`);
      if (element instanceof HTMLElement) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("notification-highlight");
        window.setTimeout(() => element.classList.remove("notification-highlight"), 2200);
      }
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [items, searchParams]);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Social Planner</CardTitle>
            <p className="text-xs text-muted-foreground">Redaktionsplanung – von Idee bis Veröffentlichung.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Neuen Inhalt entwerfen
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="relative">
                  <Filter className="mr-1 h-4 w-4" />
                  Filter
                  {hasActiveFilters && (
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 space-y-3" align="end">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Filter & Sortierung</span>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={clearFilters}>
                      Zurücksetzen
                    </Button>
                  )}
                </div>
                <Select value={channelFilter} onValueChange={setChannelFilter}>
                  <SelectTrigger><SelectValue placeholder="Kanal" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Kanäle</SelectItem>
                    {channels.map((channel) => <SelectItem key={channel.id} value={channel.id}>{channel.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                  <SelectTrigger><SelectValue placeholder="Verantwortlich" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Verantwortlichen</SelectItem>
                    {users.map((user) => <SelectItem key={user.id} value={user.id}>{user.display_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    {STATUS_COLUMNS.map((status) => <SelectItem key={status.id} value={status.id}>{status.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={formatFilter} onValueChange={(value) => setFormatFilter(value as PlannerFormatFilter)}>
                  <SelectTrigger><SelectValue placeholder="Format" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Formate</SelectItem>
                    <SelectItem value="story">Nur Stories</SelectItem>
                    <SelectItem value="feed">Nur Feed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                  <SelectTrigger><SelectValue placeholder="Kampagne" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Kampagnen</SelectItem>
                    {campaigns.map((campaign) => <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={pillarFilter} onValueChange={setPillarFilter}>
                  <SelectTrigger><SelectValue placeholder="Content-Pillar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Pillars</SelectItem>
                    {CONTENT_PILLAR_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input value={tagSearch} onChange={(event) => setTagSearch(event.target.value)} placeholder="Thema/Tag suchen" />
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as (typeof SORT_OPTIONS)[number]["value"])}>
                  <SelectTrigger><SelectValue placeholder="Sortierung" /></SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Kalenderansicht
          items={filteredItems}
          onUpdateSchedule={handleCalendarScheduleUpdate}
          onEditItem={setEditingItemId}
          onCreateAtSlot={(date) => {
            resetCreateDialog();
            setCreateScheduledDate(format(date, "yyyy-MM-dd"));
            setIsCreateDialogOpen(true);
          }}
          specialDays={specialDays}
          notes={notes}
          onCreateNote={createNote}
          onUpdateNote={updateNote}
          onDeleteNote={deleteNote}
        />

        {loading && <p className="mt-3 text-xs text-muted-foreground">Lade Social-Planer…</p>}
      </CardContent>

      <SocialPlannerEditDialog
        item={editingItem}
        open={editingItem !== null}
        users={users}
        channels={channels}
        campaigns={campaigns}
        tagSuggestions={allTagSuggestions}
        onOpenChange={(open) => {
          if (!open) setEditingItemId(null);
        }}
        onSave={handleSaveItem}
      />

      <AlertDialog open={!!deleteCandidate} onOpenChange={(open) => { if (!open) setDeleteItemId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Beitrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteCandidate?.topic}" wird aus dem Social Planner entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteItem()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) resetCreateDialog();
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neuen Social-Media-Inhalt entwerfen</DialogTitle>
            <DialogDescription>
              Lege direkt aus dem Planner einen neuen Entwurf an – inklusive redaktionellem Briefing und Vorlagen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Vorlage</Label>
                <Select value={createTemplate} onValueChange={handleCreateTemplateChange}>
                  <SelectTrigger><SelectValue placeholder="Vorlage auswählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Vorlage</SelectItem>
                    {TEMPLATE_OPTIONS.map((template) => (
                      <SelectItem key={template.id} value={template.id}>{template.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Thema</Label>
                <Select value={createTopicId} onValueChange={setCreateTopicId}>
                  <SelectTrigger><SelectValue placeholder="Thema wählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Bitte wählen</SelectItem>
                    {topics.map((topic) => (
                      <SelectItem key={topic.id} value={topic.id}>{topic.topic}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-topic-title">Oder neues Thema</Label>
                <Input
                  id="create-topic-title"
                  value={createTopicTitle}
                  onChange={(event) => setCreateTopicTitle(event.target.value)}
                  placeholder="z. B. Verkehrssicherheit in Karlsruhe"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Kanäle</Label>
                <MultiSelect options={channelOptions} selected={createChannelIds} onChange={setCreateChannelIds} placeholder="Kanäle auswählen" />
              </div>

              {createChannelIds.length > 0 && (
                <div className="space-y-2 md:col-span-2 rounded-md border p-3">
                  <Label>Kanalvariante bearbeiten</Label>
                  <Select value={createActiveVariantChannelId} onValueChange={setCreateActiveVariantChannelId}>
                    <SelectTrigger><SelectValue placeholder="Kanalvariante wählen" /></SelectTrigger>
                    <SelectContent>
                      {createChannelIds.map((channelId) => {
                        const channel = channels.find((entry) => entry.id === channelId);
                        return <SelectItem key={channelId} value={channelId}>{channel?.name || channelId}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                  {createActiveVariantChannelId && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <Label>Caption</Label>
                        <Textarea
                          rows={3}
                          value={createVariantsByChannel[createActiveVariantChannelId]?.caption || ""}
                          onChange={(event) => setCreateVariantsByChannel((current) => ({
                            ...current,
                            [createActiveVariantChannelId]: { ...current[createActiveVariantChannelId], caption: event.target.value },
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Media Type</Label>
                        <Select
                          value={createVariantsByChannel[createActiveVariantChannelId]?.media_type || "none"}
                          onValueChange={(value) => setCreateVariantsByChannel((current) => ({
                            ...current,
                            [createActiveVariantChannelId]: { ...current[createActiveVariantChannelId], media_type: value === "none" ? "" : value as SocialContentMediaType },
                          }))}
                        >
                          <SelectTrigger><SelectValue placeholder="Medium" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Bitte wählen</SelectItem>
                            {VARIANT_MEDIA_TYPES.map((entry) => <SelectItem key={entry.value} value={entry.value}>{entry.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Platform Status</Label>
                        <Select
                          value={createVariantsByChannel[createActiveVariantChannelId]?.platform_status || "draft"}
                          onValueChange={(value) => setCreateVariantsByChannel((current) => ({
                            ...current,
                            [createActiveVariantChannelId]: { ...current[createActiveVariantChannelId], platform_status: value as SocialContentPlatformStatus },
                          }))}
                        >
                          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                          <SelectContent>
                            {PLATFORM_STATUS_OPTIONS.map((entry) => <SelectItem key={entry.value} value={entry.value}>{entry.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        {validateVariant(
                          createVariantsByChannel[createActiveVariantChannelId],
                          channels.find((channel) => channel.id === createActiveVariantChannelId)?.slug || "",
                        ).map((error) => (
                          <p key={error} className="text-xs text-destructive">{error}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label>Kampagne</Label>
                <Select value={createCampaignId} onValueChange={setCreateCampaignId}>
                  <SelectTrigger><SelectValue placeholder="Kampagne (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Kampagne</SelectItem>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Content-Pillar</Label>
                <Select value={createContentPillar} onValueChange={setCreateContentPillar}>
                  <SelectTrigger><SelectValue placeholder="Pillar (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nicht festgelegt</SelectItem>
                    {CONTENT_PILLAR_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <BriefingGroup title="Wofür ist der Beitrag?" description="Vorlagen füllen Hook/CTA an, du kannst sie hier weiter schärfen." icon={ClipboardList}>
              <div className="space-y-2">
                <Label>Beitragsziel</Label>
                <Select value={createContentGoal || "none"} onValueChange={(value) => setCreateContentGoal(value === "none" ? "" : value)}>
                  <SelectTrigger><SelectValue placeholder="Ziel wählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nicht festgelegt</SelectItem>
                    {CONTENT_GOAL_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-hook">Hook</Label>
                <Input id="create-hook" value={createHook} onChange={(event) => setCreateHook(event.target.value)} placeholder="Aufhänger für den Post" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-core-message">Kernaussage</Label>
                <Input id="create-core-message" value={createCoreMessage} onChange={(event) => setCreateCoreMessage(event.target.value)} placeholder="Was soll hängen bleiben?" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-cta">CTA</Label>
                <Input id="create-cta" value={createCta} onChange={(event) => setCreateCta(event.target.value)} placeholder="Handlungsaufforderung" />
              </div>
            </BriefingGroup>

            <BriefingGroup title="Welches Format ist geplant?" description="Plane direkt mit Format- und Kanalentscheidungen für den Entwurf." icon={Pencil}>
              <div className="space-y-2">
                <Label htmlFor="create-format">Format</Label>
                <Input id="create-format" value={createFormat} onChange={(event) => setCreateFormat(event.target.value)} placeholder="z. B. Carousel" />
              </div>

              <div className="space-y-2">
                <Label>Formatvariante</Label>
                <Select value={createFormatVariant || "none"} onValueChange={(value) => setCreateFormatVariant(value === "none" ? "" : value)}>
                  <SelectTrigger><SelectValue placeholder="Formatvariante wählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nicht festgelegt</SelectItem>
                    {FORMAT_VARIANT_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="create-draft-text">Entwurfstext</Label>
                <Textarea id="create-draft-text" value={createDraftText} onChange={(event) => setCreateDraftText(event.target.value)} placeholder="Textentwurf..." rows={4} />
              </div>
            </BriefingGroup>

            <BriefingGroup title="Welche Assets werden gebraucht?" description="Die Vorlagen setzen passende Checklisten für politische Standardfälle." icon={CheckSquare}>
              <div className="space-y-3 md:col-span-2">
                <Label>Asset-Checkliste</Label>
                <div className="grid gap-3 md:grid-cols-2">
                  {ASSET_OPTIONS.map((asset) => {
                    const checked = createAssetRequirements.includes(asset);
                    return (
                      <label key={asset} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(nextChecked) => {
                            setCreateAssetRequirements((current) => nextChecked ? [...current, asset] : current.filter((entry) => entry !== asset));
                          }}
                        />
                        <span>{asset}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="create-notes">Interne Notizen</Label>
                <Textarea id="create-notes" value={createNotes} onChange={(event) => setCreateNotes(event.target.value)} placeholder="Offene Punkte, Asset-Briefing, Abstimmungshinweise" rows={3} />
              </div>
            </BriefingGroup>

            <BriefingGroup title="Was fehlt noch bis zur Veröffentlichung?" description="Organisiere Freigabe, Veröffentlichung und spätere Learnings direkt beim Anlegen." icon={CalendarDays}>
              <div className="flex items-center justify-between gap-4 rounded-md border p-3 md:col-span-2">
                <div>
                  <Label htmlFor="create-approval-required">Freigabe erforderlich</Label>
                  <p className="text-xs text-muted-foreground">Vor Aktivierung von „geplant“ oder „veröffentlicht“ kann hier eine interne Freigabe eingefordert werden.</p>
                </div>
                <Switch id="create-approval-required" checked={createApprovalRequired} onCheckedChange={setCreateApprovalRequired} />
              </div>

              <div className="space-y-2">
                <Label>Freigabestatus</Label>
                <Select value={createApprovalState} onValueChange={setCreateApprovalState}>
                  <SelectTrigger><SelectValue placeholder="Freigabestatus wählen" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(APPROVAL_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status im Board</Label>
                <Select value={createWorkflowStatus} onValueChange={(value) => setCreateWorkflowStatus(value as PlannerWorkflowStatus)}>
                  <SelectTrigger><SelectValue placeholder="Status wählen" /></SelectTrigger>
                  <SelectContent>
                    {STATUS_COLUMNS.map((status) => (
                      <SelectItem key={status.id} value={status.id}>{status.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Verantwortliche Person</Label>
                <Select value={createResponsibleUserId} onValueChange={setCreateResponsibleUserId}>
                  <SelectTrigger><SelectValue placeholder="Person auswählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nicht zugewiesen</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>{user.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-scheduled-date">Veröffentlichungsdatum</Label>
                <Input id="create-scheduled-date" type="date" value={createScheduledDate} onChange={(event) => setCreateScheduledDate(event.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-publish-link">Publish-Link</Label>
                <Input id="create-publish-link" value={createPublishLink} onChange={(event) => setCreatePublishLink(event.target.value)} placeholder="https://…" />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="create-performance-notes">Performance-Notizen</Label>
                <Textarea id="create-performance-notes" value={createPerformanceNotes} onChange={(event) => setCreatePerformanceNotes(event.target.value)} placeholder="Learnings, Benchmarks oder Erwartungen festhalten" rows={3} />
              </div>
            </BriefingGroup>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={() => void createDraft()} disabled={isCreatingDraft || (createTopicId === "none" && createTopicTitle.trim().length === 0)}>Entwurf erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
