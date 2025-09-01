import React, { useState, useEffect } from 'react';
import { FileText, Download, Eye, Clock, User, Send, Calendar, Archive, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface ArchivedLetterDetailsProps {
  document: {
    id: string;
    title: string;
    source_letter_id?: string;
    archived_attachments?: any[];
    created_at: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

interface WorkflowEntry {
  id: string;
  status_from: string;
  status_to: string;
  changed_by: string;
  changed_at: string;
  notes?: string;
  additional_data?: any;
  user_name?: string;
}

interface LetterDetails {
  id: string;
  title: string;
  content: string;
  recipient_name?: string;
  recipient_address?: string;
  status: string;
  sent_date?: string;
  sent_method?: string;
  created_at: string;
  sent_at?: string;
  archived_at?: string;
}

export const ArchivedLetterDetails: React.FC<ArchivedLetterDetailsProps> = ({
  document,
  isOpen,
  onClose
}) => {
  const { toast } = useToast();
  const [workflow, setWorkflow] = useState<WorkflowEntry[]>([]);
  const [letterDetails, setLetterDetails] = useState<LetterDetails | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && document.source_letter_id) {
      fetchLetterDetails();
    }
  }, [isOpen, document.source_letter_id]);

  const fetchLetterDetails = async () => {
    if (!document.source_letter_id) return;

    setLoading(true);
    try {
      // Fetch letter details
      const { data: letter, error: letterError } = await supabase
        .from('letters')
        .select('*')
        .eq('id', document.source_letter_id)
        .single();

      if (letterError) throw letterError;
      setLetterDetails(letter);

      // Fetch workflow history
      const { data: workflowData, error: workflowError } = await supabase
        .from('letter_workflow_history')
        .select('*')
        .eq('letter_id', document.source_letter_id)
        .order('changed_at', { ascending: true });

      if (workflowError) throw workflowError;
      
      // Fetch user names separately
      const userIds = [...new Set(workflowData?.map(entry => entry.changed_by) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
      
      const workflowWithNames = workflowData?.map(entry => ({
        ...entry,
        user_name: profileMap.get(entry.changed_by) || 'Unbekannt'
      })) || [];
      
      setWorkflow(workflowWithNames);

      // Fetch archived attachments
      const { data: attachmentDocs, error: attachmentError } = await supabase
        .from('documents')
        .select('*')
        .eq('source_letter_id', document.source_letter_id)
        .eq('document_type', 'letter_attachment');

      if (attachmentError) throw attachmentError;
      setAttachments(attachmentDocs || []);

    } catch (error: any) {
      console.error('Error fetching letter details:', error);
      toast({
        title: "Fehler",
        description: "Brief-Details konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAttachment = async (attachment: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = attachment.file_name;
      window.document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(url);
      window.document.body.removeChild(link);
    } catch (error: any) {
      toast({
        title: "Download-Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      draft: 'Entwurf',
      review: 'Zur Prüfung',
      approved: 'Genehmigt',
      sent: 'Versendet',
      archived: 'Archiviert'
    };
    return labels[status] || status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <FileText className="h-4 w-4" />;
      case 'review': return <Clock className="h-4 w-4" />;
      case 'approved': return <Eye className="h-4 w-4" />;
      case 'sent': return <Send className="h-4 w-4" />;
      case 'archived': return <Archive className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Archivierte Brief-Details
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Letter Overview */}
              {letterDetails && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Brief-Übersicht
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Titel</label>
                        <p className="font-medium">{letterDetails.title}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Empfänger</label>
                        <p>{letterDetails.recipient_name || 'Nicht angegeben'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Status</label>
                        <Badge className="mt-1">
                          {getStatusIcon(letterDetails.status)}
                          <span className="ml-1">{getStatusLabel(letterDetails.status)}</span>
                        </Badge>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Erstellt am</label>
                        <p>{format(new Date(letterDetails.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}</p>
                      </div>
                      {letterDetails.sent_at && (
                        <>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Versendet am</label>
                            <p>{format(new Date(letterDetails.sent_at), 'dd.MM.yyyy HH:mm', { locale: de })}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Versandart</label>
                            <p>{letterDetails.sent_method || 'Nicht angegeben'}</p>
                          </div>
                        </>
                      )}
                    </div>
                    
                    {letterDetails.recipient_address && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Empfänger-Adresse</label>
                        <pre className="whitespace-pre-wrap text-sm bg-muted p-3 rounded mt-1">
                          {letterDetails.recipient_address}
                        </pre>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Inhalt</label>
                      <div className="bg-muted p-4 rounded mt-1 max-h-64 overflow-y-auto">
                        <div dangerouslySetInnerHTML={{ __html: letterDetails.content }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Workflow History */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Workflow-Historie
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {workflow.length === 0 ? (
                    <p className="text-muted-foreground">Keine Workflow-Historie verfügbar.</p>
                  ) : (
                    <div className="space-y-4">
                      {workflow.map((entry, index) => (
                        <div key={entry.id} className="flex items-start gap-4 relative">
                          {index < workflow.length - 1 && (
                            <div className="absolute left-4 top-8 bottom-0 w-px bg-border" />
                          )}
                          <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            {getStatusIcon(entry.status_to)}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {getStatusLabel(entry.status_from)} → {getStatusLabel(entry.status_to)}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(entry.changed_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <User className="h-3 w-3" />
                              <span>{entry.user_name}</span>
                            </div>
                            {entry.notes && (
                              <p className="text-sm text-muted-foreground">{entry.notes}</p>
                            )}
                            {entry.additional_data?.sent_method && (
                              <p className="text-sm">
                                <strong>Versandart:</strong> {entry.additional_data.sent_method}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Attachments */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Anlagen ({attachments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {attachments.length === 0 ? (
                    <p className="text-muted-foreground">Keine Anlagen verfügbar.</p>
                  ) : (
                    <div className="space-y-3">
                      {attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{attachment.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {attachment.file_name} • {attachment.file_size ? Math.round(attachment.file_size / 1024) + ' KB' : 'Unbekannte Größe'}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadAttachment(attachment)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};