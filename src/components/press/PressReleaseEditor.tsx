import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PressReleaseStatusBadge } from "./PressReleaseStatusBadge";
import { RevisionCommentDialog } from "./RevisionCommentDialog";
import { GhostPublishDialog } from "./GhostPublishDialog";
import { FeatureImagePicker } from "./FeatureImagePicker";
import EnhancedLexicalEditor from "@/components/EnhancedLexicalEditor";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { 
  ArrowLeft, Save, SendHorizonal, Check, X, Globe, 
  AlertTriangle, ExternalLink, Loader2, Mail
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// Auto-generate URL slug from title
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};

interface PressReleaseEditorProps {
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

interface PressRelease {
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

export function PressReleaseEditor({ pressReleaseId, initialDraft, onBack }: PressReleaseEditorProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const [pressRelease, setPressRelease] = useState<PressRelease | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contentNodes, setContentNodes] = useState<string | undefined>(undefined);
  const [contentHtml, setContentHtml] = useState<string>("");
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

  // Dialog states
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [showGhostDialog, setShowGhostDialog] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const pendingMentionsRef = useRef<Set<string>>(new Set());

  // Check admin role
  useEffect(() => {
    if (user) {
      supabase.rpc('is_admin', { _user_id: user.id }).then(({ data }) => {
        setIsAdmin(!!data);
      });
    }
  }, [user]);

  // Load press release
  useEffect(() => {
    if (pressReleaseId) {
      loadPressRelease(pressReleaseId);
    }
  }, [pressReleaseId]);

  // Load default tags for new press releases
  useEffect(() => {
    if (!pressReleaseId && currentTenant) {
      supabase
        .from('app_settings')
        .select('setting_value')
        .eq('tenant_id', currentTenant.id)
        .eq('setting_key', 'press_default_tags')
        .maybeSingle()
        .then(({ data }) => {
          if (data?.setting_value) {
            setTagsInput(data.setting_value);
          }
        });
    }
  }, [pressReleaseId, currentTenant]);

  useEffect(() => {
    if (pressReleaseId || !initialDraft) return;

    setTitle(initialDraft.title || '');
    setExcerpt(initialDraft.excerpt || '');
    setContentHtml(initialDraft.contentHtml || '');
    if (initialDraft.tags) setTagsInput(initialDraft.tags);
    setWizardMeta({ templateName: initialDraft.templateName, occasionLabel: initialDraft.occasionLabel });
  }, [pressReleaseId, initialDraft]);

  const loadPressRelease = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('press_releases')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      setPressRelease(data);
      setTitle(data.title);
      setContent(data.content || '');
      setContentNodes(data.content_nodes ? JSON.stringify(data.content_nodes) : undefined);
      setContentHtml(data.content_html || '');
      setSlug(data.slug || '');
      setPreviousAutoSlug(data.slug || '');
      setExcerpt(data.excerpt || '');
      setFeatureImageUrl(data.feature_image_url || '');
      setTagsInput((data.tags || []).join(', '));
      setMetaTitle(data.meta_title || '');
      setMetaDescription(data.meta_description || '');

      // Load publisher name if published
      if (data.published_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', data.published_by)
          .maybeSingle();
        setPublisherName(profile?.display_name || 'Unbekannt');
      } else {
        setPublisherName(null);
      }

      // Load email sender name if sent
      if (data.email_sent_by) {
        const { data: senderProfile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', data.email_sent_by)
          .maybeSingle();
        setEmailSenderName(senderProfile?.display_name || 'Unbekannt');
      } else {
        setEmailSenderName(null);
      }
    } catch (error: any) {
      if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
        return;
      }
      toast({
        title: "Fehler beim Laden",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleContentChange = useCallback((newContent: string, newContentNodes?: string, newContentHtml?: string) => {
    setContent(newContent);
    setContentNodes(newContentNodes);
    if (newContentHtml) {
      setContentHtml(newContentHtml);
    }
  }, []);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (!slug || slug === previousAutoSlug) {
      const newSlug = generateSlug(newTitle);
      setSlug(newSlug);
      setPreviousAutoSlug(newSlug);
    }
  };

  const parseTags = (input: string): string[] => {
    return input.split(',').map(t => t.trim()).filter(t => t.length > 0);
  };

  const canEdit = () => {
    if (!pressRelease) return true;
    const status = pressRelease.status;
    if (status === 'draft' || status === 'revision_requested') return true;
    if (status === 'pending_approval' && isAdmin) return false;
    return false;
  };

  const handleSave = async () => {
    if (!user || !currentTenant || !title.trim()) {
      toast({ title: "Titel erforderlich", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const tags = parseTags(tagsInput);
      const data = {
        title: title.trim(),
        content,
        content_html: contentHtml,
        content_nodes: contentNodes ? JSON.parse(contentNodes) : null,
        slug: slug.trim() || null,
        excerpt: excerpt.trim() || null,
        feature_image_url: featureImageUrl.trim() || null,
        tags: tags.length > 0 ? tags : null,
        meta_title: metaTitle.trim() || null,
        meta_description: metaDescription.trim() || null,
      };

      if (pressRelease) {
        const { error } = await supabase
          .from('press_releases')
          .update(data)
          .eq('id', pressRelease.id);

        if (error) throw error;
        
        // Send mention notifications
        if (pendingMentionsRef.current.size > 0 && user) {
          const mentionPromises = Array.from(pendingMentionsRef.current).map(async (mentionedUserId) => {
            if (mentionedUserId === user.id) return;
            try {
              await supabase.rpc('create_notification', {
                user_id_param: mentionedUserId,
                type_name: 'document_mention',
                title_param: 'Erwähnung in Pressemitteilung',
                message_param: `Sie wurden in der Pressemitteilung "${title}" erwähnt`,
                data_param: JSON.stringify({ documentId: pressRelease.id, documentType: 'press_release' }),
                priority_param: 'medium',
              });
            } catch (e) {
              console.error('Failed to send mention notification:', e);
            }
          });
          await Promise.allSettled(mentionPromises);
          pendingMentionsRef.current.clear();
        }

        await loadPressRelease(pressRelease.id);
        toast({ title: "Gespeichert" });
      } else {
        const { data: newPr, error } = await supabase
          .from('press_releases')
          .insert({
            ...data,
            tenant_id: currentTenant.id,
            created_by: user.id,
            status: 'draft',
          })
          .select()
          .single();

        if (error) throw error;
        
        setPressRelease(newPr);
        toast({ title: "Pressemitteilung erstellt" });
      }
    } catch (error: any) {
      if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
        if (pressRelease) {
          setTimeout(async () => {
            await loadPressRelease(pressRelease.id);
          }, 500);
        }
        toast({ title: "Gespeichert" });
        return;
      }
      toast({
        title: "Fehler beim Speichern",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!pressRelease || !user) return;
    
    await handleSave();

    try {
      const { error } = await supabase
        .from('press_releases')
        .update({
          status: 'pending_approval',
          submitted_at: new Date().toISOString(),
          submitted_by: user.id,
          revision_comment: null,
        })
        .eq('id', pressRelease.id);

      if (error) throw error;

      toast({ title: "Zur Freigabe gesendet" });
      await loadPressRelease(pressRelease.id);
    } catch (error: any) {
      if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
        setTimeout(async () => {
          await loadPressRelease(pressRelease.id);
        }, 500);
        toast({ title: "Zur Freigabe gesendet" });
        return;
      }
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleApprove = async () => {
    if (!pressRelease || !user) return;

    try {
      const { error } = await supabase
        .from('press_releases')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .eq('id', pressRelease.id);

      if (error) throw error;

      toast({ title: "Pressemitteilung freigegeben" });
      await loadPressRelease(pressRelease.id);
    } catch (error: any) {
      if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
        setTimeout(async () => {
          await loadPressRelease(pressRelease.id);
        }, 500);
        toast({ title: "Pressemitteilung freigegeben" });
        return;
      }
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRejectWithComment = async (comment: string) => {
    if (!pressRelease || !user) return;

    try {
      const { error } = await supabase
        .from('press_releases')
        .update({
          status: 'revision_requested',
          revision_comment: comment,
          revision_requested_at: new Date().toISOString(),
          revision_requested_by: user.id,
        })
        .eq('id', pressRelease.id);

      if (error) throw error;

      setShowRevisionDialog(false);
      toast({ title: "Zurückgewiesen mit Kommentar" });
      await loadPressRelease(pressRelease.id);
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePublishToGhost = async () => {
    if (!pressRelease) return;

    setIsPublishing(true);
    try {
      const { data, error } = await supabase.functions.invoke('publish-to-ghost', {
        body: { pressReleaseId: pressRelease.id },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.details || data.error);
      }

      setShowGhostDialog(false);
      toast({ 
        title: "Veröffentlicht!", 
        description: "Die Pressemitteilung wurde erfolgreich auf Ghost veröffentlicht." 
      });
      await loadPressRelease(pressRelease.id);
    } catch (error: any) {
      toast({
        title: "Fehler bei der Veröffentlichung",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const status = pressRelease?.status || 'draft';
  const editable = canEdit();

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Zurück zur Liste
        </Button>
        <div className="flex items-center gap-2">
          {pressRelease && <PressReleaseStatusBadge status={status} />}
        </div>
      </div>

      {!pressReleaseId && wizardMeta && (wizardMeta.templateName || wizardMeta.occasionLabel) && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {wizardMeta.occasionLabel ? `Anlass: ${wizardMeta.occasionLabel}` : ''}
          {wizardMeta.occasionLabel && wizardMeta.templateName ? ' · ' : ''}
          {wizardMeta.templateName ? `Vorlage: ${wizardMeta.templateName}` : ''}
        </div>
      )}

      {/* Revision Comment Banner */}
      {pressRelease?.revision_comment && (status === 'revision_requested' || status === 'draft') && (
        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">Überarbeitungskommentar</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">{pressRelease.revision_comment}</p>
            </div>
          </div>
        </div>
      )}

      {/* Published Link with publisher info */}
      {pressRelease?.ghost_post_url && status === 'published' && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Globe className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span className="text-blue-800 dark:text-blue-200 font-medium">Veröffentlicht</span>
              {publisherName && pressRelease?.published_at && (
                <span className="text-sm text-blue-600 dark:text-blue-300">
                  von {publisherName} am {format(new Date(pressRelease.published_at), "dd.MM.yyyy 'um' HH:mm", { locale: de })}
                </span>
              )}
            </div>
            <a 
              href={pressRelease.ghost_post_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline flex items-center gap-1 ml-auto"
            >
              Beitrag ansehen
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Email sent info */}
          {pressRelease?.email_sent_at && (
            <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 border-t border-blue-200 dark:border-blue-700 pt-2">
              <Mail className="h-4 w-4" />
              <span>
                Per E-Mail versandt am {format(new Date(pressRelease.email_sent_at), "dd.MM.yyyy 'um' HH:mm", { locale: de })}
                {emailSenderName && <> von {emailSenderName}</>}
              </span>
            </div>
          )}

          {/* Send via email button */}
          {!pressRelease?.email_sent_at && (
            <div className="border-t border-blue-200 dark:border-blue-700 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-blue-700 border-blue-300 hover:bg-blue-100 dark:text-blue-300 dark:border-blue-600 dark:hover:bg-blue-900"
                onClick={() => {
                  navigate(`/documents?tab=emails&action=compose-press&pressReleaseId=${pressRelease.id}`);
                }}
              >
                <Mail className="h-4 w-4" />
                Per E-Mail an Presse senden
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Main Layout - no separate scroll areas */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Sidebar */}
        <div className="space-y-4 order-2 lg:order-1">
          <div className="space-y-4">
            {/* Metadata */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase">Metadaten</h3>
              
              <div>
                <Label htmlFor="pr-title">Titel *</Label>
                <Input
                  id="pr-title"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Titel der Pressemitteilung"
                  disabled={!editable}
                />
              </div>

              <div>
                <Label htmlFor="pr-slug">URL-Slug</Label>
                <Input
                  id="pr-slug"
                  value={slug}
                  onChange={(e) => { setSlug(e.target.value); setPreviousAutoSlug(''); }}
                  placeholder="url-slug-fuer-ghost"
                  disabled={!editable}
                />
              </div>

              <div>
                <Label htmlFor="pr-excerpt">Kurzfassung / Teaser</Label>
                <Textarea
                  id="pr-excerpt"
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="Kurze Zusammenfassung..."
                  rows={3}
                  disabled={!editable}
                />
              </div>

              <div>
                <Label htmlFor="pr-tags">Tags (kommagetrennt)</Label>
                <Input
                  id="pr-tags"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="Pressemitteilung, Politik, ..."
                  disabled={!editable}
                />
              </div>

              <FeatureImagePicker
                value={featureImageUrl}
                onChange={setFeatureImageUrl}
                disabled={!editable}
              />
            </div>

            <Separator />

            {/* SEO */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase">SEO</h3>
              
              <div>
                <Label htmlFor="pr-meta-title">SEO-Titel</Label>
                <Input
                  id="pr-meta-title"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder="SEO-Titel (max. 60 Zeichen)"
                  disabled={!editable}
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground mt-1">{metaTitle.length}/60</p>
              </div>

              <div>
                <Label htmlFor="pr-meta-desc">SEO-Beschreibung</Label>
                <Textarea
                  id="pr-meta-desc"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="SEO-Beschreibung (max. 160 Zeichen)"
                  rows={2}
                  disabled={!editable}
                  maxLength={160}
                />
                <p className="text-xs text-muted-foreground mt-1">{metaDescription.length}/160</p>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase">Aktionen</h3>
              
              {editable && (
                <Button onClick={handleSave} disabled={saving || !title.trim()} className="w-full gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? "Wird gespeichert..." : "Speichern"}
                </Button>
              )}

              {/* Submit for approval (staff, when draft or revision_requested) */}
              {editable && pressRelease && (status === 'draft' || status === 'revision_requested') && (
                <Button 
                  onClick={handleSubmitForApproval} 
                  variant="outline" 
                  className="w-full gap-2"
                  disabled={saving || !title.trim()}
                >
                  <SendHorizonal className="h-4 w-4" />
                  Zur Freigabe senden
                </Button>
              )}

              {/* Approve (admin, when pending_approval) */}
              {isAdmin && status === 'pending_approval' && (
                <Button onClick={handleApprove} className="w-full gap-2 bg-green-600 hover:bg-green-700">
                  <Check className="h-4 w-4" />
                  Freigeben
                </Button>
              )}

              {/* Reject (admin, when pending_approval) */}
              {isAdmin && status === 'pending_approval' && (
                <Button 
                  onClick={() => setShowRevisionDialog(true)} 
                  variant="outline" 
                  className="w-full gap-2 text-yellow-700 border-yellow-300 hover:bg-yellow-50"
                >
                  <X className="h-4 w-4" />
                  Zurückweisen
                </Button>
              )}

              {/* Publish to Ghost (when approved) */}
              {status === 'approved' && (
                <Button 
                  onClick={() => setShowGhostDialog(true)} 
                  className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Globe className="h-4 w-4" />
                  An Ghost veröffentlichen
                </Button>
              )}

              {/* View on website (when published) */}
              {status === 'published' && pressRelease?.ghost_post_url && (
                <Button 
                  asChild
                  variant="outline" 
                  className="w-full gap-2"
                >
                  <a href={pressRelease.ghost_post_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Auf Webseite ansehen
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="order-1 lg:order-2">
          <EnhancedLexicalEditor
            content={content}
            contentNodes={contentNodes}
            onChange={(newContent, newContentNodes, newContentHtml) => {
              handleContentChange(newContent, newContentNodes, newContentHtml);
            }}
            onMentionInsert={(userId, displayName) => {
              pendingMentionsRef.current.add(userId);
            }}
            placeholder="Schreiben Sie Ihre Pressemitteilung..."
            editable={editable}
          />
        </div>
      </div>

      {/* Dialogs */}
      <RevisionCommentDialog
        isOpen={showRevisionDialog}
        onClose={() => setShowRevisionDialog(false)}
        onSubmit={handleRejectWithComment}
      />

      {pressRelease && (
        <GhostPublishDialog
          isOpen={showGhostDialog}
          onClose={() => setShowGhostDialog(false)}
          onConfirm={handlePublishToGhost}
          isLoading={isPublishing}
          pressRelease={{
            title,
            excerpt: excerpt || null,
            tags: parseTags(tagsInput),
            slug: slug || null,
            meta_title: metaTitle || null,
            meta_description: metaDescription || null,
          }}
        />
      )}
    </div>
  );
}
