import { useState, useEffect, useMemo } from "react";
import { useCaseFiles, CaseFileFormData, CASE_STATUSES, CaseFile } from "@/hooks/useCaseFiles";
import { useCaseFileTypes } from "@/hooks/useCaseFileTypes";
import { icons, LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MultiSelect } from "@/components/ui/multi-select-simple";
import { Lock, Users, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CaseFileEditDialogProps {
  caseFile: CaseFile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Profile {
  user_id: string;
  display_name: string | null;
}

export function CaseFileEditDialog({ caseFile, open, onOpenChange }: CaseFileEditDialogProps) {
  const { updateCaseFile } = useCaseFiles();
  const { caseFileTypes } = useCaseFileTypes();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CaseFileFormData>({
    title: "",
    description: "",
    case_type: "general",
    status: "active",
    priority: "medium",
    reference_number: "",
    is_private: false,
  });
  const [visibility, setVisibility] = useState<'private' | 'shared' | 'public'>('private');
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [participantRoles, setParticipantRoles] = useState<Record<string, 'viewer' | 'editor'>>({});
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoaded, setProfilesLoaded] = useState(false);

  const getIconComponent = (iconName?: string | null): LucideIcon | null => {
    if (!iconName) return null;
    const Icon = icons[iconName as keyof typeof icons] as LucideIcon;
    return Icon || null;
  };

  useEffect(() => {
    if (caseFile && open) {
      setFormData({
        title: caseFile.title,
        description: caseFile.description || "",
        case_type: caseFile.case_type,
        status: caseFile.status,
        priority: caseFile.priority || "medium",
        reference_number: caseFile.reference_number || "",
        start_date: caseFile.start_date || undefined,
        target_date: caseFile.target_date || undefined,
        is_private: caseFile.is_private,
      });
      
      // Determine visibility from the case file data
      const vis = (caseFile as any).visibility || (caseFile.is_private ? 'private' : 'public');
      setVisibility(vis);
      
      // Load existing participants
      loadParticipants();
      if (!profilesLoaded) loadProfiles();
    }
  }, [caseFile, open]);

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

  const loadParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from('case_file_participants')
        .select('user_id, role')
        .eq('case_file_id', caseFile.id);
      if (error) throw error;
      
      const ids = data?.map(p => p.user_id) || [];
      const roles: Record<string, 'viewer' | 'editor'> = {};
      data?.forEach(p => { roles[p.user_id] = p.role as 'viewer' | 'editor'; });
      
      setSelectedParticipantIds(ids);
      setParticipantRoles(roles);
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  const userOptions = useMemo(() => {
    return profiles.map(p => ({
      value: p.user_id,
      label: p.display_name || 'Unbekannter Benutzer',
    }));
  }, [profiles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setIsSubmitting(true);
    
    const submitData = {
      ...formData,
      is_private: visibility === 'private',
      visibility,
    };
    
    const success = await updateCaseFile(caseFile.id, submitData);

    if (success) {
      // Update participants: delete old, insert new
      await supabase.from('case_file_participants').delete().eq('case_file_id', caseFile.id);
      
      if (visibility === 'shared' && selectedParticipantIds.length > 0) {
        const participants = selectedParticipantIds.map(userId => ({
          case_file_id: caseFile.id,
          user_id: userId,
          role: participantRoles[userId] || 'viewer',
        }));
        await supabase.from('case_file_participants').insert(participants);
      }
      
      onOpenChange(false);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>FallAkte bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeiten Sie die Eigenschaften der FallAkte.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Titel *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="case_type">Typ</Label>
                <Select
                  value={formData.case_type}
                  onValueChange={(value) => setFormData({ ...formData, case_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {caseFileTypes.map((type) => {
                      const TypeIcon = getIconComponent(type.icon);
                      return (
                        <SelectItem key={type.id} value={type.name}>
                          <div className="flex items-center gap-2">
                            <span 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: type.color }}
                            />
                            {TypeIcon && <TypeIcon className="h-3 w-3" style={{ color: type.color }} />}
                            {type.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CASE_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="priority">Priorität</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="medium">Mittel</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                    <SelectItem value="urgent">Dringend</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reference_number">Aktenzeichen</Label>
                <Input
                  id="reference_number"
                  value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="start_date">Startdatum</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date || ""}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="target_date">Zieldatum</Label>
                <Input
                  id="target_date"
                  type="date"
                  value={formData.target_date || ""}
                  onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                />
              </div>
            </div>

            {/* Visibility */}
            <div className="grid gap-3">
              <Label>Sichtbarkeit</Label>
              <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as any)} className="gap-3">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="private" id="edit-vis-private" />
                  <Label htmlFor="edit-vis-private" className="flex items-center gap-2 cursor-pointer font-normal">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    Privat – nur für mich sichtbar
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="shared" id="edit-vis-shared" />
                  <Label htmlFor="edit-vis-shared" className="flex items-center gap-2 cursor-pointer font-normal">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Geteilt – bestimmte Personen
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="public" id="edit-vis-public" />
                  <Label htmlFor="edit-vis-public" className="flex items-center gap-2 cursor-pointer font-normal">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    Öffentlich – alle im Mandanten
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Participant selection for shared */}
            {visibility === 'shared' && (
              <div className="grid gap-3 p-3 border rounded-lg bg-muted/30">
                <Label>Teilnehmer auswählen</Label>
                {profilesLoaded ? (
                  <MultiSelect
                    options={userOptions}
                    selected={selectedParticipantIds}
                    onChange={setSelectedParticipantIds}
                    placeholder="Benutzer auswählen..."
                  />
                ) : (
                  <div className="h-10 bg-muted animate-pulse rounded-md" />
                )}
                
                {selectedParticipantIds.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Berechtigungen</Label>
                    {selectedParticipantIds.map(uid => {
                      const profile = profiles.find(p => p.user_id === uid);
                      return (
                        <div key={uid} className="flex items-center justify-between text-sm">
                          <span>{profile?.display_name || 'Unbekannt'}</span>
                          <Select
                            value={participantRoles[uid] || 'viewer'}
                            onValueChange={(v) => setParticipantRoles(prev => ({ ...prev, [uid]: v as 'viewer' | 'editor' }))}
                          >
                            <SelectTrigger className="w-32 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="viewer">Ansehen</SelectItem>
                              <SelectItem value="editor">Bearbeiten</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.title.trim()}>
              {isSubmitting ? "Speichere..." : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
