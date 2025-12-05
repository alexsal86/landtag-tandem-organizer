import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Briefcase, FolderPlus } from "lucide-react";

interface CaseFileSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (caseFileId: string) => void;
  itemType: 'document' | 'contact' | 'task' | 'appointment' | 'letter';
  itemId: string;
  itemTitle?: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  archived: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

export function CaseFileSelector({
  open,
  onOpenChange,
  onSelect,
  itemType,
  itemId,
  itemTitle,
}: CaseFileSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available case files
  const { data: caseFiles, isLoading } = useQuery({
    queryKey: ['case-files-selector', currentTenant?.id, searchQuery],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      let query = supabase
        .from('case_files')
        .select('id, title, reference_number, status, case_type')
        .eq('tenant_id', currentTenant.id)
        .in('status', ['active', 'pending'])
        .order('updated_at', { ascending: false });
      
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,reference_number.ilike.%${searchQuery}%`);
      }
      
      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!currentTenant?.id,
  });

  // Link item to case file
  const linkMutation = useMutation({
    mutationFn: async (caseFileId: string) => {
      if (!user) throw new Error('No user');
      
      // Insert the link based on item type
      let linkError: any = null;
      
      switch (itemType) {
        case 'document':
          const docResult = await supabase.from('case_file_documents').insert({
            case_file_id: caseFileId,
            document_id: itemId,
          });
          linkError = docResult.error;
          break;
        case 'contact':
          const contactResult = await supabase.from('case_file_contacts').insert({
            case_file_id: caseFileId,
            contact_id: itemId,
            role: 'stakeholder',
          });
          linkError = contactResult.error;
          break;
        case 'task':
          const taskResult = await supabase.from('case_file_tasks').insert({
            case_file_id: caseFileId,
            task_id: itemId,
          });
          linkError = taskResult.error;
          break;
        case 'appointment':
          const apptResult = await supabase.from('case_file_appointments').insert({
            case_file_id: caseFileId,
            appointment_id: itemId,
          });
          linkError = apptResult.error;
          break;
        case 'letter':
          const letterResult = await supabase.from('case_file_letters').insert({
            case_file_id: caseFileId,
            letter_id: itemId,
          });
          linkError = letterResult.error;
          break;
      }
      
      if (linkError) {
        if (linkError.code === '23505') {
          throw new Error('already_linked');
        }
        throw linkError;
      }
      
      // Create timeline entry
      const eventTypeMap: Record<string, string> = {
        document: 'document',
        contact: 'note',
        task: 'note',
        appointment: 'meeting',
        letter: 'correspondence',
      };
      
      const titleMap: Record<string, string> = {
        document: `Dokument hinzugefügt: ${itemTitle || 'Unbekannt'}`,
        contact: `Kontakt verknüpft: ${itemTitle || 'Unbekannt'}`,
        task: `Aufgabe verknüpft: ${itemTitle || 'Unbekannt'}`,
        appointment: `Termin verknüpft: ${itemTitle || 'Unbekannt'}`,
        letter: `Brief verknüpft: ${itemTitle || 'Unbekannt'}`,
      };
      
      await supabase.from('case_file_timeline').insert({
        case_file_id: caseFileId,
        event_date: new Date().toISOString(),
        event_type: eventTypeMap[itemType],
        title: titleMap[itemType],
        source_type: itemType,
        source_id: itemId,
        created_by: user.id,
      });
      
      return caseFileId;
    },
    onSuccess: (caseFileId) => {
      toast({ title: "Zur FallAkte hinzugefügt" });
      queryClient.invalidateQueries({ queryKey: ['case-files'] });
      onSelect(caseFileId);
      onOpenChange(false);
    },
    onError: (error: any) => {
      if (error.message === 'already_linked') {
        toast({ title: "Bereits mit dieser FallAkte verknüpft", variant: "destructive" });
      } else {
        toast({ title: "Fehler beim Hinzufügen", variant: "destructive" });
      }
    },
  });

  // Create new case file and link
  const createAndLinkMutation = useMutation({
    mutationFn: async () => {
      if (!user || !currentTenant) throw new Error('No user or tenant');
      
      // Create new case file
      const { data: newCaseFile, error: createError } = await supabase
        .from('case_files')
        .insert({
          title: newTitle,
          tenant_id: currentTenant.id,
          user_id: user.id,
          status: 'active',
          case_type: 'general',
        })
        .select('id')
        .single();
      
      if (createError) throw createError;
      
      // Link the item
      await linkMutation.mutateAsync(newCaseFile.id);
      
      return newCaseFile.id;
    },
    onSuccess: () => {
      setNewTitle("");
      setShowCreateNew(false);
    },
    onError: () => {
      toast({ title: "Fehler beim Erstellen der FallAkte", variant: "destructive" });
    },
  });

  const handleSelect = (caseFileId: string) => {
    linkMutation.mutate(caseFileId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Zur FallAkte hinzufügen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="FallAkte suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : caseFiles && caseFiles.length > 0 ? (
              <div className="space-y-2">
                {caseFiles.map((cf) => (
                  <button
                    key={cf.id}
                    onClick={() => handleSelect(cf.id)}
                    disabled={linkMutation.isPending}
                    className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{cf.title}</p>
                      {cf.reference_number && (
                        <p className="text-xs text-muted-foreground">{cf.reference_number}</p>
                      )}
                    </div>
                    <Badge className={STATUS_COLORS[cf.status] || STATUS_COLORS.active}>
                      {cf.status}
                    </Badge>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Keine FallAkten gefunden</p>
              </div>
            )}
          </ScrollArea>

          <div className="border-t pt-4">
            {showCreateNew ? (
              <div className="space-y-2">
                <Input
                  placeholder="Titel der neuen FallAkte"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateNew(false)}
                    className="flex-1"
                  >
                    Abbrechen
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => createAndLinkMutation.mutate()}
                    disabled={!newTitle.trim() || createAndLinkMutation.isPending}
                    className="flex-1"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Erstellen
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowCreateNew(true)}
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                Neue FallAkte erstellen
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
