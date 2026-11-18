import type { ReactNode } from 'react';
import { Portal as HoverCardPortal } from '@radix-ui/react-hover-card';
import { Info } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

/** Keep provenance readable without widening result tables; the portal avoids scroll clipping. */
export function AnalysisInfo({ label, children }: { label: string; children: ReactNode }) {
  return <HoverCard openDelay={150}>
    <HoverCardTrigger asChild>
      <button type="button" aria-label={label} className="inline-flex rounded-full p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
    </HoverCardTrigger>
    <HoverCardPortal>
      <HoverCardContent className="space-y-2 text-sm font-sans" align="end">{children}</HoverCardContent>
    </HoverCardPortal>
  </HoverCard>;
}
