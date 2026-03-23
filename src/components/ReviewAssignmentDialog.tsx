import React, { useState, useEffect } from 'react';
import { Users, Check, ArrowRight, UserCheck, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { debugConsole } from '@/utils/debugConsole';
import { createLetterApprovalDecision } from '@/utils/letterWorkflowActions';
import { LETTER_NOTIFICATION_TYPES } from '@/utils/letterNotificationTypes';

interface User {
  user_id: string;
  display_name: string;
}

interface LetterData {
  title: string;
  contentHtml: string;
  salutation: string;
  closingFormula: string;
  closingName: string;
  subject: string;
}

interface ReviewAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  letterId: string;
  letterData?: LetterData;
  onReviewAssigned: (mode: 'review' | 'approval') => void;
  onSkipReview: () => void;
}

const ReviewAssignmentDialog: React.FC<ReviewAssignmentDialogProps> = ({
  isOpen,
  onClose,
  letterId,
  letterData,
  onReviewAssigned,
  onSkipReview
}) => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [reviewOption, setReviewOption] = useState<'skip' | 'peer_review' | 'approval'>('approval');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && currentTenant) {
      fetchTenantUsers();
      setSelectedUsers([]);
    }
  }, [isOpen, currentTenant]);

  const fetchTenantUsers = async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const { data: tenantUsers, error: tenantError } = await supabase
        .from('user_tenant_memberships')
        .select('user_id')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .neq('user_id', user?.id ?? '');

      if (tenantError) throw tenantError;
      const userIds = tenantUsers?.map(u => u.user_id) || [];
      if (userIds.length === 0) { setUsers([]); return; }

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      if (error) throw error;
      setUsers(data?.map(item => ({ user_id: item.user_id, display_name: item.display_name || 'Unbekannt' })) || []);
    } catch (error) {
      debugConsole.error('Error fetching tenant users:', error);
      toast({ title: "Fehler", description: "Benutzer konnten nicht geladen werden.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const sendNotifications = async (userIds: string[], type: string, title: string, message: string) => {
    for (const uid of userIds) {
      try {
        await supabase.rpc('create_notification', {
          user_id_param: uid,
          type_name: type,
          title_param: title,
          message_param: message,
          data_param: JSON.stringify({ letter_id: letterId, letter_title: letterData?.title }),
          priority_param: 'medium',
        });
      } catch (e) {
        debugConsole.error('Error sending notification:', e);
      }
    }
  };

  const handleSubmit = async () => {
    if (reviewOption === 'skip') {
      onSkipReview();
      onClose();
      return;
    }

    if (selectedUsers.length === 0) {
      toast({ title: "Keine Benutzer ausgewählt", description: "Bitte wählen Sie mindestens einen Benutzer aus.", variant: "destructive" });
      return;
    }

    if (!user || !currentTenant) return;
    setSaving(true);

    try {
      // Save collaborators
      await supabase.from('letter_collaborators').delete().eq('letter_id', letterId);
      const role = reviewOption === 'peer_review' ? 'reviewer' : 'reviewer';
      await supabase.from('letter_collaborators').insert(
        selectedUsers.map(userId => ({ letter_id: letterId, user_id: userId, assigned_by: user.id, role }))
      );

      if (reviewOption === 'approval') {
        // Create decision for each reviewer
        for (const reviewerUserId of selectedUsers) {
          await createLetterApprovalDecision(
            letterId, letterData?.title || 'Brief', user.id, reviewerUserId, currentTenant.id,
            letterData ? { contentHtml: letterData.contentHtml, salutation: letterData.salutation, closingFormula: letterData.closingFormula, closingName: letterData.closingName, subject: letterData.subject } : undefined,
          );
        }
        // Notify reviewers
        await sendNotifications(selectedUsers, LETTER_NOTIFICATION_TYPES.REVIEW_REQUESTED, 'Brief zur Freigabe', `Der Brief "${letterData?.title || 'Unbekannt'}" wurde Ihnen zur Freigabe vorgelegt.`);
        toast({ title: "Zur Freigabe eingereicht", description: `${selectedUsers.length} Prüfer wurden zugewiesen. Eine Entscheidungsanfrage wurde erstellt.` });
        onReviewAssigned('approval');
      } else {
        // Peer review – no decision, just notify
        await sendNotifications(selectedUsers, LETTER_NOTIFICATION_TYPES.REVIEW_REQUESTED, 'Brief zur Kollegenprüfung', `Der Brief "${letterData?.title || 'Unbekannt'}" wurde Ihnen zur Kollegenprüfung zugewiesen.`);
        toast({ title: "Kollegenprüfung zugewiesen", description: `${selectedUsers.length} Kollegen wurden zur Prüfung zugewiesen.` });
        onReviewAssigned('review');
      }

      onClose();
    } catch (error) {
      debugConsole.error('Error saving collaborators:', error);
      toast({ title: "Fehler", description: "Prüfer konnten nicht zugewiesen werden.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const needsUserSelection = reviewOption !== 'skip';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Brief zur Prüfung
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup value={reviewOption} onValueChange={(value: 'skip' | 'peer_review' | 'approval') => setReviewOption(value)}>
            <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/50">
              <RadioGroupItem value="peer_review" id="peer_review" />
              <Label htmlFor="peer_review" className="flex items-center gap-2 cursor-pointer flex-1">
                <UserCheck className="h-4 w-4 text-blue-500" />
                <div>
                  <div className="font-medium">Kollegenprüfung</div>
                  <div className="text-xs text-muted-foreground">Kollegen schauen drüber, keine Entscheidung nötig</div>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/50">
              <RadioGroupItem value="approval" id="approval" />
              <Label htmlFor="approval" className="flex items-center gap-2 cursor-pointer flex-1">
                <Shield className="h-4 w-4 text-primary" />
                <div>
                  <div className="font-medium">Freigabe-Entscheidung</div>
                  <div className="text-xs text-muted-foreground">Prüfer erhält Entscheidungsanfrage (Freigeben/Zurückweisen)</div>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/50">
              <RadioGroupItem value="skip" id="skip" />
              <Label htmlFor="skip" className="flex items-center gap-2 cursor-pointer flex-1">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">Prüfung überspringen</div>
                  <div className="text-xs text-muted-foreground">Direkt zu &quot;Genehmigt&quot;</div>
                </div>
              </Label>
            </div>
          </RadioGroup>

          {needsUserSelection && (
            <>
              <p className="text-sm text-muted-foreground">
                {reviewOption === 'peer_review'
                  ? 'Wählen Sie Kollegen, die den Brief prüfen sollen.'
                  : 'Wählen Sie Prüfer, die den Brief freigeben sollen. Eine Entscheidungsanfrage wird erstellt.'}
              </p>

              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-auto">
                  {users.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Keine anderen Benutzer im Team gefunden.</p>
                  ) : (
                    users.map((u) => (
                      <div key={u.user_id} className="flex items-center space-x-2 p-3 rounded border hover:bg-muted/50 cursor-pointer touch-manipulation" onClick={() => handleUserToggle(u.user_id)}>
                        <Checkbox checked={selectedUsers.includes(u.user_id)} onCheckedChange={() => handleUserToggle(u.user_id)} />
                        <div className="flex-1"><span className="text-sm font-medium">{u.display_name}</span></div>
                        {selectedUsers.includes(u.user_id) && <Check className="h-4 w-4 text-primary" />}
                      </div>
                    ))
                  )}
                </div>
              )}

              {selectedUsers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Ausgewählt:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedUsers.map(userId => {
                      const u = users.find(x => x.user_id === userId);
                      return <Badge key={userId} variant="secondary">{u?.display_name || 'Unbekannt'}</Badge>;
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={saving}>Abbrechen</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Speichern...' : reviewOption === 'skip' ? 'Überspringen' : reviewOption === 'peer_review' ? 'Zur Kollegenprüfung' : 'Zur Freigabe einreichen'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewAssignmentDialog;
