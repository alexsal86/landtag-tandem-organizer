import React, { useState } from 'react';
import { ArrowRight, CheckCircle, Clock, Edit3, Send, AlertCircle, User, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  createLetterApprovalDecision,
  createLetterSendTask,
  createLetterRevisionTask,
} from '@/utils/letterWorkflowActions';

type LetterStatus = 'draft' | 'pending_approval' | 'approved' | 'revision_requested' | 'sent' | 'review';

interface LetterStatusWorkflowProps {
  letter: {
    id: string;
    status: LetterStatus;
    title: string;
    created_by: string;
    tenant_id?: string;
  };
  currentUserId: string;
  tenantId?: string;
  onStatusChange: (newStatus: string, data?: any) => void;
  canEdit: boolean;
}

const STATUS_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  color: string;
  nextStates: string[];
}> = {
  draft: {
    label: 'Entwurf',
    icon: Edit3,
    color: 'bg-gray-100 text-gray-800',
    nextStates: ['pending_approval'],
  },
  pending_approval: {
    label: 'Zur Freigabe',
    icon: Clock,
    color: 'bg-yellow-100 text-yellow-800',
    nextStates: ['approved', 'revision_requested'],
  },
  // Legacy "review" maps to pending_approval behavior
  review: {
    label: 'Zur Freigabe',
    icon: Clock,
    color: 'bg-yellow-100 text-yellow-800',
    nextStates: ['approved', 'revision_requested'],
  },
  revision_requested: {
    label: 'Überarbeitung',
    icon: RotateCcw,
    color: 'bg-orange-100 text-orange-800',
    nextStates: ['pending_approval'],
  },
  approved: {
    label: 'Freigegeben',
    icon: CheckCircle,
    color: 'bg-green-100 text-green-800',
    nextStates: ['sent'],
  },
  sent: {
    label: 'Versendet',
    icon: Send,
    color: 'bg-blue-100 text-blue-800',
    nextStates: [],
  },
};

export const LetterStatusWorkflow: React.FC<LetterStatusWorkflowProps> = ({
  letter,
  currentUserId,
  tenantId,
  onStatusChange,
  canEdit,
}) => {
  const { toast } = useToast();
  const [isTransitionDialogOpen, setIsTransitionDialogOpen] = useState(false);
  const [transitionTo, setTransitionTo] = useState<string>('');
  const [revisionComment, setRevisionComment] = useState('');
  const [sentMethod, setSentMethod] = useState<'post' | 'email' | 'both'>('post');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedReviewer, setSelectedReviewer] = useState<string>('');

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

    try {
      const now = new Date().toISOString();
      const effectiveTenantId = tenantId || letter.tenant_id;
      const updateData: any = {
        status: transitionTo,
        updated_at: now,
      };

      // === Transition: draft/revision_requested → pending_approval ===
      if (transitionTo === 'pending_approval') {
        if (!selectedReviewer) {
          toast({ title: 'Fehler', description: 'Bitte wählen Sie einen Prüfer aus.', variant: 'destructive' });
          return;
        }
        updateData.submitted_for_review_at = now;
        updateData.submitted_for_review_by = currentUserId;
        updateData.reviewer_id = selectedReviewer;

        // Auto-create decision
        if (effectiveTenantId) {
          createLetterApprovalDecision(
            letter.id,
            letter.title,
            currentUserId,
            selectedReviewer,
            effectiveTenantId,
          );
        }
      }

      // === Transition: pending_approval → approved ===
      if (transitionTo === 'approved') {
        updateData.approved_at = now;
        updateData.approved_by = currentUserId;

        // Auto-create send task for letter creator
        if (effectiveTenantId) {
          createLetterSendTask(letter.title, letter.created_by, currentUserId, effectiveTenantId);
        }
      }

      // === Transition: pending_approval → revision_requested ===
      if (transitionTo === 'revision_requested') {
        updateData.revision_comment = revisionComment;
        updateData.revision_requested_by = currentUserId;
        updateData.revision_requested_at = now;

        // Auto-create revision task
        if (effectiveTenantId) {
          createLetterRevisionTask(
            letter.title,
            revisionComment,
            letter.created_by,
            currentUserId,
            effectiveTenantId,
          );
        }
      }

      // === Transition: approved → sent ===
      if (transitionTo === 'sent') {
        updateData.sent_at = now;
        updateData.sent_by = currentUserId;
        updateData.sent_method = sentMethod;
        updateData.sent_date = now.split('T')[0];
        updateData.workflow_locked = true;
      }

      // Update database
      const { error } = await supabase
        .from('letters')
        .update(updateData)
        .eq('id', letter.id);

      if (error) throw error;

      // Handle archiving for sent letters
      if (transitionTo === 'sent') {
        try {
          const { data: fullLetter } = await supabase
            .from('letters')
            .select('*')
            .eq('id', letter.id)
            .single();

          if (fullLetter) {
            const { archiveLetter } = await import('@/utils/letterArchiving');
            await archiveLetter(fullLetter, currentUserId);
          }
        } catch (archiveErr) {
          console.error('Archive failed:', archiveErr);
        }

        // Handle email sending
        if (sentMethod === 'email' || sentMethod === 'both') {
          try {
            const { data: fullLetter } = await supabase
              .from('letters')
              .select('*, contacts:contact_id(email)')
              .eq('id', letter.id)
              .single();

            const recipientEmail = (fullLetter as any)?.contacts?.email;
            if (recipientEmail) {
              toast({
                title: 'E-Mail-Versand',
                description: `Brief wird per E-Mail an ${recipientEmail} gesendet...`,
              });
              // TODO: Call send-document-email edge function with PDF
            }
          } catch (emailErr) {
            console.error('Email send failed:', emailErr);
          }
        }

        // Handle print
        if (sentMethod === 'post' || sentMethod === 'both') {
          toast({
            title: 'Drucken',
            description: 'Bitte nutzen Sie die PDF-Export-Funktion zum Drucken.',
          });
        }
      }

      onStatusChange(transitionTo, updateData);

      const config = STATUS_CONFIG[transitionTo];
      toast({
        title: 'Status geändert',
        description: `Brief wurde auf "${config?.label || transitionTo}" gesetzt.`,
      });

      // Reset dialog
      setIsTransitionDialogOpen(false);
      setTransitionTo('');
      setRevisionComment('');
      setSelectedReviewer('');
    } catch (error) {
      console.error('Error changing status:', error);
      toast({ title: 'Fehler', description: 'Status konnte nicht geändert werden.', variant: 'destructive' });
    }
  };

  const openTransitionDialog = (toStatus: string) => {
    setTransitionTo(toStatus);
    setIsTransitionDialogOpen(true);
    if (toStatus === 'pending_approval') {
      fetchUsers();
    }
  };

  const currentStatus = STATUS_CONFIG[letter.status] || STATUS_CONFIG.draft;
  const nextStates = currentStatus.nextStates;

  if (!canEdit || nextStates.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <currentStatus.icon className="h-4 w-4" />
            <Badge className={currentStatus.color}>{currentStatus.label}</Badge>
            {letter.status === 'sent' && (
              <span className="text-sm text-muted-foreground">(Endstatus erreicht)</span>
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
        <div className="flex items-center gap-2">
          <Badge className={currentStatus.color}>{currentStatus.label}</Badge>
          <span className="text-sm text-muted-foreground">Aktueller Status</span>
        </div>

        {/* Revision comment banner */}
        {(letter.status === 'revision_requested') && (letter as any).revision_comment && (
          <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-orange-800">Begründung der Zurückweisung</p>
              <p className="text-orange-700">{(letter as any).revision_comment}</p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-sm font-medium">Verfügbare Aktionen:</Label>
          <div className="flex flex-wrap gap-2">
            {nextStates.map((nextState) => {
              const nextConfig = STATUS_CONFIG[nextState];
              if (!nextConfig) return null;
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
                Status ändern zu: {transitionTo && STATUS_CONFIG[transitionTo]?.label}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Reviewer selection for pending_approval */}
              {transitionTo === 'pending_approval' && (
                <div className="space-y-2">
                  <Label>Freigabe zuweisen an:</Label>
                  <Select value={selectedReviewer} onValueChange={setSelectedReviewer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Benutzer auswählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {u.display_name || 'Unbekannt'}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Revision comment for rejection */}
              {transitionTo === 'revision_requested' && (
                <div className="space-y-2">
                  <Label>Begründung der Zurückweisung:</Label>
                  <Textarea
                    value={revisionComment}
                    onChange={(e) => setRevisionComment(e.target.value)}
                    placeholder="Bitte geben Sie eine Begründung an..."
                    rows={4}
                  />
                </div>
              )}

              {/* Sending method for sent */}
              {transitionTo === 'sent' && (
                <div className="space-y-2">
                  <Label>Versandart:</Label>
                  <Select value={sentMethod} onValueChange={(v: 'post' | 'email' | 'both') => setSentMethod(v)}>
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

              {/* Warning for sent */}
              {transitionTo === 'sent' && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800">Wichtiger Hinweis</p>
                    <p className="text-yellow-700">Nach dem Versenden kann der Brief nicht mehr bearbeitet werden.</p>
                  </div>
                </div>
              )}

              {/* Warning for rejection */}
              {transitionTo === 'revision_requested' && !revisionComment.trim() && (
                <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-orange-700">Eine Begründung hilft dem Mitarbeiter bei der Überarbeitung.</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsTransitionDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button
                  onClick={handleStatusTransition}
                  disabled={transitionTo === 'pending_approval' && !selectedReviewer}
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
