import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelect } from "@/components/ui/multi-select-simple";
import { Vote, Mail, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StandaloneDecisionCreatorProps {
  onDecisionCreated: () => void;
  variant?: 'button' | 'icon';
}

interface Profile {
  user_id: string;
  display_name: string | null;
}

export const StandaloneDecisionCreator = ({ onDecisionCreated, variant = 'button' }: StandaloneDecisionCreatorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sendByEmail, setSendByEmail] = useState(false);
  const { toast } = useToast();

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .order('display_name');
      
      if (error) throw error;
      setProfiles(data || []);
      setProfilesLoaded(true);
    } catch (error) {
      console.error('Error loading profiles:', error);
      setProfilesLoaded(true);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || selectedUsers.length === 0) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Titel ein und wählen Sie mindestens einen Benutzer aus.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('Starting standalone decision creation...');
      
      // Get current user first and validate
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('Auth error:', userError);
        throw new Error(`Authentication error: ${userError.message}`);
      }
      
      if (!userData.user) {
        console.error('No user found');
        throw new Error('User not authenticated');
      }

      console.log('User authenticated:', userData.user.id);

      // Get user's tenant
      const { data: tenantData, error: tenantError } = await supabase
        .from('user_tenant_memberships')
        .select('tenant_id')
        .eq('user_id', userData.user.id)
        .eq('is_active', true)
        .single();

      if (tenantError || !tenantData) {
        console.error('Tenant lookup error:', tenantError);
        throw new Error('Unable to determine user tenant');
      }

      const insertData = {
        task_id: null, // This is the key difference - no task_id for standalone decisions
        title: title.trim(),
        description: description.trim() || null,
        created_by: userData.user.id,
        tenant_id: tenantData.tenant_id,
      };
      
      console.log('Creating standalone decision with data:', insertData);
      
      // Create the decision
      const { data: decision, error: decisionError } = await supabase
        .from('task_decisions')
        .insert(insertData)
        .select()
        .single();

      if (decisionError) {
        console.error('Decision creation error:', decisionError);
        throw decisionError;
      }

      console.log('Decision created successfully:', decision);

      // Add participants
      const participants = selectedUsers.map(userId => ({
        decision_id: decision.id,
        user_id: userId,
      }));

      console.log('Adding participants:', participants);

      const { error: participantsError } = await supabase
        .from('task_decision_participants')
        .insert(participants);

      if (participantsError) {
        console.error('Participants creation error:', participantsError);
        throw participantsError;
      }

      console.log('Participants added successfully');

      // Send notifications to participants
      for (const userId of selectedUsers) {
        const { error: notificationError } = await supabase.rpc('create_notification', {
          user_id_param: userId,
          type_name: 'task_decision_request',
          title_param: 'Neue Entscheidungsanfrage',
          message_param: `Sie wurden um eine Entscheidung gebeten: "${title.trim()}"`,
          data_param: {
            decision_id: decision.id,
            decision_title: title.trim()
          },
          priority_param: 'medium'
        });

        if (notificationError) {
          console.error('Error creating notification for user:', userId, notificationError);
        }
      }

      // Send email invitations if requested
      if (sendByEmail) {
        try {
          toast({
            title: "E-Mails werden versendet...",
            description: "Die E-Mail-Einladungen werden an die ausgewählten Teilnehmer gesendet.",
          });

          const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-decision-email', {
            body: {
              decisionId: decision.id,
              taskId: null, // No task for standalone decisions
              participantIds: selectedUsers,
              decisionTitle: title.trim(),
              decisionDescription: description.trim() || null,
            },
          });

          if (emailError) {
            console.error('Error sending decision emails:', emailError);
            toast({
              title: "E-Mail-Fehler",
              description: `E-Mails konnten nicht versendet werden: ${emailError.message}`,
              variant: "destructive",
            });
          } else if (emailResult) {
            const successCount = emailResult.results?.filter((r: any) => r.success).length || 0;
            const totalCount = emailResult.results?.length || selectedUsers.length;
            
            if (successCount > 0) {
              toast({
                title: "E-Mails versendet",
                description: `${successCount}/${totalCount} E-Mail-Einladungen erfolgreich versendet.`,
              });
            } else {
              toast({
                title: "E-Mail-Warnung",
                description: "Keine E-Mails konnten versendet werden. Überprüfen Sie die E-Mail-Konfiguration.",
                variant: "destructive",
              });
            }
          }
        } catch (emailError: any) {
          console.error('Error sending decision emails:', emailError);
          toast({
            title: "E-Mail-Fehler",
            description: `Unerwarteter Fehler beim E-Mail-Versand: ${emailError.message}`,
            variant: "destructive",
          });
        }
      }

      toast({
        title: "Erfolgreich",
        description: sendByEmail 
          ? "Entscheidungsanfrage wurde erstellt und E-Mail-Versand wird geprüft."
          : "Entscheidungsanfrage wurde erstellt.",
      });

      // Reset form
      setTitle("");
      setDescription("");
      setSelectedUsers([]);
      setSendByEmail(false);
      setIsOpen(false);
      onDecisionCreated();
    } catch (error) {
      console.error('Error creating decision:', error);
      toast({
        title: "Fehler",
        description: "Entscheidungsanfrage konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const userOptions = useMemo(() => {
    if (!Array.isArray(profiles)) return [];
    return profiles.map(profile => ({
      value: profile.user_id,
      label: profile.display_name || 'Unbekannter Benutzer',
    }));
  }, [profiles]);

  const TriggerButton = variant === 'icon' ? (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={loadProfiles}
      className="text-primary hover:text-primary/80"
    >
      <Vote className="h-4 w-4" />
    </Button>
  ) : (
    <Button 
      onClick={loadProfiles}
      className="w-full"
    >
      <Plus className="h-4 w-4 mr-2" />
      Neue Entscheidung
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {TriggerButton}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Entscheidung anfordern</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Titel</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kurze Beschreibung der Entscheidung"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Beschreibung (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Zusätzliche Details zur Entscheidung"
              rows={3}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Benutzer auswählen</label>
            {profilesLoaded ? (
              <MultiSelect
                options={userOptions}
                selected={selectedUsers}
                onChange={setSelectedUsers}
                placeholder="Benutzer auswählen"
              />
            ) : (
              <div className="w-full h-10 bg-muted rounded-md flex items-center px-3 text-muted-foreground">
                Lade Benutzer...
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="send-by-email"
              checked={sendByEmail}
              onCheckedChange={(checked) => setSendByEmail(checked === true)}
            />
            <label htmlFor="send-by-email" className="text-sm font-medium flex items-center">
              <Mail className="h-4 w-4 mr-1" />
              Auch per E-Mail versenden
            </label>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Abbrechen
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? "Erstelle..." : "Erstellen"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};