import { MessageSquare, Mail, Paperclip } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TopicDisplay } from "@/components/topics/TopicSelector";
import { DecisionCardMetaProps } from "./shared";
import { DecisionCardParticipants } from "./DecisionCardParticipants";

export function DecisionCardMeta({ commentCount, decision, onOpenComments, onPreviewAttachment, onPreviewEmail, pendingParticipantNames, summaryItems }: DecisionCardMetaProps) {
  return (
    <div className="border-t border-border/70 pt-3 text-xs text-muted-foreground space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span>{new Date(decision.created_at).toLocaleDateString("de-DE")}</span>
          {decision.creator && <><span>•</span><span>{decision.creator.display_name || "Unbekannt"}</span></>}
          <span>•</span>
          <button onClick={() => onOpenComments(decision.id, decision.title)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
            <MessageSquare className="h-3.5 w-3.5" />
            {commentCount > 0 ? `${commentCount} Kommentar${commentCount !== 1 ? "e" : ""}` : "Kommentar schreiben"}
          </button>

          {(decision.fileAttachments?.length ?? 0) > 0 && (
            <><span>•</span><Popover><PopoverTrigger asChild><button className="flex items-center gap-1 hover:text-foreground transition-colors"><Paperclip className="h-3.5 w-3.5" />{decision.fileAttachments?.length}</button></PopoverTrigger><PopoverContent className="w-72 p-2" onClick={(event) => event.stopPropagation()}><p className="text-xs font-medium mb-1.5">Angehängte Dateien</p><div className="space-y-1">{(decision.fileAttachments || []).map((attachment) => <button key={attachment.id} onClick={() => onPreviewAttachment({ file_path: attachment.file_path, file_name: attachment.file_name })} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded px-1 py-1 transition-colors w-full text-left cursor-pointer"><Paperclip className="h-3 w-3 flex-shrink-0" /><span className="truncate">{attachment.file_name}</span></button>)}</div></PopoverContent></Popover></>
          )}

          {(decision.emailAttachmentCount ?? 0) > 0 && (
            <><span>•</span><Popover><PopoverTrigger asChild><button className="flex items-center gap-1 hover:text-foreground transition-colors"><Mail className="h-3.5 w-3.5" />{decision.emailAttachmentCount}</button></PopoverTrigger><PopoverContent className="w-64 p-2" onClick={(event) => event.stopPropagation()}><p className="text-xs font-medium mb-1.5">Angehängte E-Mails</p><div className="space-y-1">{(decision.emailAttachments || []).map((attachment) => <button key={attachment.id} onClick={() => onPreviewEmail({ file_path: attachment.file_path, file_name: attachment.file_name })} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded px-1 py-0.5 transition-colors w-full text-left cursor-pointer"><Mail className="h-3 w-3 flex-shrink-0" /><span className="truncate">{attachment.file_name}</span></button>)}</div></PopoverContent></Popover></>
          )}
        </div>

        <DecisionCardParticipants decision={decision} pendingParticipantNames={pendingParticipantNames} summaryItems={summaryItems} />
      </div>

      {decision.topicIds && decision.topicIds.length > 0 && <TopicDisplay topicIds={decision.topicIds} maxDisplay={1} />}
    </div>
  );
}
