import {
  Archive,
  CheckCircle,
  ClipboardList,
  Edit,
  Globe,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Star,
  Trash2,
} from "lucide-react";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { QuickAccessMenuItem } from "@/components/shared/QuickAccessMenuItem";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TopicDisplay } from "@/components/topics/TopicSelector";
import { cn } from "@/lib/utils";
import { DecisionCardActivity } from "./DecisionCardActivity";
import { TaskDecisionResponse } from "./TaskDecisionResponse";
import { TruncatedDescription } from "./TruncatedDescription";
import { getAvatarParticipants, getBorderColor, getResponseSummary } from "./utils/decisionOverview";
import type { DecisionRequest } from "./utils/decisionOverview";

interface AttachmentFile {
  id: string;
  file_name: string;
  file_path: string;
}

interface DecisionCompactCardProps {
  decision: DecisionRequest;
  highlightRef: (id: string) => React.RefCallback<HTMLDivElement> | null;
  isHighlighted: (id: string) => boolean;
  currentUserId: string | undefined;
  creatingTaskFromDecisionId: string | null;
  attachmentFilesByDecision: Record<string, AttachmentFile[]>;
  getCommentCount: (id: string) => number;
  onOpenDetails: (id: string) => void;
  onOpenComments: (id: string, title: string) => void;
  onLoadAttachmentFiles: (id: string) => Promise<void>;
  onPreviewAttachment: (attachment: { file_path: string; file_name: string }) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => Promise<void>;
  onCreateTask: (decision: DecisionRequest) => Promise<void>;
  onResponseSubmitted: () => void;
  onSendCreatorResponse: (
    responseId: string,
    text?: string,
    mode?: "creator_response" | "participant_followup",
  ) => Promise<void>;
}

const getInitials = (name: string | null) => {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
};

export function DecisionCompactCard({
  decision,
  highlightRef,
  isHighlighted,
  currentUserId,
  creatingTaskFromDecisionId,
  attachmentFilesByDecision,
  getCommentCount,
  onOpenDetails,
  onOpenComments,
  onLoadAttachmentFiles,
  onPreviewAttachment,
  onEdit,
  onDelete,
  onArchive,
  onCreateTask,
  onResponseSubmitted,
  onSendCreatorResponse,
}: DecisionCompactCardProps) {
  const summary = getResponseSummary(decision.participants);
  const avatarParticipants = getAvatarParticipants(decision);

  return (
    <Card
      ref={highlightRef(decision.id)}
      className={cn(
        "group border-l-4 hover:bg-muted/50 transition-colors cursor-pointer",
        getBorderColor(decision, summary),
        isHighlighted(decision.id) && "notification-highlight",
      )}
      onClick={() => onOpenDetails(decision.id)}
    >
      <CardContent className="p-4">
        {/* Header: Status badges + Actions */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {summary.questionCount > 0 ? (
              <Badge className="bg-orange-100 hover:bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 text-sm px-3 py-1 font-bold">
                <span className="w-2 h-2 rounded-full bg-orange-500 mr-1.5 inline-block" />
                Rückfrage
              </Badge>
            ) : summary.pending === 0 && summary.total > 0 ? (
              <Badge className="bg-green-100 hover:bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 text-sm px-3 py-1 font-bold">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5 inline-block" />
                Entschieden
              </Badge>
            ) : summary.total > 0 ? (
              <Badge className="bg-blue-100 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 text-sm px-3 py-1 font-bold">
                <span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5 inline-block" />
                Ausstehend
              </Badge>
            ) : null}

            {(decision.priority ?? 0) > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Prioritär</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {decision.visible_to_all && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Globe className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Öffentlich</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {decision.hasResponded && decision.isParticipant && (
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            )}
          </div>

          {decision.isCreator ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <QuickAccessMenuItem
                  id={`decision-${decision.id}`}
                  label={decision.title}
                  icon="Vote"
                  route={`/decisions?highlight=${decision.id}`}
                />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(decision.id);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Bearbeiten
                </DropdownMenuItem>
                {decision.status !== "archived" && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchive(decision.id);
                    }}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Archivieren
                  </DropdownMenuItem>
                )}
                {summary.pending === 0 && decision.participants && decision.participants.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateTask(decision);
                      }}
                      disabled={creatingTaskFromDecisionId === decision.id}
                    >
                      <ClipboardList className="h-4 w-4 mr-2" />
                      {creatingTaskFromDecisionId === decision.id ? "Erstelle..." : "Aufgabe erstellen"}
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(decision.id);
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Endgültig löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <QuickAccessMenuItem
                  id={`decision-${decision.id}`}
                  label={decision.title}
                  icon="Vote"
                  route={`/decisions?highlight=${decision.id}`}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Title + Description */}
        <div className="max-w-[85%]">
          <h3 className="font-bold text-lg mb-1 line-clamp-2">{decision.title}</h3>
          {decision.description && (
            <div onClick={(e) => e.stopPropagation()}>
              <TruncatedDescription content={decision.description} maxLength={300} />
            </div>
          )}
        </div>

        {/* Metadata row */}
        <div className="flex items-center flex-wrap gap-3 mt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            {new Date(decision.created_at).toLocaleDateString("de-DE")}
          </span>

          {decision.response_deadline && (
            <Badge
              variant={new Date(decision.response_deadline) < new Date() ? "destructive" : "secondary"}
              className="gap-1"
            >
              Frist: {new Date(decision.response_deadline).toLocaleDateString("de-DE")}{" "}
              {new Date(decision.response_deadline).toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Badge>
          )}

          {decision.creator && (
            <span className="flex items-center gap-1">
              <span
                className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                style={{ backgroundColor: decision.creator.badge_color || "#888" }}
              >
                {getInitials(decision.creator.display_name)}
              </span>
              <span className="font-medium text-foreground">
                {decision.creator.display_name || "Unbekannt"}
              </span>
            </span>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenComments(decision.id, decision.title);
            }}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {getCommentCount(decision.id) > 0
              ? `${getCommentCount(decision.id)} Kommentar${getCommentCount(decision.id) !== 1 ? "e" : ""}`
              : "Kommentar schreiben"}
          </button>

          {(decision.attachmentCount ?? 0) > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    await onLoadAttachmentFiles(decision.id);
                  }}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  {decision.attachmentCount}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2" onClick={(e) => e.stopPropagation()}>
                <p className="text-xs font-medium mb-1.5">Angehängte Dateien</p>
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {(attachmentFilesByDecision[decision.id] || []).map((att) => (
                    <button
                      key={att.id}
                      onClick={() => onPreviewAttachment({ file_path: att.file_path, file_name: att.file_name })}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded px-1 py-1 transition-colors w-full text-left cursor-pointer"
                    >
                      <Paperclip className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{att.file_name}</span>
                    </button>
                  ))}
                  {(attachmentFilesByDecision[decision.id] || []).length === 0 && (
                    <p className="text-xs text-muted-foreground">Keine Dateiliste verfügbar.</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {decision.topicIds && decision.topicIds.length > 0 && (
            <TopicDisplay topicIds={decision.topicIds} maxDisplay={2} expandable />
          )}
        </div>

        {/* Voting row */}
        {decision.participants && decision.participants.length > 0 && (
          <div className="flex items-start justify-between gap-4 mt-4">
            <div className="flex-1 min-w-0 max-w-3xl" onClick={(e) => e.stopPropagation()}>
              {decision.isParticipant && decision.participant_id && !decision.hasResponded && (
                <TaskDecisionResponse
                  decisionId={decision.id}
                  participantId={decision.participant_id}
                  onResponseSubmitted={onResponseSubmitted}
                  hasResponded={decision.hasResponded}
                  creatorId={decision.created_by}
                />
              )}
            </div>

            <div className="flex items-center gap-3 ml-auto shrink-0">
              <div className="flex flex-col items-end gap-1.5 text-sm font-bold">
                <VotingResults decision={decision} summary={summary} />
              </div>
              <div className="ml-2">
                <AvatarStack participants={avatarParticipants} maxVisible={4} size="sm" />
              </div>
            </div>
          </div>
        )}

        {/* Activity preview */}
        <DecisionCardActivity
          participants={decision.participants}
          maxItems={2}
          isCreator={decision.isCreator}
          currentUserId={currentUserId}
          creatorProfile={
            decision.creator
              ? {
                  display_name: decision.creator.display_name,
                  badge_color: decision.creator.badge_color,
                  avatar_url: decision.creator.avatar_url,
                }
              : undefined
          }
          onReply={({ responseId, text, mode }) => onSendCreatorResponse(responseId, text, mode)}
        />
      </CardContent>
    </Card>
  );
}

// Sub-component for voting results display
interface VotingResultsProps {
  decision: DecisionRequest;
  summary: ReturnType<typeof getResponseSummary>;
}

function VotingResults({ decision, summary }: VotingResultsProps) {
  const responseOptions = decision.response_options;
  const isCustom =
    responseOptions &&
    responseOptions.length > 0 &&
    !(
      ["yes", "no", "question"].every((k: string) => responseOptions.some((o) => o.key === k)) &&
      responseOptions.length <= 3
    );

  if (isCustom) {
    const optionCounts: Record<string, number> = {};
    decision.participants?.forEach((p) => {
      const rt = p.responses[0]?.response_type;
      if (rt) optionCounts[rt] = (optionCounts[rt] || 0) + 1;
    });

    const sortedOptions = [...responseOptions].sort((a, b) => {
      const countDiff = (optionCounts[b.key] || 0) - (optionCounts[a.key] || 0);
      if (countDiff !== 0) return countDiff;
      return (
        responseOptions.findIndex((opt) => opt.key === a.key) -
        responseOptions.findIndex((opt) => opt.key === b.key)
      );
    });

    const winningOption = sortedOptions[0];
    const winningCount = winningOption ? optionCounts[winningOption.key] || 0 : 0;

    if (!winningOption || winningCount === 0) {
      return <span className="text-muted-foreground font-medium">Noch offen</span>;
    }

    const winnerTextColorMap: Record<string, string> = {
      green: "text-green-600",
      red: "text-red-600",
      orange: "text-orange-600",
      yellow: "text-yellow-600",
      blue: "text-blue-600",
      purple: "text-purple-600",
      teal: "text-teal-600",
      pink: "text-pink-600",
      lime: "text-lime-600",
      gray: "text-gray-600",
    };

    return (
      <>
        {summary.pending === 0 && !winningOption.requires_comment && (
          <span
            className={cn(
              "text-lg font-extrabold",
              winnerTextColorMap[winningOption.color || "gray"] || "text-foreground",
            )}
          >
            Ergebnis: {winningOption.label}
          </span>
        )}
        <div className="flex items-center gap-1 flex-wrap justify-end">
          {sortedOptions.map((opt, idx) => {
            const optColor = winnerTextColorMap[opt.color || "gray"] || "text-foreground";
            return (
              <span key={opt.key} className="inline-flex items-center gap-1">
                {idx > 0 && <span className="text-muted-foreground">•</span>}
                <span className={optColor}>{optionCounts[opt.key] || 0}</span>
                <span className={optColor}>{opt.label}</span>
              </span>
            );
          })}
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">{summary.pending} Ausstehend</span>
        </div>
      </>
    );
  }

  return (
    <>
      {summary.pending === 0 && summary.total > 0 && summary.questionCount === 0 && (
        <span
          className={cn(
            "text-lg font-extrabold",
            summary.yesCount >= summary.noCount ? "text-green-600" : "text-red-600",
          )}
        >
          Ergebnis: {summary.yesCount >= summary.noCount ? "Ja" : "Nein"}
        </span>
      )}
      <div className="flex items-center gap-1 flex-wrap justify-end">
        <span className="text-green-600">{summary.yesCount} Ja</span>
        <span className="text-muted-foreground">•</span>
        <span className="text-red-600">{summary.noCount} Nein</span>
        <span className="text-muted-foreground">•</span>
        <span className="text-orange-600">{summary.questionCount} Rückfrage</span>
        {summary.otherCount > 0 && (
          <>
            <span className="text-muted-foreground">•</span>
            <span className="text-blue-600">{summary.otherCount} Sonstige</span>
          </>
        )}
      </div>
    </>
  );
}
