import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PressReleaseStatusBadge } from "./PressReleaseStatusBadge";
import { RevisionCommentDialog } from "./RevisionCommentDialog";
import { GhostPublishDialog } from "./GhostPublishDialog";
import { FeatureImagePicker } from "./FeatureImagePicker";
import EnhancedLexicalEditor from "@/components/lexical/EnhancedLexicalEditor";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  ArrowLeft, Save, SendHorizonal, Check, X, Globe,
  AlertTriangle, ExternalLink, Loader2, Mail
} from "lucide-react";
import { usePressReleaseEditor } from "./hooks/usePressReleaseEditor";

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

export function PressReleaseEditor({ pressReleaseId, initialDraft, onBack }: PressReleaseEditorProps) {
  const h = usePressReleaseEditor({ pressReleaseId, initialDraft, onBack });

  if (h.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2"><ArrowLeft className="h-4 w-4" />Zurück zur Liste</Button>
        <div className="flex items-center gap-2">{h.pressRelease && <PressReleaseStatusBadge status={h.status} />}</div>
      </div>

      {!pressReleaseId && h.wizardMeta && (h.wizardMeta.templateName || h.wizardMeta.occasionLabel) && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {h.wizardMeta.occasionLabel ? `Anlass: ${h.wizardMeta.occasionLabel}` : ""}
          {h.wizardMeta.occasionLabel && h.wizardMeta.templateName ? " · " : ""}
          {h.wizardMeta.templateName ? `Vorlage: ${h.wizardMeta.templateName}` : ""}
        </div>
      )}

      {/* Revision Comment Banner */}
      {h.pressRelease?.revision_comment && (h.status === "revision_requested" || h.status === "draft") && (
        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">Überarbeitungskommentar</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">{h.pressRelease.revision_comment}</p>
            </div>
          </div>
        </div>
      )}

      {/* Published Link */}
      {h.pressRelease?.ghost_post_url && h.status === "published" && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Globe className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span className="text-blue-800 dark:text-blue-200 font-medium">Veröffentlicht</span>
              {h.publisherName && h.pressRelease?.published_at && (
                <span className="text-sm text-blue-600 dark:text-blue-300">von {h.publisherName} am {format(new Date(h.pressRelease.published_at), "dd.MM.yyyy 'um' HH:mm", { locale: de })}</span>
              )}
            </div>
            <a href={h.pressRelease.ghost_post_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 ml-auto">
              Beitrag ansehen<ExternalLink className="h-3 w-3" />
            </a>
          </div>
          {h.pressRelease?.email_sent_at && (
            <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 border-t border-blue-200 dark:border-blue-700 pt-2">
              <Mail className="h-4 w-4" />
              <span>Per E-Mail versandt am {format(new Date(h.pressRelease.email_sent_at), "dd.MM.yyyy 'um' HH:mm", { locale: de })}{h.emailSenderName && <> von {h.emailSenderName}</>}</span>
            </div>
          )}
          {!h.pressRelease?.email_sent_at && (
            <div className="border-t border-blue-200 dark:border-blue-700 pt-2">
              <Button variant="outline" size="sm" className="gap-2 text-blue-700 border-blue-300 hover:bg-blue-100 dark:text-blue-300 dark:border-blue-600 dark:hover:bg-blue-900" onClick={() => h.navigate(`/documents?tab=emails&action=compose-press&pressReleaseId=${h.pressRelease!.id}`)}>
                <Mail className="h-4 w-4" />Per E-Mail an Presse senden
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Sidebar */}
        <div className="space-y-4 order-2 lg:order-1">
          <div className="space-y-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase">Metadaten</h3>
              <div><Label htmlFor="pr-title">Titel *</Label><Input id="pr-title" value={h.title} onChange={(e) => h.handleTitleChange(e.target.value)} placeholder="Titel der Pressemitteilung" disabled={!h.editable} /></div>
              <div><Label htmlFor="pr-slug">URL-Slug</Label><Input id="pr-slug" value={h.slug} onChange={(e) => { h.setSlug(e.target.value); h.setPreviousAutoSlug(""); }} placeholder="url-slug-fuer-ghost" disabled={!h.editable} /></div>
              <div><Label htmlFor="pr-excerpt">Kurzfassung / Teaser</Label><Textarea id="pr-excerpt" value={h.excerpt} onChange={(e) => h.setExcerpt(e.target.value)} placeholder="Kurze Zusammenfassung..." rows={3} disabled={!h.editable} /></div>
              <div><Label htmlFor="pr-tags">Tags (kommagetrennt)</Label><Input id="pr-tags" value={h.tagsInput} onChange={(e) => h.setTagsInput(e.target.value)} placeholder="Pressemitteilung, Politik, ..." disabled={!h.editable} /></div>
              <FeatureImagePicker value={h.featureImageUrl} onChange={h.setFeatureImageUrl} disabled={!h.editable} />
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase">SEO</h3>
              <div><Label htmlFor="pr-meta-title">SEO-Titel</Label><Input id="pr-meta-title" value={h.metaTitle} onChange={(e) => h.setMetaTitle(e.target.value)} placeholder="SEO-Titel (max. 60 Zeichen)" disabled={!h.editable} maxLength={60} /><p className="text-xs text-muted-foreground mt-1">{h.metaTitle.length}/60</p></div>
              <div><Label htmlFor="pr-meta-desc">SEO-Beschreibung</Label><Textarea id="pr-meta-desc" value={h.metaDescription} onChange={(e) => h.setMetaDescription(e.target.value)} placeholder="SEO-Beschreibung (max. 160 Zeichen)" rows={2} disabled={!h.editable} maxLength={160} /><p className="text-xs text-muted-foreground mt-1">{h.metaDescription.length}/160</p></div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase">Aktionen</h3>
              {h.editable && <Button onClick={h.handleSave} disabled={h.saving || !h.title.trim()} className="w-full gap-2"><Save className="h-4 w-4" />{h.saving ? "Wird gespeichert..." : "Speichern"}</Button>}
              {h.editable && h.pressRelease && (h.status === "draft" || h.status === "revision_requested") && (
                <Button onClick={h.handleSubmitForApproval} variant="outline" className="w-full gap-2" disabled={h.saving || !h.title.trim()}><SendHorizonal className="h-4 w-4" />Zur Freigabe senden</Button>
              )}
              {h.isAdmin && h.status === "pending_approval" && <Button onClick={h.handleApprove} className="w-full gap-2 bg-green-600 hover:bg-green-700"><Check className="h-4 w-4" />Freigeben</Button>}
              {h.isAdmin && h.status === "pending_approval" && <Button onClick={() => h.setShowRevisionDialog(true)} variant="outline" className="w-full gap-2 text-yellow-700 border-yellow-300 hover:bg-yellow-50"><X className="h-4 w-4" />Zurückweisen</Button>}
              {h.status === "approved" && <Button onClick={() => h.setShowGhostDialog(true)} className="w-full gap-2 bg-blue-600 hover:bg-blue-700"><Globe className="h-4 w-4" />An Ghost veröffentlichen</Button>}
              {h.status === "published" && h.pressRelease?.ghost_post_url && <Button asChild variant="outline" className="w-full gap-2"><a href={h.pressRelease.ghost_post_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Auf Webseite ansehen</a></Button>}
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="order-1 lg:order-2">
          <EnhancedLexicalEditor
            content={h.content}
            contentNodes={h.contentNodes}
            onChange={h.handleContentChange}
            onMentionInsert={(userId) => h.pendingMentionsRef.current.add(userId)}
            placeholder="Schreiben Sie Ihre Pressemitteilung..."
            editable={h.editable}
          />
        </div>
      </div>

      {/* Dialogs */}
      <RevisionCommentDialog isOpen={h.showRevisionDialog} onClose={() => h.setShowRevisionDialog(false)} onSubmit={h.handleRejectWithComment} />
      {h.pressRelease && (
        <GhostPublishDialog
          isOpen={h.showGhostDialog} onClose={() => h.setShowGhostDialog(false)} onConfirm={h.handlePublishToGhost} isLoading={h.isPublishing}
          pressRelease={{ title: h.title, excerpt: h.excerpt || null, tags: h.parseTags(h.tagsInput), slug: h.slug || null, meta_title: h.metaTitle || null, meta_description: h.metaDescription || null }}
        />
      )}
    </div>
  );
}
