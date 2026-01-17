import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { StickyNote, ChevronDown, Clock, Hourglass } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface PendingNote {
  id: string;
  title: string | null;
  content: string;
  created_at: string;
  priority_level?: number;
}

interface PendingJourFixeNotesProps {
  className?: string;
  onNotesLinked?: (count: number) => void;
}

export function PendingJourFixeNotes({ className, onNotesLinked }: PendingJourFixeNotesProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<PendingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadPendingNotes();
    }
  }, [user?.id]);

  const loadPendingNotes = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quick_notes')
        .select('id, title, content, created_at, priority_level')
        .eq('user_id', user.id)
        .eq('pending_for_jour_fixe', true)
        .is('deleted_at', null)
        .order('priority_level', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error loading pending notes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh when notes are linked to a meeting
  useEffect(() => {
    if (onNotesLinked) {
      // Subscribe to real-time updates
      const channel = supabase
        .channel('pending-notes-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'quick_notes',
            filter: `user_id=eq.${user?.id}`
          },
          () => {
            loadPendingNotes();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.id, onNotesLinked]);

  if (loading) {
    return null;
  }

  if (notes.length === 0) {
    return null;
  }

  const getPriorityColor = (level?: number) => {
    switch (level) {
      case 3: return 'text-destructive';
      case 2: return 'text-amber-500';
      case 1: return 'text-blue-500';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <Card className={cn("border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors">
            <CardTitle className="text-base flex items-center gap-2">
              <Hourglass className="h-4 w-4 text-amber-600" />
              <span className="text-amber-800 dark:text-amber-200">
                Vorgemerkte Notizen für nächsten Jour Fixe
              </span>
              <Badge variant="secondary" className="bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200">
                {notes.length}
              </Badge>
              <ChevronDown className={cn(
                "h-4 w-4 ml-auto text-amber-600 transition-transform",
                isOpen && "rotate-180"
              )} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-2">
            <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
              Diese Notizen werden automatisch dem nächsten erstellten Jour Fixe zugeordnet.
            </p>
            {notes.map((note) => (
              <div 
                key={note.id} 
                className="p-3 bg-white dark:bg-card rounded-md border border-amber-200 dark:border-amber-800"
              >
                <div className="flex items-start gap-2">
                  <StickyNote className={cn("h-4 w-4 mt-0.5 shrink-0", getPriorityColor(note.priority_level))} />
                  <div className="flex-1 min-w-0">
                    {note.title && (
                      <h4 className="font-medium text-sm truncate">
                        {note.title}
                      </h4>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {note.content}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(note.created_at), 'dd.MM.yyyy', { locale: de })}
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
