import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronRight, Copy, Mail } from "lucide-react";
import { DecisionSummaryItem } from "../utils";
import { DecisionWinningResponse } from "./shared";

interface DecisionCardResponsesProps {
  appointmentLink: string | null;
  approvalMailText: string | null;
  approvalMailto: string | null;
  copyMailTemplate: (text: string, type: "Zusage" | "Absage") => Promise<void>;
  isAppointmentRequest: boolean;
  onOpenMailLink: (mailtoUrl: string) => void;
  rejectionMailText: string | null;
  rejectionMailto: string | null;
  showInlineSummaryCounts: boolean;
  summaryItems: DecisionSummaryItem[];
  winningResponse: DecisionWinningResponse | null;
}

export function DecisionCardResponses(props: DecisionCardResponsesProps) {
  const { appointmentLink, approvalMailText, approvalMailto, copyMailTemplate, isAppointmentRequest, onOpenMailLink, rejectionMailText, rejectionMailto, showInlineSummaryCounts, summaryItems, winningResponse } = props;

  if (!winningResponse && !showInlineSummaryCounts) return null;

  return (
    <>
      {winningResponse && (
        <div className="flex flex-wrap items-center gap-2">
          <div className={cn("text-lg font-extrabold", winningResponse.textClass)}>Ergebnis: {winningResponse.label}</div>

          {isAppointmentRequest && winningResponse.key === "yes" && appointmentLink && (
            <>
              <span className="text-foreground text-base">–</span>
              <a href={appointmentLink} className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:underline" onClick={(event) => event.stopPropagation()}>Zum Termin<ChevronRight className="h-3.5 w-3.5" /></a>
              <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={(event) => { event.stopPropagation(); if (approvalMailText) { void copyMailTemplate(approvalMailText, "Zusage"); } }} disabled={!approvalMailText}><Copy className="h-3.5 w-3.5 mr-1" />Zusage-Mail</Button>
              <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={(event) => { event.stopPropagation(); if (approvalMailto) { onOpenMailLink(approvalMailto); } }} disabled={!approvalMailto}><Mail className="h-3.5 w-3.5 mr-1" />Mail öffnen</Button>
            </>
          )}

          {isAppointmentRequest && winningResponse.key === "no" && (
            <>
              <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={(event) => { event.stopPropagation(); if (rejectionMailText) { void copyMailTemplate(rejectionMailText, "Absage"); } }} disabled={!rejectionMailText}><Copy className="h-3.5 w-3.5 mr-1" />Absage-Mail</Button>
              <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={(event) => { event.stopPropagation(); if (rejectionMailto) { onOpenMailLink(rejectionMailto); } }} disabled={!rejectionMailto}><Mail className="h-3.5 w-3.5 mr-1" />Mail öffnen</Button>
            </>
          )}
        </div>
      )}

      {showInlineSummaryCounts && (
        <div className="flex flex-col items-start gap-1 text-sm font-semibold">
          {summaryItems.map((item) => (
            <div key={item.key} className="flex items-start gap-1">
              <span className="text-muted-foreground">•</span>
              <span className={item.textClass}>{item.count}</span>
              <span className={item.textClass}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
