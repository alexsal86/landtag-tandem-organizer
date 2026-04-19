import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, CheckSquare, ClipboardList, Eye, Image as ImageIcon, MessageSquare, Pencil, Scissors, Send, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select-simple";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/ui/tag-input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  type SocialContentMediaType,
  type SocialContentPlatformStatus,
  type SocialContentVariant,
  type SocialPlannerItem,
  PlannerWorkflowStatus,
} from "@/features/redaktion/hooks/useSocialPlannerItems";
import { supabase } from "@/integrations/supabase/client";
import {
  APPROVAL_LABELS,
  ASSET_OPTIONS,
  CONTENT_GOAL_OPTIONS,
  CONTENT_PILLAR_OPTIONS,
  FORMAT_VARIANT_CHAR_LIMITS,
  FORMAT_VARIANT_OPTIONS,
  PLATFORM_STATUS_OPTIONS,
  STATUS_COLUMNS,
  TEMPLATE_OPTIONS,
  VARIANT_MEDIA_TYPES,
} from "./constants";
import type { SocialPlannerDraftPayload, SocialPlannerTemplateId } from "./types";
import { getChannelRules, validateVariant, applyTemplateToState } from "./utils";
import { BriefingGroup } from "./BriefingGroup";
import { CharCounter } from "./CharCounter";
import { ChannelPreview } from "./ChannelPreview";
import { HashtagSetPicker } from "./HashtagSetPicker";
import { MarkPublishedDialog } from "./MarkPublishedDialog";
import { AssetLibraryDialog } from "./AssetLibraryDialog";
import { ApprovalCommentsTab } from "./ApprovalCommentsTab";

export interface SocialPlannerEditDialogProps {
  item: SocialPlannerItem | null;
  open: boolean;
  users: Array<{ id: string; display_name: string }>;
  channels: Array<{ id: string; name: string; slug: string }>;
  campaigns: Array<{ id: string; name: string }>;
  tagSuggestions: string[];
  onOpenChange: (open: boolean) => void;
  onSave: (itemId: string, payload: SocialPlannerDraftPayload) => Promise<void>;
}

export default function SocialPlannerEditDialog({ item, open, users, channels, campaigns, tagSuggestions, onOpenChange, onSave }: SocialPlannerEditDialogProps) {
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
  const [showPreview, setShowPreview] = useState(true);
  const [markPublishedOpen, setMarkPublishedOpen] = useState(false);
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"content" | "approval">("content");

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

  const handleSave = useCallback(async () => {
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
  }, [item, topic, tagsValue, selectedChannels, formatValue, contentGoal, formatVariant, assetRequirements, approvalRequired, publishLink, performanceNotes, hookValue, coreMessage, draftText, ctaValue, notesValue, responsibleUserId, scheduledDate, approvalState, workflowStatus, hashtags, hashtagsInComment, altText, imageUrl, variantsByChannel, campaignId, contentPillar, channels, toast, onSave, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Beitrag bearbeiten</DialogTitle>
          <DialogDescription>
            Pflege Inhalte, Kanäle, Briefing und Veröffentlichungsstatus direkt im Social Planner.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "content" | "approval")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="content">Inhalt</TabsTrigger>
            <TabsTrigger value="approval">
              <MessageSquare className="h-3.5 w-3.5 mr-1" /> Freigabe
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4 mt-4">
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
                <div className="flex items-center justify-between gap-2">
                  <Label className="m-0">Kanalvariante bearbeiten</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPreview((v) => !v)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      {showPreview ? "Vorschau aus" : "Vorschau an"}
                    </Button>
                  </div>
                </div>
                <Select value={activeVariantChannelId} onValueChange={setActiveVariantChannelId}>
                  <SelectTrigger><SelectValue placeholder="Kanalvariante wählen" /></SelectTrigger>
                  <SelectContent>
                    {selectedChannels.map((channelId) => {
                      const channel = channels.find((entry) => entry.id === channelId);
                      return <SelectItem key={channelId} value={channelId}>{channel?.name || channelId}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
                {activeVariantChannelId && (() => {
                  const activeChannel = channels.find((c) => c.id === activeVariantChannelId);
                  const activeSlug = activeChannel?.slug || "";
                  const rules = getChannelRules(activeSlug);
                  const variant = variantsByChannel[activeVariantChannelId];
                  return (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className={cn("space-y-3", showPreview ? "md:col-span-1" : "md:col-span-2") }>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Caption</Label>
                        <CharCounter text={variant?.caption || ""} limit={rules.captionMax} />
                      </div>
                      <Textarea
                        rows={4}
                        value={variant?.caption || ""}
                        onChange={(event) => setVariantsByChannel((current) => ({
                          ...current,
                          [activeVariantChannelId]: { ...current[activeVariantChannelId], caption: event.target.value },
                        }))}
                      />
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            const baseCaption = variant?.caption || "";
                            if (!baseCaption.trim()) {
                              toast({ title: "Caption ist leer", variant: "destructive" });
                              return;
                            }
                            setVariantsByChannel((current) => {
                              const next = { ...current };
                              selectedChannels.forEach((cid) => {
                                if (cid !== activeVariantChannelId) {
                                  next[cid] = { ...next[cid], caption: baseCaption };
                                }
                              });
                              return next;
                            });
                            toast({ title: "Caption auf alle Kanäle übernommen" });
                          }}
                        >
                          <Send className="h-3 w-3 mr-1" />Auf alle Kanäle
                        </Button>
                        {(activeSlug === "x" || activeSlug === "twitter") && (variant?.caption.length || 0) > 280 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              const cap = variant?.caption || "";
                              const trimmed = cap.length > 280 ? `${cap.slice(0, 279)}…` : cap;
                              setVariantsByChannel((current) => ({
                                ...current,
                                [activeVariantChannelId]: { ...current[activeVariantChannelId], caption: trimmed },
                              }));
                            }}
                          >
                            <Scissors className="h-3 w-3 mr-1" />Auf 280 kürzen
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>First Comment</Label>
                      <Textarea
                        rows={3}
                        value={variant?.first_comment || ""}
                        onChange={(event) => setVariantsByChannel((current) => ({
                          ...current,
                          [activeVariantChannelId]: { ...current[activeVariantChannelId], first_comment: event.target.value },
                        }))}
                      />
                    </div>
                    <div className="grid gap-3 grid-cols-2">
                    <div className="space-y-2">
                      <Label>Media Type</Label>
                      <Select
                        value={variant?.media_type || "none"}
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
                        value={variant?.platform_status || "draft"}
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
                    </div>
                    <div className="space-y-2">
                      <Label>Publish-Link für diesen Kanal</Label>
                      <Input
                        placeholder="https://…"
                        value={variant?.publish_link || ""}
                        onChange={(event) => setVariantsByChannel((current) => ({
                          ...current,
                          [activeVariantChannelId]: { ...current[activeVariantChannelId], publish_link: event.target.value },
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Asset IDs (Komma-getrennt)</Label>
                      <Input
                        value={(variant?.asset_ids || []).join(", ")}
                        onChange={(event) => setVariantsByChannel((current) => ({
                          ...current,
                          [activeVariantChannelId]: {
                            ...current[activeVariantChannelId],
                            asset_ids: event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                          },
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Platform Metadata (JSON)</Label>
                      <Textarea
                        rows={3}
                        value={JSON.stringify(variant?.platform_metadata || {}, null, 2)}
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
                    <div className="space-y-1">
                      {validateVariant(variant, activeSlug).map((error) => (
                        <p key={error} className="text-xs text-destructive">{error}</p>
                      ))}
                    </div>
                    </div>
                    {showPreview && (
                      <div className="md:col-span-1 space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Vorschau</Label>
                        <ChannelPreview
                          channelSlug={activeSlug}
                          channelName={activeChannel?.name || ""}
                          caption={variant?.caption || ""}
                          firstComment={variant?.first_comment}
                          hashtags={hashtags}
                          hashtagsInComment={hashtagsInComment}
                          imageUrl={imageUrl}
                        />
                      </div>
                    )}
                  </div>
                  );
                })()}
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
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs tabular-nums",
                    hashtags.length > 30 ? "text-destructive font-medium" : "text-muted-foreground",
                  )}>
                    {hashtags.length} / 30 (Instagram-Limit)
                  </span>
                  <HashtagSetPicker currentHashtags={hashtags} onApply={setHashtags} />
                </div>
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
              <div className="flex items-center justify-between">
                <Label>Bild</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setAssetLibraryOpen(true)}
                >
                  <ImageIcon className="h-3.5 w-3.5 mr-1" /> Aus Bibliothek wählen
                </Button>
              </div>
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
          </TabsContent>

          <TabsContent value="approval" className="mt-4">
            <ApprovalCommentsTab
              contentItemId={item?.id ?? null}
              responsibleUserId={responsibleUserId === "none" ? null : responsibleUserId}
              topicTitle={topic}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setMarkPublishedOpen(true)}
            disabled={isSaving}
            className="mr-auto"
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Als veröffentlicht markieren
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Abbrechen</Button>
          <Button onClick={() => void handleSave()} disabled={isSaving}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
      <MarkPublishedDialog
        item={item}
        channels={channels}
        open={markPublishedOpen}
        onOpenChange={setMarkPublishedOpen}
        onConfirm={async ({ publishedAt, perChannelLinks }) => {
          if (!item) return;
          const nextVariants: Record<string, SocialContentVariant> = { ...variantsByChannel };
          Object.entries(perChannelLinks).forEach(([channelId, link]) => {
            if (nextVariants[channelId]) {
              nextVariants[channelId] = {
                ...nextVariants[channelId],
                publish_link: link || null,
                published_at: publishedAt,
                platform_status: "published",
              };
            }
          });
          setVariantsByChannel(nextVariants);
          setWorkflowStatus("published");
          await onSave(item.id, {
            topic: topic.trim(),
            tags: tagsValue,
            channel_ids: selectedChannels,
            format: formatValue.trim() || null,
            content_goal: contentGoal.trim() || null,
            format_variant: formatVariant.trim() || null,
            asset_requirements: assetRequirements,
            approval_required: approvalRequired,
            publish_link: (perChannelLinks[selectedChannels[0]] || publishLink || "").trim() || null,
            performance_notes: performanceNotes.trim() || null,
            hook: hookValue.trim() || null,
            core_message: coreMessage.trim() || null,
            draft_text: draftText.trim() || null,
            cta: ctaValue.trim() || null,
            notes: notesValue.trim() || null,
            responsible_user_id: responsibleUserId === "none" ? null : responsibleUserId,
            scheduled_for: scheduledDate ? new Date(scheduledDate).toISOString() : null,
            approval_state: approvalState,
            workflow_status: "published",
            hashtags,
            hashtags_in_comment: hashtagsInComment,
            alt_text: altText.trim() || null,
            image_url: imageUrl,
            variants: nextVariants,
            campaign_id: campaignId === "none" ? null : campaignId,
            content_pillar: contentPillar === "none" ? null : contentPillar,
          });
        }}
      />
    </Dialog>
  );
}
