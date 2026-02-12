import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { MultiSelect } from "@/components/ui/multi-select-simple";
import { Vote, Mail, MessageSquare, Globe, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DecisionFileUpload } from "./DecisionFileUpload";
import { isEmlFile, isMsgFile, parseEmlFile, parseMsgFile, type EmailMetadata } from "@/utils/emlParser";
import { TopicSelector } from "@/components/topics/TopicSelector";
import { saveDecisionTopics } from "@/hooks/useDecisionTopics";
import { ResponseOptionsEditor } from "./ResponseOptionsEditor";
import { ResponseOptionsPreview } from "./ResponseOptionsPreview";
import { DECISION_TEMPLATES, DEFAULT_TEMPLATE_ID, ResponseOption, getTemplateById } from "@/lib/decisionTemplates";

interface TaskDecisionCreatorProps {
  taskId: string;
  onDecisionCreated: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialTitle?: string;
  initialDescription?: string;
}

interface Profile {
  user_id: string;
  display_name: string | null;
}

export const TaskDecisionCreator = ({ 
  taskId, 
  onDecisionCreated,
  isOpen: externalOpen,
  onOpenChange: externalOnOpenChange,
  initialTitle,
  initialDescription
}: TaskDecisionCreatorProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Controlled vs uncontrolled mode
  const isControlled = externalOpen !== undefined;
  const isOpen = isControlled ? externalOpen : internalOpen;
  
  const handleOpenChange = (open: boolean) => {
    if (isControlled && externalOnOpenChange) {
      externalOnOpenChange(open);
    } else {
      setInternalOpen(open);
    }
  };
  
  const [title, setTitle] = useState(initialTitle || "");
  const [description, setDescription] = useState(initialDescription || "");
  
  // Update fields when dialog opens with initial values
  useEffect(() => {
    if (isOpen) {
      if (initialTitle) setTitle(initialTitle);
      if (initialDescription) setDescription(initialDescription);
    }
  }, [isOpen, initialTitle, initialDescription]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sendByEmail, setSendByEmail] = useState(true);
  const [sendViaMatrix, setSendViaMatrix] = useState(true);
  const [visibleToAll, setVisibleToAll] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [priority, setPriority] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const defaultTemplate = getTemplateById(DEFAULT_TEMPLATE_ID);
  const [customOptions, setCustomOptions] = useState<ResponseOption[]>(
    defaultTemplate ? defaultTemplate.options.map(o => ({ ...o })) : [
      { key: "option_1", label: "Option 1", color: "blue" },
      { key: "option_2", label: "Option 2", color: "green" }
    ]
  );
  const { toast } = useToast();
  
  // Load profiles when controlled dialog opens; reset when closing
  useEffect(() => {
    if (isControlled && isOpen && !profilesLoaded) {
      loadProfiles();
    }
    if (isControlled && !isOpen) {
      setProfilesLoaded(false); // Reset beim Schliessen
    }
  }, [isControlled, isOpen, profilesLoaded]);

  const currentOptions = useMemo(() => {
    return customOptions;
  }, [customOptions]);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId !== "custom") {
      const tpl = getTemplateById(templateId);
      if (tpl) {
        setCustomOptions(tpl.options.map(o => ({ ...o })));
      }
    }
  };

  const loadProfiles = async () => {
    try {
      // Get current user's tenant
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: tenantData } = await supabase
        .from('user_tenant_memberships')
        .select('tenant_id')
        .eq('user_id', userData.user.id)
        .eq('is_active', true)
        .single();

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .order('display_name');
      
      if (error) throw error;
      setProfiles(data || []);
      
      if (tenantData?.tenant_id) {
        // Get tenant members for validation
        const { data: tenantMembers } = await supabase
          .from('user_tenant_memberships')
          .select('user_id')
          .eq('tenant_id', tenantData.tenant_id)
          .eq('is_active', true);
        
        const tenantUserIds = new Set(tenantMembers?.map(m => m.user_id) || []);

        // Check for default settings FIRST
        let defaultIds: string[] = [];
        let defaultSettings: any = null;
        try {
          const stored = localStorage.getItem('default_decision_settings');
          if (stored) {
            defaultSettings = JSON.parse(stored);
            defaultIds = defaultSettings.participants || [];
          } else {
            const oldStored = localStorage.getItem('default_decision_participants');
            if (oldStored) {
              const parsed = JSON.parse(oldStored);
              if (Array.isArray(parsed)) defaultIds = parsed;
            }
          }
        } catch (e) {
          console.error('Error loading default participants:', e);
        }

        if (defaultSettings) {
          if (typeof defaultSettings.visibleToAll === 'boolean') setVisibleToAll(defaultSettings.visibleToAll);
          if (typeof defaultSettings.sendByEmail === 'boolean') setSendByEmail(defaultSettings.sendByEmail);
          if (typeof defaultSettings.sendViaMatrix === 'boolean') setSendViaMatrix(defaultSettings.sendViaMatrix);
        }

        if (defaultIds.length > 0) {
          const validDefaults = defaultIds.filter(id => 
            tenantUserIds.has(id) && id !== userData.user.id
          );
          if (validDefaults.length > 0) {
            setSelectedUsers(validDefaults);
            setProfilesLoaded(true);
            return; // Early return - don't fall through to Abgeordneter
          }
        }

        // Fallback: Pre-select Abgeordneter from the same tenant
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'abgeordneter');
        
        if (roleData && roleData.length > 0) {
          const abgeordneteInTenant = roleData
            .filter(r => tenantUserIds.has(r.user_id))
            .map(r => r.user_id);
          
          setSelectedUsers(abgeordneteInTenant);
        }
      }
      
      setProfilesLoaded(true);
    } catch (error) {
      console.error('Error loading profiles:', error);
      setProfilesLoaded(true);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Titel ein.",
        variant: "destructive",
      });
      return;
    }

    // For non-public decisions, at least one user must be selected
    if (!visibleToAll && selectedUsers.length === 0) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie mindestens einen Benutzer aus oder machen Sie die Entscheidung öffentlich.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('Starting decision creation...');
      
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
        task_id: taskId,
        title: title.trim(),
        description: description.trim() || null,
        created_by: userData.user.id,
        tenant_id: tenantData.tenant_id,
        visible_to_all: visibleToAll,
        response_options: JSON.parse(JSON.stringify(currentOptions)),
        priority: priority ? 1 : 0,
      };
      
      console.log('Creating decision with data:', insertData);
      console.log('Current user ID:', userData.user.id);
      console.log('User auth role:', userData.user.role);
      
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session exists:', !!session);
      console.log('Session user ID:', session?.user?.id);
      console.log('Session user aud:', session?.user?.aud);

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

      // Upload files if any were selected
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          try {
            const fileName = `${userData.user.id}/decisions/${decision.id}/${Date.now()}-${file.name}`;

            // Upload to storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('decision-attachments')
              .upload(fileName, file);

            if (uploadError) throw uploadError;

            // Extract email metadata if applicable
            let emailMeta: EmailMetadata | null = null;
            if (isEmlFile(file)) {
              try { emailMeta = (await parseEmlFile(file)).metadata; } catch (e) { console.error('EML parse error:', e); }
            } else if (isMsgFile(file)) {
              try { emailMeta = (await parseMsgFile(file)).metadata; } catch (e) { console.error('MSG parse error:', e); }
            }

            // Save to database
            const insertFileData: Record<string, unknown> = {
              decision_id: decision.id,
              file_path: uploadData.path,
              file_name: file.name,
              file_size: file.size,
              file_type: file.type,
              uploaded_by: userData.user.id,
            };
            if (emailMeta) {
              insertFileData.email_metadata = emailMeta;
            }

            const { error: dbError } = await supabase
              .from('task_decision_attachments')
              .insert(insertFileData as any);

            if (dbError) throw dbError;
          } catch (fileError) {
            console.error('File upload error:', fileError);
            toast({
              title: "Datei-Upload-Fehler",
              description: `${file.name} konnte nicht hochgeladen werden.`,
              variant: "destructive",
            });
          }
        }
      }

      // Save topics
      if (selectedTopicIds.length > 0) {
        await saveDecisionTopics(decision.id, selectedTopicIds);
      }

      // Add participants (only if users are selected)
      if (selectedUsers.length > 0) {
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
      }

      // Send notifications to participants
      for (const userId of selectedUsers) {
        const { error: notificationError } = await supabase.rpc('create_notification', {
          user_id_param: userId,
          type_name: 'task_decision_request',
          title_param: 'Neue Entscheidungsanfrage',
          message_param: `Sie wurden um eine Entscheidung gebeten: "${title.trim()}"`,
          data_param: JSON.stringify({
            decision_id: decision.id,
            task_id: taskId,
            decision_title: title.trim()
          }),
          priority_param: 'medium'
        });

        if (notificationError) {
          console.error('Error creating notification for user:', userId, notificationError);
        }
      }

      // Send Matrix notifications if requested
      if (sendViaMatrix) {
        try {
          toast({
            title: "Matrix-Nachrichten werden versendet...",
            description: "Die Matrix-Entscheidungsanfragen werden an die ausgewählten Teilnehmer gesendet.",
          });

          const { data: matrixResult, error: matrixError } = await supabase.functions.invoke('matrix-bot-handler', {
            body: {
              type: 'decision',
              decisionId: decision.id,
              participantIds: selectedUsers,
              decisionTitle: title.trim(),
              decisionDescription: description.trim() || null,
            },
          });

          if (matrixError) {
            console.error('Error sending Matrix decisions:', matrixError);
            toast({
              title: "Matrix-Fehler",
              description: `Matrix-Nachrichten konnten nicht versendet werden: ${matrixError.message}`,
              variant: "destructive",
            });
          } else if (matrixResult) {
            const successCount = matrixResult.sent || 0;
            const totalCount = matrixResult.total_participants || selectedUsers.length;
            
            if (successCount > 0) {
              toast({
                title: "Matrix-Nachrichten versendet",
                description: `${successCount}/${totalCount} Matrix-Entscheidungen erfolgreich versendet.`,
              });
            } else {
              toast({
                title: "Matrix-Warnung",
                description: "Keine Matrix-Nachrichten konnten versendet werden. Überprüfen Sie die Matrix-Konfiguration.",
                variant: "destructive",
              });
            }
          }
        } catch (matrixError: any) {
          console.error('Error sending Matrix decisions:', matrixError);
          toast({
            title: "Matrix-Fehler",
            description: `Unerwarteter Fehler beim Matrix-Versand: ${matrixError.message}`,
            variant: "destructive",
          });
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
              taskId: taskId,
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
        description: sendByEmail || sendViaMatrix
          ? "Entscheidungsanfrage wurde erstellt und Versand wird geprüft."
          : "Entscheidungsanfrage wurde erstellt.",
      });

      // Reset form
      setTitle("");
      setDescription("");
      setSelectedUsers([]);
      setSelectedFiles([]);
      setSelectedTopicIds([]);
      setSendByEmail(false);
      setSendViaMatrix(false);
      setVisibleToAll(true);
      setSelectedTemplateId(DEFAULT_TEMPLATE_ID);
      const resetTpl = getTemplateById(DEFAULT_TEMPLATE_ID);
      setCustomOptions(resetTpl ? resetTpl.options.map(o => ({ ...o })) : []);
      setProfilesLoaded(false); // Reset so defaults reload on next open
      handleOpenChange(false);
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

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {/* Only render trigger when NOT externally controlled */}
      {!isControlled && (
        <DialogTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={loadProfiles}
            className="text-destructive hover:text-destructive/80"
          >
            <Vote className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Entscheidung anfordern</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 my-4">
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
            <SimpleRichTextEditor
              initialContent={description}
              onChange={setDescription}
              placeholder="Zusätzliche Details zur Entscheidung"
              minHeight="100px"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="visible-to-all"
                checked={visibleToAll}
                onCheckedChange={(checked) => setVisibleToAll(checked === true)}
              />
              <label htmlFor="visible-to-all" className="text-sm font-medium flex items-center">
                <Globe className="h-4 w-4 mr-1" />
                Öffentlich (für alle Büromitarbeiter sichtbar)
              </label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Öffentliche Entscheidungen sind für alle Büromitarbeiter sichtbar. Die ausgewählten Benutzer können abstimmen.
            </p>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div>
              <label className="text-sm font-medium">Antworttyp</label>
              <Select
                value={selectedTemplateId}
                onValueChange={handleTemplateChange}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Antworttyp wählen" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(DECISION_TEMPLATES).map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex flex-col items-start">
                        <span>{template.name}</span>
                        <span className="text-xs text-muted-foreground">{template.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTemplateId === "custom" && (
              <ResponseOptionsEditor
                options={customOptions}
                onChange={setCustomOptions}
              />
            )}

            {currentOptions.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium shrink-0">Vorschau:</span>
                <ResponseOptionsPreview options={currentOptions} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Benutzer auswählen{!visibleToAll && ' (mindestens einer erforderlich)'}</label>
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
            <div className="space-y-3 pt-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="task-send-by-email"
                  checked={sendByEmail}
                  onCheckedChange={(checked) => setSendByEmail(checked === true)}
                />
                <label htmlFor="task-send-by-email" className="text-sm font-medium flex items-center">
                  <Mail className="h-4 w-4 mr-1" />
                  Auch per E-Mail versenden
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="task-send-via-matrix"
                  checked={sendViaMatrix}
                  onCheckedChange={(checked) => setSendViaMatrix(checked === true)}
                />
                <label htmlFor="task-send-via-matrix" className="text-sm font-medium flex items-center">
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Auch via Matrix versenden
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[70%_30%] gap-4">
            <div>
              <label className="text-sm font-medium">Dateien anhängen (optional)</label>
              <DecisionFileUpload
                mode="creation"
                onFilesSelected={(files) => setSelectedFiles(prev => [...prev, ...files])}
                canUpload={true}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Themen (optional)</label>
              <TopicSelector
                selectedTopicIds={selectedTopicIds}
                onTopicsChange={setSelectedTopicIds}
                compact
                placeholder="Themen hinzufügen..."
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="task-priority"
              checked={priority}
              onCheckedChange={(checked) => setPriority(checked === true)}
            />
            <label htmlFor="task-priority" className="text-sm font-medium flex items-center">
              <Star className="h-4 w-4 mr-1 text-amber-500" />
              Als prioritär markieren
            </label>
          </div>
        </div>
        
        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={() => handleOpenChange(false)}
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
      </DialogContent>
    </Dialog>
  );
};