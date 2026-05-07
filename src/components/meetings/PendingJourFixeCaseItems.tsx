import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Briefcase, ChevronDown, Clock, Hourglass } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { debugConsole } from '@/utils/debugConsole';

interface PendingCaseItem {
  id: string;
  subject: string | null;
  status: string;
  priority: string;
  created_at: string;
}

interface PendingJourFixeCaseItemsProps {
  className?: string;
}

const priorityColors: Record<string, string> = {
  dringend: 'text-destructive',
  hoch: 'text-palette-orange',
  mittel: 'text-palette-amber',
  niedrig: 'text-muted-foreground',
};

export function PendingJourFixeCaseItems({ className }: PendingJourFixeCaseItemsProps) {
  const { currentTenant } = useTenant();
  const [items, setItems] = useState<PendingCaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (currentTenant?.id) {
      loadPendingItems();
    }
  }, [currentTenant?.id]);

  const loadPendingItems = async () => {
    if (!currentTenant?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('case_items')
        .select('id, subject, status, priority, created_at')
        .eq('tenant_id', currentTenant.id)
        .eq('pending_for_jour_fixe', true)
        .neq('status', 'erledigt')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems((data || []) as PendingCaseItem[]);
    } catch (error) {
      debugConsole.error('Error loading pending case items:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || items.length === 0) return null;

  return (
    <Card className={cn("border-palette-teal/30 bg-palette-teal/5", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-palette-teal/20/50 transition-colors">
            <CardTitle className="text-base flex items-center gap-2">
              <Hourglass className="h-4 w-4 text-palette-teal" />
              <span className="text-palette-teal">
                Vorgemerkte Vorgänge für nächsten Jour Fixe
              </span>
              <Badge variant="secondary" className="bg-palette-teal/30 text-palette-teal">
                {items.length}
              </Badge>
              <ChevronDown className={cn(
                "h-4 w-4 ml-auto text-palette-teal transition-transform",
                isOpen && "rotate-180"
              )} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-2">
            <p className="text-xs text-palette-teal mb-3">
              Diese Vorgänge wurden für den nächsten Jour Fixe vorgemerkt.
            </p>
            {items.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-white dark:bg-card rounded-md border border-palette-teal/30"
              >
                <div className="flex items-start gap-2">
                  <Briefcase className={cn("h-4 w-4 mt-0.5 shrink-0", priorityColors[item.priority] || 'text-muted-foreground')} />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">
                      {item.subject || '(Kein Betreff)'}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{item.status}</Badge>
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(item.created_at), 'dd.MM.yyyy', { locale: de })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
