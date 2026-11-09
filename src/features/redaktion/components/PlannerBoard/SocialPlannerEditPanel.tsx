import { format } from "date-fns";
import { de } from "date-fns/locale";
import styles from "./SocialPlannerEditPanel.module.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, CheckSquare, ClipboardList, MessageSquare, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/ui/tag-input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
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
  STATUS_COLUMNS,
  TEMPLATE_OPTIONS,
} from "./constants";
import type { SocialPlannerDraftPayload, SocialPlannerTemplateId } from "./types";
import { validateVariant, applyTemplateToState } from "./utils";
import { BriefingGroup } from "./BriefingGroup";
import { ComposerSection } from "./ComposerSection";
import { ImageCropDialog } from "./ImageCropDialog";
import { effectiveCaption } from "@/features/redaktion/utils/plannerRules";
import { HashtagSetPicker } from "./HashtagSetPicker";
import { MarkPublishedDialog } from "./MarkPublishedDialog";
import { AssetLibraryDialog } from "./AssetLibraryDialog";
import { ApprovalCommentsTab } from "./ApprovalCommentsTab";
import { notify } from "@/lib/notify";

export interface SocialPlannerEditPanelProps {
  item: SocialPlannerItem | null;
  open: boolean;
  scrollRequest?: number;
  users: Array<{ id: string; display_name: string }>;
  channels: Array<{ id: string; name: string; slug: string }>;
  campaigns: Array<{ id: string; name: string }>;
  tagSuggestions: string[];
  onOpenChange: (open: boolean) => void;
  onSave: (itemId: string, payload: SocialPlannerDraftPayload) => Promise<void>;
}

export default function SocialPlannerEditPanel({ item, open, scrollRequest = 0, users, channels, campaigns, tagSuggestions, onOpenChange, onSave }: SocialPlannerEditPanelProps) {
  const { user } = useAuth();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open || !item?.id) return;
    // Wait until the lazy-loaded editor occupies its full space before scrolling.
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, item?.id, scrollRequest]);

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
  const [markPublishedOpen, setMarkPublishedOpen] = useState(false);
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"content" | "approval" | "briefing">("content");
  const [cropSource, setCropSource] = useState<File | string | null>(null);

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

  const uploadImageBlob = useCallback(async (blob: Blob, ext: string) => {
    setUploadingImage(true);
    try {
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const filePath = `${user?.id}/planner-images/${fileName}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, blob, { contentType: blob.type || undefined });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("documents").getPublicUrl(filePath);
      setImageUrl(data.publicUrl);
      notify.success("Bild gespeichert");
    } catch (err) {
      console.error("Image upload error:", err);
      notify.error("Upload fehlgeschlagen", { description: String(err instanceof Error ? err.message : err) });
    } finally {
      setUploadingImage(false);
    }
  }, [user?.id]);

  const pickImageFile = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) setCropSource(file);
    };
    input.click();
  }, []);

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
      notify.error("Thema fehlt", { description: "Bitte ein Thema eintragen."
});
      return;
    }

    const variantErrors = selectedChannels.flatMap((channelId) => {
      const channelSlug = channels.find((channel) => channel.id === channelId)?.slug || "";
      return validateVariant(variantsByChannel[channelId], channelSlug).map((error) => `${channels.find((channel) => channel.id === channelId)?.name || channelId}: ${error}`);
    });
    if (variantErrors.length > 0) {
      notify.error("Varianten unvollständig", { description: variantErrors[0]
});
      return;
    }

    try {
      setIsSaving(true);

      // Hashtag auto-placement per channel: appended to caption OR moved to first comment
      const hashtagBlock = hashtags.length > 0 ? hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ") : "";
      const variantsForSave: Record<string, SocialContentVariant> = {};
      Object.entries(variantsByChannel).forEach(([channelId, variant]) => {
        if (!variant) return;
        const channel = channels.find((c) => c.id === channelId);
        const slug = channel?.slug || "";
        // Instagram strategy: hashtags in first comment when toggle on
        const useFirstComment = hashtagsInComment && (slug === "instagram");
        let nextCaption = effectiveCaption(variant.caption, draftText);
        let nextFirstComment = variant.first_comment || "";
        if (hashtagBlock) {
          const captionHasTags = nextCaption.includes(hashtagBlock);
          const fcHasTags = nextFirstComment.includes(hashtagBlock);
          if (useFirstComment) {
            if (captionHasTags) nextCaption = nextCaption.replace(hashtagBlock, "").trimEnd();
            if (!fcHasTags) nextFirstComment = (nextFirstComment ? `${nextFirstComment}\n\n` : "") + hashtagBlock;
          } else {
            if (fcHasTags) nextFirstComment = nextFirstComment.replace(hashtagBlock, "").trimEnd();
            if (!captionHasTags) nextCaption = (nextCaption ? `${nextCaption}\n\n` : "") + hashtagBlock;
          }
        }
        variantsForSave[channelId] = { ...variant, caption: nextCaption, first_comment: nextFirstComment };
      });

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
        variants: variantsForSave,
        campaign_id: campaignId === "none" ? null : campaignId,
        content_pillar: contentPillar === "none" ? null : contentPillar,
      });
      onOpenChange(false);
    } catch {
      notify.error("Änderungen konnten nicht gespeichert werden");
    } finally {
      setIsSaving(false);
    }
  }, [item, topic, tagsValue, selectedChannels, formatValue, contentGoal, formatVariant, assetRequirements, approvalRequired, publishLink, performanceNotes, hookValue, coreMessage, draftText, ctaValue, notesValue, responsibleUserId, scheduledDate, approvalState, workflowStatus, hashtags, hashtagsInComment, altText, imageUrl, variantsByChannel, campaignId, contentPillar, channels, onSave, onOpenChange]);

  if (!open || !item) return null;

  return (
    <>
      <section ref={panelRef} className={cn(styles.editor, "scroll-mt-4 rounded-2xl border bg-card text-card-foreground shadow-sm")}>
        <header className="flex items-start justify-between gap-3 px-6 pt-5">
          <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">Beitrag bearbeiten</h2>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{STATUS_COLUMNS.find((status) => status.id === workflowStatus)?.title}</span>
            {scheduledDate && <span className="rounded-full border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">{format(new Date(scheduledDate), "EEE, d. MMM", { locale: de })}</span>}
          </div>
          <p className="text-sm text-muted-foreground">
            Pflege Inhalte, Kanäle, Briefing und Veröffentlichungsstatus direkt im Social Planner.
          </p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-xl bg-muted/50" aria-label="Bearbeitung schließen" onClick={() => onOpenChange(false)} disabled={isSaving}>
            <X className="h-4 w-4" />
          </Button>
        </header>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "content" | "approval" | "briefing")}>
          <TabsList className={styles.tabs}>
            <TabsTrigger value="content">
              <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Inhalt
            </TabsTrigger>
            <TabsTrigger value="briefing">
              <ClipboardList className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Briefing
            </TabsTrigger>
            <TabsTrigger value="approval">
              <MessageSquare className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Freigabe
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="m-0 space-y-5 px-6 py-5">
          <div className="space-y-4">
            <div className={styles.topicRow}>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="edit-topic">Thema</Label>
              <Input id="edit-topic" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Thema des Beitrags" />
            </div>

            <div className="min-w-0 space-y-2">
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

            </div>
            <div>
              <ComposerSection
                channels={channels}
                masterText={draftText}
                setMasterText={setDraftText}
                masterLimit={FORMAT_VARIANT_CHAR_LIMITS[formatVariant] ?? null}
                selectedChannels={selectedChannels}
                setSelectedChannels={setSelectedChannels}
                activeChannelId={activeVariantChannelId}
                setActiveChannelId={setActiveVariantChannelId}
                variants={variantsByChannel}
                setVariants={setVariantsByChannel}
                hashtags={hashtags}
                hashtagsInComment={hashtagsInComment}
                imageUrl={imageUrl}
                uploadingImage={uploadingImage}
                onPickFile={pickImageFile}
                onOpenLibrary={() => setAssetLibraryOpen(true)}
                onCropExisting={() => imageUrl && setCropSource(imageUrl)}
                onRemoveImage={() => setImageUrl(null)}
              />
            </div>

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
          </div>
          </TabsContent>
          <TabsContent value="briefing" className="m-0 space-y-4 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
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
          </TabsContent>

          <TabsContent value="approval" className="m-0 space-y-4 px-6 py-5">
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
            <ApprovalCommentsTab
              contentItemId={item?.id ?? null}
              responsibleUserId={responsibleUserId === "none" ? null : responsibleUserId}
              topicTitle={topic}
            />
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-card px-6 py-3.5">
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
        </div>
      </section>
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
      <ImageCropDialog
        open={cropSource !== null}
        source={cropSource}
        onOpenChange={(o) => { if (!o) setCropSource(null); }}
        onConfirm={async ({ blob }) => {
          const src = cropSource;
          if (blob) await uploadImageBlob(blob, "jpg");
          else if (src instanceof File) await uploadImageBlob(src, src.name.split(".").pop() || "jpg");
        }}
      />
      <AssetLibraryDialog
        open={assetLibraryOpen}
        onOpenChange={setAssetLibraryOpen}
        onSelect={(url) => setImageUrl(url)}
      />
    </>
  );
}
