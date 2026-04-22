import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Check, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTodayBriefings } from "../hooks/useTodayBriefings";
import { useMarkBriefingRead } from "../hooks/useMarkBriefingRead";
import type { DailyBriefingWithAuthor } from "../types";

const COLLAPSE_AT = 320;

function BriefingItem({ briefing }: { briefing: DailyBriefingWithAuthor }) {
  const [expanded, setExpanded] = useState(false);
  const markRead = useMarkBriefingRead();
  const tooLong = briefing.content.length > COLLAPSE_AT;
  const visibleContent = expanded || !tooLong
    ? briefing.content
    : briefing.content.slice(0, COLLAPSE_AT) + "…";

  const initials = (briefing.author_display_name ?? "?")
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-opacity",
        briefing.is_read && "opacity-60 bg-muted/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Avatar className="h-9 w-9">
            {briefing.author_avatar_url && (
              <AvatarImage src={briefing.author_avatar_url} alt="" />
            )}
            <AvatarFallback>{initials || "?"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium truncate">
                {briefing.author_display_name ?? "Teammitglied"}
              </p>
              <span className="text-xs text-muted-foreground">
                verfasst {formatDistanceToNow(new Date(briefing.created_at), { locale: de, addSuffix: true })}
              </span>
              {briefing.is_read && (
                <Badge variant="secondary" className="text-[10px]">Gelesen</Badge>
              )}
            </div>
            {briefing.title && (
              <p className="mt-0.5 text-sm font-semibold">{briefing.title}</p>
            )}
          </div>
        </div>
        {!briefing.is_read && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markRead.mutate(briefing.id)}
            disabled={markRead.isPending}
          >
            <Check className="mr-1 h-3.5 w-3.5" /> Gelesen
          </Button>
        )}
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
        {visibleContent}
      </p>
      {tooLong && (
        <Button
          variant="link"
          size="sm"
          className="mt-1 h-auto p-0 text-xs"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              <ChevronUp className="mr-1 h-3 w-3" /> Weniger anzeigen
            </>
          ) : (
            <>
              <ChevronDown className="mr-1 h-3 w-3" /> Mehr anzeigen
            </>
          )}
        </Button>
      )}
    </div>
  );
}

export function TodayBriefingPanel() {
  const { data: briefings, isLoading } = useTodayBriefings();

  if (isLoading) return null;
  if (!briefings || briefings.length === 0) return null;

  // Ungelesene zuerst, gelesene unten
  const sorted = [...briefings].sort((a, b) => {
    if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
    return b.created_at.localeCompare(a.created_at);
  });

  const unreadCount = briefings.filter((b) => !b.is_read).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          Briefing für heute
          {unreadCount > 0 && (
            <Badge variant="default" className="ml-1">{unreadCount} neu</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.map((b) => (
          <BriefingItem key={b.id} briefing={b} />
        ))}
      </CardContent>
    </Card>
  );
}
