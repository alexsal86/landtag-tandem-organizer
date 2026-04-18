import { Heart, MessageCircle, Repeat2, Send, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChannelPreviewProps {
  channelSlug: string;
  channelName: string;
  caption: string;
  firstComment?: string;
  hashtags?: string[];
  hashtagsInComment?: boolean;
  imageUrl?: string | null;
  authorName?: string;
}

function combineCaption(caption: string, hashtags: string[], inComment: boolean) {
  if (inComment || hashtags.length === 0) return caption;
  return `${caption}\n\n${hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ")}`;
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function ChannelPreview({
  channelSlug,
  channelName,
  caption,
  firstComment,
  hashtags = [],
  hashtagsInComment = false,
  imageUrl,
  authorName = "Mein Account",
}: ChannelPreviewProps) {
  const slug = channelSlug.toLowerCase();
  const fullCaption = combineCaption(caption, hashtags, hashtagsInComment);
  const captionForX = truncate(fullCaption, 280);
  const captionForLi = truncate(fullCaption, 3000);

  if (slug === "instagram") {
    return (
      <div className="rounded-md border bg-background text-sm shadow-sm overflow-hidden max-w-sm">
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-pink-500 to-yellow-400" />
          <span className="font-semibold text-xs">{authorName}</span>
        </div>
        {imageUrl ? (
          <img src={imageUrl} alt="" className="aspect-square w-full object-cover" />
        ) : (
          <div className="aspect-square w-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
            Bild fehlt
          </div>
        )}
        <div className="flex items-center gap-3 px-3 py-2">
          <Heart className="h-5 w-5" />
          <MessageCircle className="h-5 w-5" />
          <Send className="h-5 w-5" />
          <Bookmark className="h-5 w-5 ml-auto" />
        </div>
        <div className="px-3 pb-3 text-xs whitespace-pre-wrap">
          <span className="font-semibold">{authorName}</span>{" "}
          {fullCaption || <em className="text-muted-foreground">Caption fehlt</em>}
        </div>
        {hashtagsInComment && hashtags.length > 0 && (
          <div className="px-3 pb-3 text-xs text-muted-foreground border-t pt-2">
            <span className="font-semibold">Erster Kommentar:</span>{" "}
            {hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")}
          </div>
        )}
        {firstComment && !hashtagsInComment && (
          <div className="px-3 pb-3 text-xs text-muted-foreground border-t pt-2">
            <span className="font-semibold">Erster Kommentar:</span> {firstComment}
          </div>
        )}
      </div>
    );
  }

  if (slug === "x" || slug === "twitter") {
    const tooLong = fullCaption.length > 280;
    return (
      <div className="rounded-md border bg-background text-sm p-3 max-w-sm shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-full bg-foreground" />
          <span className="font-semibold text-xs">{authorName}</span>
        </div>
        <p className="text-sm whitespace-pre-wrap">{captionForX || <em className="text-muted-foreground">Caption fehlt</em>}</p>
        {imageUrl && <img src={imageUrl} alt="" className="mt-2 rounded border max-h-48 w-full object-cover" />}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <MessageCircle className="h-4 w-4" />
          <Repeat2 className="h-4 w-4" />
          <Heart className="h-4 w-4" />
        </div>
        <p className={cn("text-[11px] mt-2 tabular-nums", tooLong ? "text-destructive font-medium" : "text-muted-foreground")}>
          {fullCaption.length} / 280 Zeichen
        </p>
      </div>
    );
  }

  if (slug === "linkedin") {
    return (
      <div className="rounded-md border bg-background text-sm p-3 max-w-sm shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-10 w-10 rounded-full bg-blue-600" />
          <div>
            <p className="font-semibold text-xs">{authorName}</p>
            <p className="text-[11px] text-muted-foreground">Beitrag · Jetzt</p>
          </div>
        </div>
        <p className="text-sm whitespace-pre-wrap">{captionForLi || <em className="text-muted-foreground">Caption fehlt</em>}</p>
        {imageUrl && <img src={imageUrl} alt="" className="mt-2 rounded border max-h-56 w-full object-cover" />}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span>👍 Gefällt mir</span>
          <span>💬 Kommentieren</span>
          <span>↗ Teilen</span>
        </div>
      </div>
    );
  }

  if (slug === "facebook") {
    return (
      <div className="rounded-md border bg-background text-sm p-3 max-w-sm shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-10 w-10 rounded-full bg-blue-500" />
          <div>
            <p className="font-semibold text-xs">{authorName}</p>
            <p className="text-[11px] text-muted-foreground">Jetzt · Öffentlich</p>
          </div>
        </div>
        <p className="text-sm whitespace-pre-wrap">{fullCaption || <em className="text-muted-foreground">Caption fehlt</em>}</p>
        {imageUrl && <img src={imageUrl} alt="" className="mt-2 rounded border max-h-56 w-full object-cover" />}
      </div>
    );
  }

  // Fallback (TikTok, YouTube, etc.)
  return (
    <div className="rounded-md border bg-background text-sm p-3 max-w-sm shadow-sm">
      <p className="text-xs font-semibold mb-2">{channelName}</p>
      {imageUrl && <img src={imageUrl} alt="" className="mb-2 rounded border max-h-48 w-full object-cover" />}
      <p className="text-sm whitespace-pre-wrap">{fullCaption || <em className="text-muted-foreground">Caption fehlt</em>}</p>
    </div>
  );
}
