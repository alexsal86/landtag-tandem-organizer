import { memo } from "react";
import { Instagram, Facebook, Linkedin, Mail, Twitter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { SocialPlannerItem } from "@/features/redaktion/hooks/useSocialPlannerItems";

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  x: Twitter,
  twitter: Twitter,
  newsletter: Mail,
};

const STATUS_COLORS: Record<string, string> = {
  ideas: "hsl(var(--muted-foreground))",
  in_progress: "hsl(var(--primary))",
  in_review: "hsl(35 90% 50%)",
  approved: "hsl(142 70% 45%)",
  scheduled: "hsl(262 80% 55%)",
  published: "hsl(142 70% 35%)",
};

const STATUS_LABELS: Record<string, string> = {
  ideas: "Idee",
  in_progress: "In Arbeit",
  in_review: "In Freigabe",
  approved: "Freigegeben",
  scheduled: "Geplant",
  published: "Veröffentlicht",
};

interface Props {
  item: SocialPlannerItem;
  onClick?: () => void;
}

export const PlannerPostCard = memo(function PlannerPostCard({ item, onClick }: Props) {
  const time = item.scheduled_for ? format(new Date(item.scheduled_for), "HH:mm") : null;
  const channelSlugs = item.channel_slugs || [];
  const imageUrl = item.image_url;

  return (
    <div
      className="cursor-pointer rounded-md border bg-card p-2 shadow-sm transition-shadow hover:shadow-md text-xs space-y-1.5"
      onClick={onClick}
    >
      {/* Header: channel icons + time */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          {channelSlugs.map((slug) => {
            const Icon = CHANNEL_ICONS[slug];
            return Icon ? <Icon key={slug} className="h-3.5 w-3.5 text-muted-foreground" /> : null;
          })}
        </div>
        <div className="flex items-center gap-1">
          <Badge
            className="h-4 px-1.5 text-[9px] leading-none"
            style={{ backgroundColor: STATUS_COLORS[item.workflow_status], color: "white", border: "none" }}
          >
            {STATUS_LABELS[item.workflow_status] || item.workflow_status}
          </Badge>
          {time && <span className="text-[10px] text-muted-foreground">{time}</span>}
        </div>
      </div>

      {/* Image thumbnail */}
      {imageUrl && (
        <div className="overflow-hidden rounded">
          <img src={imageUrl} alt="" className="h-16 w-full object-cover" />
        </div>
      )}

      {/* Title */}
      <p className="font-semibold leading-tight line-clamp-2">{item.topic}</p>

      {/* Draft text preview */}
      {item.draft_text && (
        <p className="text-muted-foreground line-clamp-2 leading-snug">{item.draft_text}</p>
      )}

      {/* Approval badge */}
      {item.approval_state === "approved" && (
        <Badge className="h-4 px-1.5 text-[9px]" style={{ backgroundColor: "hsl(142 70% 45%)", color: "white", border: "none" }}>
          ✓ Freigegeben
        </Badge>
      )}
    </div>
  );
});
