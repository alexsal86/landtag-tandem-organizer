import styles from "./SocialPlannerEditPanel.module.css";
import type { Dispatch, SetStateAction } from "react";
import { Check, ChevronDown, Crop, Image as ImageIcon, RotateCcw, Scissors, Send, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import type { SocialContentMediaType, SocialContentPlatformStatus, SocialContentVariant } from "@/features/redaktion/hooks/useSocialPlannerItems";
import { effectiveCaption } from "@/features/redaktion/utils/plannerRules";
import { PLATFORM_STATUS_OPTIONS, VARIANT_MEDIA_TYPES } from "./constants";
import { getChannelRules, validateVariant } from "./utils";
import { CharCounter } from "./CharCounter";
import { ChannelPreview } from "./ChannelPreview";

interface Channel { id: string; name: string; slug: string }

interface Props {
  channels: Channel[];
  masterText: string;
  setMasterText: (v: string) => void;
  masterLimit: number | null;
  selectedChannels: string[];
  setSelectedChannels: (ids: string[]) => void;
  activeChannelId: string;
  setActiveChannelId: (id: string) => void;
  variants: Record<string, SocialContentVariant>;
  setVariants: Dispatch<SetStateAction<Record<string, SocialContentVariant>>>;
  hashtags: string[];
  hashtagsInComment: boolean;
  imageUrl: string | null;
  uploadingImage: boolean;
  onPickFile: () => void;
  onOpenLibrary: () => void;
  onCropExisting: () => void;
  onRemoveImage: () => void;
}

export function ComposerSection(props: Props) {
  const {
    channels, masterText, setMasterText, masterLimit, selectedChannels, setSelectedChannels,
    activeChannelId, setActiveChannelId, variants, setVariants, hashtags, hashtagsInComment,
    imageUrl, uploadingImage, onPickFile, onOpenLibrary, onCropExisting, onRemoveImage,
  } = props;

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const activeSlug = activeChannel?.slug || "";
  const rules = getChannelRules(activeSlug);
  const variant = variants[activeChannelId];
  const isCustom = !!variant?.caption?.trim() && variant.caption !== masterText;
  const shownCaption = effectiveCaption(variant?.caption, masterText);

  const patchVariant = (patch: Partial<SocialContentVariant>) =>
    setVariants((current) => ({ ...current, [activeChannelId]: { ...current[activeChannelId], ...patch } }));

  const toggleChannel = (id: string) => {
    if (selectedChannels.includes(id)) setSelectedChannels(selectedChannels.filter((c) => c !== id));
    else { setSelectedChannels([...selectedChannels, id]); setActiveChannelId(id); }
  };

  const pushMasterToAll = () => {
    if (!masterText.trim()) { notify.error("Master-Text ist leer"); return; }
    setVariants((current) => {
      const next = { ...current };
      selectedChannels.forEach((cid) => { next[cid] = { ...next[cid], caption: masterText }; });
      return next;
    });
    notify.success("Master-Text in alle Kanäle übernommen");
  };

  return (
    <div className={styles.composer}>
      <div className="min-w-0 space-y-5">
        {/* 1 — Master */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="composer-master" className={styles.stepLabel}>1 · Mastertext</Label>
            <CharCounter text={masterText} limit={masterLimit} />
          </div>
          <Textarea
            id="composer-master"
            rows={5}
            value={masterText}
            onChange={(e) => setMasterText(e.target.value)}
            placeholder="Kernbotschaft einmal schreiben – die Kanäle übernehmen den Text automatisch."
            className="min-h-32 bg-background"
          />
          <p className="text-xs text-muted-foreground">Gilt als Basis für alle Kanäle</p>
          <div className="space-y-2">
            <Label className="text-caption text-muted-foreground">Bild</Label>
            {imageUrl ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-3">
                <img src={imageUrl} alt="Beitragsbild" className="h-16 w-24 rounded-lg object-cover" />
                <div className="flex flex-wrap gap-1">
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onCropExisting}>
                    <Crop className="mr-1 h-3 w-3" />Zuschneiden
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onRemoveImage}>
                    <X className="mr-1 h-3 w-3" />Entfernen
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="flex-1 border-dashed" onClick={onPickFile} disabled={uploadingImage}>
                  <Upload className="mr-1 h-3.5 w-3.5" />{uploadingImage ? "Lädt…" : "Hochladen"}
                </Button>
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onOpenLibrary}>
                  <ImageIcon className="mr-1 h-3.5 w-3.5" />Bibliothek
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 2 — Channels */}
        <div className="space-y-3">
          <Label className={styles.stepLabel}>2 · Kanäle anpassen</Label>
          <div className="flex flex-wrap gap-1.5">
            {channels.map((c) => {
              const selected = selectedChannels.includes(c.id);
              const active = c.id === activeChannelId && selected;
              const errors = selected ? validateVariant(variants[c.id], c.slug).length : 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => (selected && !active ? setActiveChannelId(c.id) : toggleChannel(c.id))}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-xs transition-colors",
                    active ? "border-primary bg-primary text-primary-foreground"
                      : selected ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-dashed text-muted-foreground hover:bg-muted",
                  )}
                  title={selected ? (active ? "Klicken zum Abwählen" : "Bearbeiten") : "Kanal hinzufügen"}
                >
                  {selected && <Check className="h-3 w-3" />}
                  {c.name}
                  {errors > 0 && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-destructive" aria-label="unvollständig" />}
                </button>
              );
            })}
          </div>

          {selectedChannels.length === 0 || !activeChannel ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Wähle mindestens einen Kanal.</p>
          ) : (
            <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={cn("rounded-full px-2 py-1 text-xs font-medium", isCustom ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>
                  {isCustom ? `Eigener Text für ${activeChannel.name}` : `Übernimmt Master-Text`}
                </span>
                <CharCounter text={shownCaption} limit={rules.captionMax} />
              </div>
              <Textarea
                rows={4}
                value={variant?.caption || ""}
                placeholder={masterText || "Text für diesen Kanal"}
                onChange={(e) => patchVariant({ caption: e.target.value })}
                className="bg-background"
                aria-label={`Text für ${activeChannel.name}`}
              />
              {rules.captionMax && (
                <div className="h-1 overflow-hidden rounded-full bg-border" aria-hidden="true">
                  <div
                    className={cn("h-full rounded-full", shownCaption.length > rules.captionMax ? "bg-destructive" : "bg-primary")}
                    style={{ width: `${Math.min(100, shownCaption.length / rules.captionMax * 100)}%` }}
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => patchVariant({ caption: masterText })}>
                  <RotateCcw className="mr-1 h-3 w-3" />Master übernehmen
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={pushMasterToAll}>
                  <Send className="mr-1 h-3 w-3" />Master in alle Kanäle
                </Button>
                {shownCaption.length > (rules.captionMax ?? Infinity) && rules.captionMax && (
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                    onClick={() => patchVariant({ caption: `${shownCaption.slice(0, rules.captionMax! - 1)}…` })}>
                    <Scissors className="mr-1 h-3 w-3" />Auf {rules.captionMax} kürzen
                  </Button>
                )}
              </div>
              {activeSlug === "instagram" && (
                <div className="space-y-1">
                  <Label className="text-caption text-muted-foreground">Erster Kommentar</Label>
                  <Textarea rows={2} value={variant?.first_comment || ""} onChange={(e) => patchVariant({ first_comment: e.target.value })} className="bg-background" />
                </div>
              )}
              {validateVariant(variant, activeSlug).map((error) => (
                <p key={error} className="text-xs text-destructive">{error}</p>
              ))}
              <details className="group rounded-md border bg-background px-2 py-1.5">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground">
                  <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />Weitere Kanal-Einstellungen
                </summary>
                <div className="mt-2 grid gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={variant?.media_type || "none"} onValueChange={(v) => patchVariant({ media_type: v === "none" ? "" : v as SocialContentMediaType })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Medium" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Medium wählen</SelectItem>
                        {VARIANT_MEDIA_TYPES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={variant?.platform_status || "draft"} onValueChange={(v) => patchVariant({ platform_status: v as SocialContentPlatformStatus })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        {PLATFORM_STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input className="h-8 text-xs" placeholder="Link zum veröffentlichten Beitrag" value={variant?.publish_link || ""} onChange={(e) => patchVariant({ publish_link: e.target.value })} />
                </div>
              </details>
            </div>
          )}
        </div>

      </div>
        {/* 3 — Preview */}
        <div className={styles.preview}>
          <Label className={styles.stepLabel}>3 · Vorschau</Label>
          {activeChannel ? (
            <div className="rounded-[28px] border bg-muted/30 p-2.5">
              <ChannelPreview
              channelSlug={activeSlug}
              channelName={activeChannel.name}
              caption={shownCaption}
              firstComment={variant?.first_comment}
              hashtags={hashtags}
              hashtagsInComment={hashtagsInComment}
              imageUrl={imageUrl}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Vorschau erscheint nach Kanalwahl.</p>
          )}
        </div>
    </div>
  );
}
