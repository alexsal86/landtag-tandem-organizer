import { useState, useEffect, useCallback, useRef } from "react";
import { debugConsole } from '@/utils/debugConsole';
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
};

export interface PressRelease {
  id: string;
  tenant_id: string;
  created_by: string;
  title: string;
  content: string;
  content_html: string | null;
  content_nodes: any;
  slug: string | null;
  excerpt: string | null;
  feature_image_url: string | null;
  tags: string[] | null;
  meta_title: string | null;
  meta_description: string | null;
  status: string;
  revision_comment: string | null;
  ghost_post_id: string | null;
  ghost_post_url: string | null;
  published_at: string | null;
  published_by: string | null;
  email_sent_at: string | null;
  email_sent_by: string | null;
  created_at: string;
  updated_at: string;
}

interface UsePressReleaseEditorProps {
  pressReleaseId?: string | null;
  initialDraft?: {
    title?: string;
    excerpt?: string;
    contentHtml?: string;
    tags?: string;
    templateName?: string;
    occasionLabel?: string;
  } | null;
  onBack: () => void;
}

export function usePressReleaseEditor({ pressReleaseId, initialDraft, onBack }: UsePressReleaseEditorProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdminClaim: isAdmin } = useResolvedUserRole();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const [pressRelease, setPressRelease] = useState<PressRelease | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);

  // Form
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contentNodes, setContentNodes] = useState<string | undefined>(undefined);
  const [contentHtml, setContentHtml] = useState("");
  const [slug, setSlug] = useState("");
  const [previousAutoSlug, setPreviousAutoSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [featureImageUrl, setFeatureImageUrl] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [publisherName, setPublisherName] = useState<string | null>(null);
  const [emailSenderName, setEmailSenderName] = useState<string | null>(null);
  const [wizardMeta, setWizardMeta] = useState<{ templateName?: string; occasionLabel?: string } | null>(null);

  // Dialogs
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [showGhostDialog, setShowGhostDialog] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const pendingMentionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (pressReleaseId) loadPressRelease(pressReleaseId);
  }, [pressReleaseId]);

  useEffect(() => {
    if (!pressReleaseId && currentTenant) {
      supabase
        .from("app_settings")
        .select("setting_value")
        .eq("tenant_id", currentTenant.id)
        .eq("setting_key", "press_default_tags")
        .maybeSingle()
        .then(({ data }) => { if (data?.setting_value) setTagsInput(data.setting_value); });
    }
  }, [pressReleaseId, currentTenant]);

  useEffect(() => {
    if (pressReleaseId || !initialDraft) return;
    setTitle(initialDraft.title || "");
    setExcerpt(initialDraft.excerpt || "");
    setContentHtml(initialDraft.contentHtml || "");
    if (initialDraft.tags) setTagsInput(initialDraft.tags);
    setWizardMeta({ templateName: initialDraft.templateName, occasionLabel: initialDraft.occasionLabel });
  }, [pressReleaseId, initialDraft]);

  const loadPressRelease = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("press_releases").select("id, title, content, content_html, content_nodes, slug, excerpt, feature_image_url, status, tags, tenant_id, created_at, updated_at, published_at, meta_title, meta_description, published_by, email_sent_by, email_sent_at, ghost_post_id, ghost_post_url, created_by").eq("id", id).single();
      if (error) throw error;

      setPressRelease(data);
      setTitle(data.title);
      setContent(data.content || "");
      setContentNodes(data.content_nodes ? JSON.stringify(data.content_nodes) : undefined);
      setContentHtml(data.content_html || "");
      setSlug(data.slug || "");
      setPreviousAutoSlug(data.slug || "");
      setExcerpt(data.excerpt || "");
      setFeatureImageUrl(data.feature_image_url || "");
      setTagsInput((data.tags || []).join(", "));
      setMetaTitle(data.meta_title || "");
      setMetaDescription(data.meta_description || "");

      if (data.published_by) {
        const { data: profile } = await supabase.from("profiles").select("display_name").eq("user_id", data.published_by).maybeSingle();
        setPublisherName(profile?.display_name || "Unbekannt");
      } else setPublisherName(null);

      if (data.email_sent_by) {
        const { data: sp } = await supabase.from("profiles").select("display_name").eq("user_id", data.email_sent_by).maybeSingle();
        setEmailSenderName(sp?.display_name || "Unbekannt");
      } else setEmailSenderName(null);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg?.includes("Failed to fetch") || msg?.includes("NetworkError")) return;
      toast({ title: "Fehler beim Laden", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleContentChange = useCallback(({ plainText, nodesJson, html }: { plainText: string; nodesJson?: string; html?: string }) => {
    setContent(plainText);
    setContentNodes(nodesJson);
    if (html) setContentHtml(html);
  }, []);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (!slug || slug === previousAutoSlug) {
      const newSlug = generateSlug(newTitle);
      setSlug(newSlug);
      setPreviousAutoSlug(newSlug);
    }
  };

  const parseTags = (input: string): string[] => input.split(",").map((t) => t.trim()).filter((t) => t.length > 0);

  const canEdit = () => {
    if (!pressRelease) return true;
    const s = pressRelease.status;
    if (s === "draft" || s === "revision_requested") return true;
    return false;
  };

  const handleSave = async () => {
    if (!user || !currentTenant || !title.trim()) { toast({ title: "Titel erforderlich", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const tags = parseTags(tagsInput);
      const payload = {
        title: title.trim(), content, content_html: contentHtml,
        content_nodes: contentNodes ? JSON.parse(contentNodes) : null,
        slug: slug.trim() || null, excerpt: excerpt.trim() || null,
        feature_image_url: featureImageUrl.trim() || null,
        tags: tags.length > 0 ? tags : null,
        meta_title: metaTitle.trim() || null, meta_description: metaDescription.trim() || null,
      };

      if (pressRelease) {
        const { error } = await supabase.from("press_releases").update(payload).eq("id", pressRelease.id);
        if (error) throw error;

        if (pendingMentionsRef.current.size > 0 && user) {
          const promises = Array.from(pendingMentionsRef.current).map(async (mid) => {
            if (mid === user.id) return;
            try {
              await supabase.rpc("create_notification", {
                user_id_param: mid, type_name: "document_mention",
                title_param: "Erwähnung in Pressemitteilung",
                message_param: `Sie wurden in der Pressemitteilung "${title}" erwähnt`,
                data_param: JSON.stringify({ documentId: pressRelease.id, documentType: "press_release" }),
                priority_param: "medium",
              });
            } catch (e) { debugConsole.error("Failed to send mention notification:", e); }
          });
          await Promise.allSettled(promises);
          pendingMentionsRef.current.clear();
        }

        await loadPressRelease(pressRelease.id);
        setHasUnsyncedChanges(false);
        toast({ title: "Gespeichert" });
      } else {
        const { data: newPr, error } = await supabase
          .from("press_releases")
          .insert([{ ...payload, tenant_id: currentTenant.id, created_by: user.id, status: "draft" }])
          .select().single();
        if (error) throw error;
        setPressRelease(newPr);
        setHasUnsyncedChanges(false);
        toast({ title: "Pressemitteilung erstellt" });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg?.includes("Failed to fetch") || msg?.includes("NetworkError")) {
        setHasUnsyncedChanges(true);
        toast({
          title: "Speicherstatus unsicher",
          description: "Netzwerkfehler: Änderungen sind nur lokal vorhanden. Bitte erneut speichern, sobald die Verbindung wieder stabil ist.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Fehler beim Speichern", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!pressRelease || !user) return;
    await handleSave();
    try {
      const { error } = await supabase.from("press_releases").update({ status: "pending_approval", submitted_at: new Date().toISOString(), submitted_by: user.id, revision_comment: null }).eq("id", pressRelease.id);
      if (error) throw error;
      toast({ title: "Zur Freigabe gesendet" });
      await loadPressRelease(pressRelease.id);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg?.includes("Failed to fetch") || msg?.includes("NetworkError")) { setTimeout(() => loadPressRelease(pressRelease.id), 500); toast({ title: "Zur Freigabe gesendet" }); return; }
      toast({ title: "Fehler", description: msg, variant: "destructive" });
    }
  };

  const handleApprove = async () => {
    if (!pressRelease || !user) return;
    try {
      const { error } = await supabase.from("press_releases").update({ status: "approved", approved_at: new Date().toISOString(), approved_by: user.id }).eq("id", pressRelease.id);
      if (error) throw error;
      toast({ title: "Pressemitteilung freigegeben" });
      await loadPressRelease(pressRelease.id);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg?.includes("Failed to fetch") || msg?.includes("NetworkError")) { setTimeout(() => loadPressRelease(pressRelease.id), 500); toast({ title: "Pressemitteilung freigegeben" }); return; }
      toast({ title: "Fehler", description: msg, variant: "destructive" });
    }
  };

  const handleRejectWithComment = async (comment: string) => {
    if (!pressRelease || !user) return;
    try {
      const { error } = await supabase.from("press_releases").update({ status: "revision_requested", revision_comment: comment, revision_requested_at: new Date().toISOString(), revision_requested_by: user.id }).eq("id", pressRelease.id);
      if (error) throw error;
      setShowRevisionDialog(false);
      toast({ title: "Zurückgewiesen mit Kommentar" });
      await loadPressRelease(pressRelease.id);
    } catch (error: unknown) {
      toast({ title: "Fehler", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };

  const handlePublishToGhost = async () => {
    if (!pressRelease) return;
    setIsPublishing(true);
    try {
      const { data, error } = await supabase.functions.invoke("publish-to-ghost", { body: { pressReleaseId: pressRelease.id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.details || data.error);
      setShowGhostDialog(false);
      toast({ title: "Veröffentlicht!", description: "Die Pressemitteilung wurde erfolgreich auf Ghost veröffentlicht." });
      await loadPressRelease(pressRelease.id);
    } catch (error: unknown) {
      toast({ title: "Fehler bei der Veröffentlichung", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setIsPublishing(false);
    }
  };

  const status = pressRelease?.status || "draft";
  const editable = canEdit();

  return {
    navigate, pressRelease, loading, saving, isAdmin,
    title, handleTitleChange, content, contentNodes, contentHtml, handleContentChange,
    slug, setSlug, setPreviousAutoSlug, excerpt, setExcerpt,
    featureImageUrl, setFeatureImageUrl, tagsInput, setTagsInput,
    metaTitle, setMetaTitle, metaDescription, setMetaDescription,
    publisherName, emailSenderName, wizardMeta,
    showRevisionDialog, setShowRevisionDialog, showGhostDialog, setShowGhostDialog, isPublishing,
    pendingMentionsRef, parseTags,
    hasUnsyncedChanges,
    status, editable,
    handleSave, handleSubmitForApproval, handleApprove, handleRejectWithComment, handlePublishToGhost,
    pressReleaseId: pressReleaseId,
  };
}
