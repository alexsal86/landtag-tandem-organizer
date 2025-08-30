import React, { useState, useEffect } from 'react';
import { Users, X, Check, ArrowRight } from 'lucide-react';
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

interface User {
  user_id: string;
  display_name: string;
}

interface ReviewAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  letterId: string;
  onReviewAssigned: () => void;
  onSkipReview: () => void;
}

const ReviewAssignmentDialog: React.FC<ReviewAssignmentDialogProps> = ({
  isOpen,
  onClose,
  letterId,
  onReviewAssigned,
  onSkipReview
}) => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [reviewOption, setReviewOption] = useState<'skip' | 'assign'>('skip');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && currentTenant) {
      fetchTenantUsers();
      setSelectedUsers([]); // Reset selected users for new letters
    }
  }, [isOpen, currentTenant]);

  const fetchTenantUsers = async () => {
    if (!currentTenant) return;

    setLoading(true);
    try {
      // First get tenant user IDs
      const { data: tenantUsers, error: tenantError } = await supabase
        .from('user_tenant_memberships')
        .select('user_id')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .neq('user_id', user?.id);

      if (tenantError) {
        console.error('Error fetching tenant users:', tenantError);
        throw tenantError;
      }

      const userIds = tenantUsers?.map(u => u.user_id) || [];

      if (userIds.length === 0) {
        setUsers([]);
        return;
      }

      // Then get profiles for those users
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      if (error) {
        console.error('Error fetching profiles:', error);
        throw error;
      }

      const formattedUsers = data?.map(item => ({
        user_id: item.user_id,
        display_name: item.display_name || 'Unbekannt'
      })) || [];

      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error fetching tenant users:', error);
      toast({
        title: "Fehler",
        description: "Benutzer konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    if (reviewOption === 'skip') {
      onSkipReview();
      onClose();
      return;
    }

    if (selectedUsers.length === 0) {
      toast({
        title: "Keine Prüfer ausgewählt",
        description: "Bitte wählen Sie mindestens einen Prüfer aus.",
        variant: "destructive",
      });
      return;
    }

    if (!user) return;

    setSaving(true);
    try {
      // Remove existing collaborators
      const { error: deleteError } = await supabase
        .from('letter_collaborators')
        .delete()
        .eq('letter_id', letterId);

      if (deleteError) throw deleteError;

      // Add new collaborators
      const { error: insertError } = await supabase
        .from('letter_collaborators')
        .insert(
          selectedUsers.map(userId => ({
            letter_id: letterId,
            user_id: userId,
            assigned_by: user.id,
            role: 'reviewer'
          }))
        );

      if (insertError) throw insertError;

      toast({
        title: "Prüfer zugewiesen",
        description: `${selectedUsers.length} Prüfer wurden erfolgreich zugewiesen.`,
      });

      onReviewAssigned();
      onClose();
    } catch (error) {
      console.error('Error saving collaborators:', error);
      toast({
        title: "Fehler",
        description: "Prüfer konnten nicht zugewiesen werden.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

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
          <RadioGroup value={reviewOption} onValueChange={(value: 'skip' | 'assign') => setReviewOption(value)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="skip" id="skip" />
              <Label htmlFor="skip" className="flex items-center gap-2 cursor-pointer">
                <ArrowRight className="h-4 w-4" />
                Prüfung überspringen (direkt zu "Genehmigt")
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="assign" id="assign" />
              <Label htmlFor="assign" className="cursor-pointer">
                Prüfer zuweisen
              </Label>
            </div>
          </RadioGroup>

          {reviewOption === 'assign' && (
            <>
              <p className="text-sm text-muted-foreground">
                Wählen Sie die Benutzer aus, die diesen Brief zur Korrektur erhalten sollen.
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
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Keine anderen Benutzer im Team gefunden.
                    </p>
                  ) : (
                    users.map((user) => (
                      <div
                        key={user.user_id}
                        className="flex items-center space-x-2 p-3 rounded border hover:bg-muted/50 cursor-pointer touch-manipulation"
                        onClick={() => handleUserToggle(user.user_id)}
                      >
                        <Checkbox
                          checked={selectedUsers.includes(user.user_id)}
                          onCheckedChange={() => handleUserToggle(user.user_id)}
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium">{user.display_name}</span>
                        </div>
                        {selectedUsers.includes(user.user_id) && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {selectedUsers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Ausgewählte Prüfer:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedUsers.map(userId => {
                      const user = users.find(u => u.user_id === userId);
                      return (
                        <Badge key={userId} variant="secondary">
                          {user?.display_name || 'Unbekannt'}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Speichern...' : reviewOption === 'skip' ? 'Überspringen' : 'Zuweisen'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewAssignmentDialog;