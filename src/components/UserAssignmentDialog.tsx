import React, { useState, useEffect } from 'react';
import { Users, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

interface User {
  user_id: string;
  display_name: string;
}

interface UserAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  letterId: string;
  onAssignmentComplete: () => void;
}

const UserAssignmentDialog: React.FC<UserAssignmentDialogProps> = ({
  isOpen,
  onClose,
  letterId,
  onAssignmentComplete
}) => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && currentTenant) {
      fetchTenantUsers();
      fetchCurrentCollaborators();
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

  const fetchCurrentCollaborators = async () => {
    try {
      const { data, error } = await supabase
        .from('letter_collaborators')
        .select('user_id')
        .eq('letter_id', letterId);

      if (error) throw error;

      setSelectedUsers(data?.map(c => c.user_id) || []);
    } catch (error) {
      console.error('Error fetching collaborators:', error);
    }
  };

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSave = async () => {
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
      if (selectedUsers.length > 0) {
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
      }

      toast({
        title: "Prüfer zugewiesen",
        description: `${selectedUsers.length} Prüfer wurden erfolgreich zugewiesen.`,
      });

      onAssignmentComplete();
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
            Prüfer zuweisen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
                    className="flex items-center space-x-2 p-2 rounded border hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleUserToggle(user.user_id)}
                  >
                    <Checkbox
                      checked={selectedUsers.includes(user.user_id)}
                      onChange={() => handleUserToggle(user.user_id)}
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

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Speichern...' : 'Zuweisen'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserAssignmentDialog;