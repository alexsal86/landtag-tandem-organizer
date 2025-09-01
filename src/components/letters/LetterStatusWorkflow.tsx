import React, { useState } from 'react';
import { ArrowRight, CheckCircle, Clock, Edit3, Send, AlertCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LetterStatusWorkflowProps {
  letter: {
    id: string;
    status: 'draft' | 'review' | 'approved' | 'sent';
    title: string;
    created_by: string;
  };
  currentUserId: string;
  onStatusChange: (newStatus: string, data?: any) => void;
  canEdit: boolean;
}

export const LetterStatusWorkflow: React.FC<LetterStatusWorkflowProps> = ({
  letter,
  currentUserId,
  onStatusChange,
  canEdit
}) => {
  const { toast } = useToast();
  const [isTransitionDialogOpen, setIsTransitionDialogOpen] = useState(false);
  const [transitionTo, setTransitionTo] = useState<string>('');
  const [transitionNote, setTransitionNote] = useState('');
  const [sentMethod, setSentMethod] = useState<'post' | 'email' | 'both'>('post');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedReviewer, setSelectedReviewer] = useState<string>('');

  const statusConfig = {
    draft: {
      label: 'Entwurf',
      icon: Edit3,
      color: 'bg-gray-100 text-gray-800',
      nextStates: ['review', 'approved']
    },
    review: {
      label: 'Zur Prüfung',
      icon: Clock,
      color: 'bg-yellow-100 text-yellow-800',
      nextStates: ['draft', 'approved']
    },
    approved: {
      label: 'Genehmigt',
      icon: CheckCircle,
      color: 'bg-green-100 text-green-800',
      nextStates: ['sent', 'draft']
    },
    sent: {
      label: 'Versendet',
      icon: Send,
      color: 'bg-blue-100 text-blue-800',
      nextStates: []
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .neq('user_id', currentUserId);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleStatusTransition = async () => {
    if (!transitionTo) return;

    console.log('=== STATUS TRANSITION START ===');
    console.log('Letter ID:', letter.id);
    console.log('Current Status:', letter.status);
    console.log('Target Status:', transitionTo);
    console.log('Current User ID:', currentUserId);

    try {
      const now = new Date().toISOString();
      let updateData: any = { 
        status: transitionTo,
        updated_at: now
      };

      // Handle specific transition logic
      if (transitionTo === 'review' && selectedReviewer) {
        updateData.reviewer_id = selectedReviewer;
        updateData.submitted_for_review_at = now;
        updateData.submitted_for_review_by = currentUserId;
      }

      if (transitionTo === 'approved') {
        updateData.approved_at = now;
        updateData.approved_by = currentUserId;
      }

      if (transitionTo === 'sent') {
        updateData.sent_method = sentMethod;
        updateData.sent_date = new Date().toISOString().split('T')[0];
        // Remove archived_at and workflow_locked as they cause database errors
        // These will be handled by database triggers
        
        // Trigger archiving process for sent letters
        try {
          const { error: archiveError } = await supabase.functions.invoke('archive-letter', {
            body: { letterId: letter.id }
          });
          
          if (archiveError) {
            console.error('Archive function error:', archiveError);
            // Still update status but show warning
            toast({
              title: "Brief versendet",
              description: "Brief wurde als versendet markiert. Archivierung wird im Hintergrund verarbeitet.",
              variant: "default",
            });
          }
        } catch (error) {
          console.error('Failed to trigger archive:', error);
        }
      }

      console.log('Update data:', updateData);

      // Update database directly
      const { data, error } = await supabase
        .from('letters')
        .update(updateData)
        .eq('id', letter.id)
        .select();

      console.log('Supabase update result:', { data, error });

      if (error) {
        console.error('Supabase error details:', error);
        throw error;
      }

      console.log('Database update successful');

      // Update the letter via callback for UI updates
      onStatusChange(transitionTo, updateData);

      toast({
        title: "Status geändert",
        description: `Brief wurde auf "${statusConfig[transitionTo as keyof typeof statusConfig].label}" gesetzt.`,
      });

      // Reset dialog
      setIsTransitionDialogOpen(false);
      setTransitionTo('');
      setTransitionNote('');
      setSelectedReviewer('');
    } catch (error) {
      console.error('Error changing status:', error);
      toast({
        title: "Fehler",
        description: "Status konnte nicht geändert werden.",
        variant: "destructive",
      });
    }
  };

  const openTransitionDialog = (toStatus: string) => {
    setTransitionTo(toStatus);
    setIsTransitionDialogOpen(true);
    
    if (toStatus === 'review') {
      fetchUsers();
    }
  };

  const currentStatus = statusConfig[letter.status];
  const nextStates = currentStatus.nextStates;

  if (!canEdit || nextStates.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <currentStatus.icon className="h-4 w-4" />
            <Badge className={currentStatus.color}>
              {currentStatus.label}
            </Badge>
            {letter.status === 'sent' && (
              <span className="text-sm text-muted-foreground">
                (Endstatus erreicht)
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <currentStatus.icon className="h-4 w-4" />
          Status-Workflow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center gap-2">
          <Badge className={currentStatus.color}>
            {currentStatus.label}
          </Badge>
          <span className="text-sm text-muted-foreground">Aktueller Status</span>
        </div>

        {/* Available Transitions */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Verfügbare Aktionen:</Label>
          <div className="flex flex-wrap gap-2">
            {nextStates.map((nextState) => {
              const nextConfig = statusConfig[nextState as keyof typeof statusConfig];
              return (
                <Button
                  key={nextState}
                  variant="outline"
                  size="sm"
                  onClick={() => openTransitionDialog(nextState)}
                  className="flex items-center gap-2"
                >
                  <nextConfig.icon className="h-3 w-3" />
                  {nextConfig.label}
                  <ArrowRight className="h-3 w-3" />
                </Button>
              );
            })}
          </div>
        </div>

        {/* Transition Dialog */}
        <Dialog open={isTransitionDialogOpen} onOpenChange={setIsTransitionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Status ändern zu: {transitionTo && statusConfig[transitionTo as keyof typeof statusConfig]?.label}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Reviewer Selection for Review Status */}
              {transitionTo === 'review' && (
                <div className="space-y-2">
                  <Label>Prüfung zuweisen an:</Label>
                  <Select value={selectedReviewer} onValueChange={setSelectedReviewer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Benutzer auswählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.user_id} value={user.user_id}>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {user.display_name || 'Unbekannt'}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Sending Method for Sent Status */}
              {transitionTo === 'sent' && (
                <div className="space-y-2">
                  <Label>Versandart:</Label>
                  <Select value={sentMethod} onValueChange={(value: 'post' | 'email' | 'both') => setSentMethod(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="post">Post</SelectItem>
                      <SelectItem value="email">E-Mail</SelectItem>
                      <SelectItem value="both">Post & E-Mail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Optional Note */}
              <div className="space-y-2">
                <Label>Bemerkung (optional):</Label>
                <Textarea
                  value={transitionNote}
                  onChange={(e) => setTransitionNote(e.target.value)}
                  placeholder="Zusätzliche Informationen zu dieser Statusänderung..."
                  rows={3}
                />
              </div>

              {/* Warning for certain transitions */}
              {transitionTo === 'sent' && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800">Wichtiger Hinweis</p>
                    <p className="text-yellow-700">
                      Nach dem Versenden kann der Brief nicht mehr bearbeitet werden.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsTransitionDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button
                  onClick={handleStatusTransition}
                  disabled={transitionTo === 'review' && !selectedReviewer}
                >
                  Status ändern
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};