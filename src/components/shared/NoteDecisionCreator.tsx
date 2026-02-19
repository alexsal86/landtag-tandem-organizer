import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { ResponseOptionsEditor } from "@/components/task-decisions/ResponseOptionsEditor";
import { ResponseOption, DECISION_TEMPLATES, DEFAULT_TEMPLATE_ID, getTemplateById } from "@/lib/decisionTemplates";
import { ResponseOptionsPreview } from "@/components/task-decisions/ResponseOptionsPreview";
import { DecisionFileUpload } from "@/components/task-decisions/DecisionFileUpload";
import { useDecisionAttachmentUpload } from "@/hooks/useDecisionAttachmentUpload";
import { TopicSelector } from "@/components/topics/TopicSelector";
import { saveDecisionTopics } from "@/hooks/useDecisionTopics";
import { Vote, Loader2, Mail, MessageSquare, Globe, Paperclip, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";

import type { QuickNote } from "./QuickNotesList";

interface NoteDecisionCreatorProps {
  note: QuickNote;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDecisionCreated: () => void;
}

interface Profile {
  user_id: string;
  display_name: string | null;
}

export function NoteDecisionCreator({
  note,
  open,
  onOpenChange,
  onDecisionCreated
}: NoteDecisionCreatorProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [responseDeadline, setResponseDeadline] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [sendByEmail, setSendByEmail] = useState(true);
  const [sendViaMatrix, setSendViaMatrix] = useState(true);
  const defaultTemplate = getTemplateById(DEFAULT_TEMPLATE_ID);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(DEFAULT_TEMPLATE_ID);
  const [customOptions, setCustomOptions] = useState<ResponseOption[]>(
    defaultTemplate ? defaultTemplate.options.map(o => ({ ...o })) : []
  );
  const [visibleToAll, setVisibleToAll] = useState(true);
  const [priority, setPriority] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const hasInitializedRef = useRef(false);
  const { uploadDecisionAttachments } = useDecisionAttachmentUpload();

  // Initialize from note content
  useEffect(() => {
    if (open && note) {
      const noteTitle = note.title || note.content.split('\n')[0].replace(/<[^>]*>/g, '').substring(0, 100);
      setTitle(noteTitle);
      setDescription(note.content);
    }
    if (!open) {
      hasInitializedRef.current = false; // Reset when dialog closes
    }
  }, [open, note]);

  // Load profiles
  useEffect(() => {
    if (open && currentTenant?.id) {
      loadProfiles();
    }
  }, [open, currentTenant?.id]);

  const loadProfiles = async () => {
    if (!currentTenant?.id) return;
    
    setProfilesLoading(true);
    try {
      // Get users in tenant
      const { data: memberships, error: membershipError } = await supabase
        .from("user_tenant_memberships")
        .select("user_id")
        .eq("tenant_id", currentTenant.id)
        .eq("is_active", true);

      if (membershipError) throw membershipError;

      const userIds = memberships?.map(m => m.user_id) || [];
      
      if (userIds.length === 0) {
        setProfiles([]);
        return;
      }

      // Get profiles
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      if (profileError) throw profileError;
      
      const filteredProfiles = (profileData || []).filter(p => p.user_id !== user?.id);
      setProfiles(filteredProfiles);

      // Only set selected users on first initialization (prevents overwriting user changes)
      if (hasInitializedRef.current) return;
      hasInitializedRef.current = true;

      // Check for default settings first
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
        // Use stored default participants (filter to valid tenant members, exclude self)
        const validDefaults = defaultIds.filter(id => userIds.includes(id) && id !== user?.id);
        if (validDefaults.length > 0) {
          setSelectedUsers(validDefaults);
          return; // Early return - don't fall through to Abgeordneter fallback
        }
        // If all defaults were invalid, fall through to Abgeordneter fallback
      }
      
      // Fallback: Auto-select Abgeordneter
      const { data: abgeordneterRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "abgeordneter")
        .in("user_id", userIds);

      if (abgeordneterRoles && abgeordneterRoles.length > 0) {
        const abgeordneterIds = abgeordneterRoles
          .map(r => r.user_id)
          .filter(id => id !== user?.id);
        if (abgeordneterIds.length > 0) {
          setSelectedUsers(abgeordneterIds);
        }
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
      toast.error("Fehler beim Laden der Benutzer");
    } finally {
      setProfilesLoading(false);
    }
  };

  const currentOptions = useMemo(() => customOptions, [customOptions]);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId !== "custom") {
      const template = getTemplateById(templateId);
      if (template) {
        setCustomOptions(template.options.map(option => ({ ...option })));
      }
    }
  };

  const userOptions = useMemo(() => {
    return profiles.map(p => ({
      value: p.user_id,
      label: p.display_name || 'Unbekannt'
    }));
  }, [profiles]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Bitte geben Sie einen Titel ein");
      return;
    }

    if (!visibleToAll && selectedUsers.length === 0) {
      toast.error("Bitte wählen Sie mindestens einen Teilnehmer aus oder machen Sie die Anfrage öffentlich");
      return;
    }

    if (!user?.id || !currentTenant?.id) {
      toast.error("Nicht angemeldet");
      return;
    }

    setLoading(true);
    try {
      // Create the decision
      const insertData = {
        title: title.trim(),
        description,
        created_by: user.id,
        tenant_id: currentTenant.id,
        status: "active",
        response_options: JSON.parse(JSON.stringify(currentOptions)),
        visible_to_all: visibleToAll,
        response_deadline: responseDeadline ? new Date(responseDeadline).toISOString() : null,
        priority: priority ? 1 : 0,
      };

      console.log('NoteDecisionCreator: Creating decision with data:', insertData);

      const { data: decision, error: decisionError } = await supabase
        .from("task_decisions")
        .insert([insertData])
        .select()
        .single();

      if (decisionError) throw decisionError;

      // Link to note
      const { error: noteError } = await supabase
        .from("quick_notes")
        .update({ decision_id: decision.id })
        .eq("id", note.id)
        .eq("user_id", user.id);

      if (noteError) {
        console.warn('Error linking decision to note:', noteError);
      }

      // Add participants (only if there are any)
      if (selectedUsers.length > 0) {
        const participantInserts = selectedUsers.map(userId => ({
          decision_id: decision.id,
          user_id: userId
        }));

        const { error: participantError } = await supabase
          .from("task_decision_participants")
          .insert(participantInserts);

        if (participantError) throw participantError;
      }

      // Send notifications
      if (sendByEmail || sendViaMatrix) {
        for (const userId of selectedUsers) {
          // Create notification
          const { error: notificationError } = await supabase.rpc("create_notification", {
            user_id_param: userId,
            type_name: "task_decision_request",
            title_param: "Neue Entscheidungsanfrage",
            message_param: `${profiles.find(p => p.user_id === user.id)?.display_name || 'Jemand'} bittet um Ihre Entscheidung: "${title}"`,
            data_param: JSON.stringify({ decision_id: decision.id, link: `/mywork?tab=decisions` }),
            priority_param: 'medium'
          });

          if (notificationError) {
            console.warn('Notification error for user:', userId, notificationError);
          }

          // Get participant token for email
          if (sendByEmail) {
            const { data: participant } = await supabase
              .from("task_decision_participants")
              .select("id")
              .eq("decision_id", decision.id)
              .eq("user_id", userId)
              .single();

            if (participant) {
              try {
                await supabase.functions.invoke("send-decision-email", {
                  body: {
                    participantId: participant.id,
                    decisionId: decision.id
                  }
                });
              } catch (emailError) {
                console.warn('Email sending failed:', emailError);
              }
            }
          }
        }
      }

      // Upload files
      if (selectedFiles.length > 0) {
        const uploadResult = await uploadDecisionAttachments({
          decisionId: decision.id,
          userId: user.id,
          files: selectedFiles,
          onFileStart: (file, index, total) => {
            setUploadStatus(`Lade Anhang ${index + 1}/${total}: ${file.name}`);
          },
        });

        if (uploadResult.failed.length > 0) {
          toast.error('Anhänge nur teilweise gespeichert', {
            description: uploadResult.failed.map(f => `${f.fileName}: ${f.reason}`).join(' | '),
          });
        }
      }

      // Save topics
      if (selectedTopicIds.length > 0) {
        await saveDecisionTopics(decision.id, selectedTopicIds);
      }

      toast.success("Entscheidungsanfrage erstellt");
      onOpenChange(false);
      onDecisionCreated();

      // Reset form
      setTitle("");
      setDescription("");
      setSelectedUsers([]);
      setResponseDeadline("");
      setSelectedTemplateId(DEFAULT_TEMPLATE_ID);
      setCustomOptions(defaultTemplate ? defaultTemplate.options.map(o => ({ ...o })) : []);
      setVisibleToAll(true);
      setPriority(false);
      setSelectedFiles([]);
      setSelectedTopicIds([]);
      setUploadStatus(null);
    } catch (error) {
      setUploadStatus(null);
      console.error('Error creating decision:', error);
      toast.error("Fehler beim Erstellen der Entscheidungsanfrage");
    } finally {
      setLoading(false);
      setUploadStatus(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen && loading) return;
      onOpenChange(nextOpen);
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Vote className="h-5 w-5 text-purple-600" />
            Entscheidungsanfrage aus Notiz
          </DialogTitle>
          <DialogDescription>
            Erstellen Sie eine Entscheidungsanfrage basierend auf dieser Notiz
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titel</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Worüber soll entschieden werden?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="response-deadline">Antwortfrist (optional)</Label>
            <Input
              id="response-deadline"
              type="datetime-local"
              value={responseDeadline}
              onChange={(e) => setResponseDeadline(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung</Label>
            <SimpleRichTextEditor
              initialContent={description}
              onChange={setDescription}
              placeholder="Weitere Details zur Entscheidung..."
            />
          </div>

          <div className="space-y-2">
            <Label>Antwortoptionen</Label>
            <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
              <SelectTrigger>
                <SelectValue placeholder="Vorlage wählen" />
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
            
            {(selectedTemplateId === 'custom' || selectedTemplateId === 'rating5' || selectedTemplateId === 'optionABC') && (
              <ResponseOptionsEditor
                options={customOptions}
                onChange={setCustomOptions}
              />
            )}
            
            <ResponseOptionsPreview options={currentOptions} />
          </div>

          <div className="space-y-2">
            <Label>Teilnehmer</Label>
            {profilesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Benutzer werden geladen...
              </div>
            ) : (
              <MultiSelect
                options={userOptions}
                selected={selectedUsers}
                onChange={setSelectedUsers}
                placeholder="Teilnehmer auswählen..."
              />
            )}
          </div>

          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="visible-to-all"
                checked={visibleToAll}
                onCheckedChange={(checked) => setVisibleToAll(checked === true)}
              />
              <Label htmlFor="visible-to-all" className="flex items-center gap-1 text-sm cursor-pointer">
                <Globe className="h-3.5 w-3.5" />
                Öffentlich (für alle sichtbar)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="priority"
                checked={priority}
                onCheckedChange={(checked) => setPriority(checked === true)}
              />
              <Label htmlFor="priority" className="flex items-center gap-1 text-sm cursor-pointer">
                <Star className="h-3.5 w-3.5 text-amber-500" />
                Als prioritär markieren
              </Label>
            </div>
          </div>

          {/* Themen */}
          <div className="space-y-2">
            <Label>Themen (optional)</Label>
            <TopicSelector
              selectedTopicIds={selectedTopicIds}
              onTopicsChange={setSelectedTopicIds}
              compact
              placeholder="Themen hinzufügen..."
            />
          </div>

          {/* Dateien */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" />
              Dateien anhängen (optional)
            </Label>
            <DecisionFileUpload
              mode="creation"
              onFilesSelected={setSelectedFiles}
              canUpload={true}
            />
          </div>

          <div className="flex items-center gap-6 pt-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="sendByEmail"
                checked={sendByEmail}
                onCheckedChange={(checked) => setSendByEmail(checked === true)}
              />
              <Label htmlFor="sendByEmail" className="flex items-center gap-1 text-sm cursor-pointer">
                <Mail className="h-3.5 w-3.5" />
                Auch per E-Mail versenden
              </Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Checkbox
                id="sendViaMatrix"
                checked={sendViaMatrix}
                onCheckedChange={(checked) => setSendViaMatrix(checked === true)}
              />
              <Label htmlFor="sendViaMatrix" className="flex items-center gap-1 text-sm cursor-pointer">
                <MessageSquare className="h-3.5 w-3.5" />
                Auch via Matrix versenden
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {uploadStatus ?? "Erstellen..."}
              </>
            ) : (
              <>
                <Vote className="h-4 w-4 mr-2" />
                Anfrage senden
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
