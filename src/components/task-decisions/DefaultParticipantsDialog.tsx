import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select-simple";
import { supabase } from "@/integrations/supabase/client";
import { useDefaultDecisionSettings } from "@/hooks/useDefaultDecisionSettings";
import { DecisionTabId, DEFAULT_DECISION_TAB_ORDER } from "@/hooks/useMyWorkSettings";
import { useToast } from "@/hooks/use-toast";
import { Settings, Globe, Mail, MessageSquare, Users, ArrowDown, ArrowUp } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface DefaultParticipantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decisionTabSettings?: {
    order: DecisionTabId[];
    hiddenTabs: DecisionTabId[];
    onSave: (settings: { order: DecisionTabId[]; hiddenTabs: DecisionTabId[] }) => Promise<boolean>;
  };
}

interface Profile {
  user_id: string;
  display_name: string | null;
}

const decisionTabLabels: Record<DecisionTabId, string> = {
  'for-me': 'Für mich',
  answered: 'Beantwortet',
  'my-decisions': 'Von mir',
  public: 'Öffentlich',
};

export function DefaultParticipantsDialog({ open, onOpenChange, decisionTabSettings }: DefaultParticipantsDialogProps) {
  const { settings, setSettings } = useDefaultDecisionSettings();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>(settings.participants);
  const [visibleToAll, setVisibleToAll] = useState(settings.visibleToAll);
  const [sendByEmail, setSendByEmail] = useState(settings.sendByEmail);
  const [sendViaMatrix, setSendViaMatrix] = useState(settings.sendViaMatrix);
  const [decisionTabOrder, setDecisionTabOrder] = useState<DecisionTabId[]>(decisionTabSettings?.order || DEFAULT_DECISION_TAB_ORDER);
  const [hiddenDecisionTabs, setHiddenDecisionTabs] = useState<DecisionTabId[]>(decisionTabSettings?.hiddenTabs || []);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (open && !loaded) {
      loadProfiles();
    }
    if (open) {
      setSelectedUsers(settings.participants);
      setVisibleToAll(settings.visibleToAll);
      setSendByEmail(settings.sendByEmail);
      setSendViaMatrix(settings.sendViaMatrix);
      if (decisionTabSettings) {
        setDecisionTabOrder(decisionTabSettings.order);
        setHiddenDecisionTabs(decisionTabSettings.hiddenTabs);
      }
    }
  }, [decisionTabSettings, open, settings]);

  const moveDecisionTab = (tab: DecisionTabId, direction: -1 | 1) => {
    setDecisionTabOrder((current) => {
      const idx = current.indexOf(tab);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const toggleDecisionTabHidden = (tab: DecisionTabId, hidden: boolean) => {
    setHiddenDecisionTabs((current) => {
      if (hidden) {
        const next = Array.from(new Set([...current, tab]));
        if (next.length >= decisionTabOrder.length) return current;
        return next;
      }
      return current.filter((item) => item !== tab);
    });
  };

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .order('display_name');
      if (error) throw error;
      setProfiles(data || []);
      setLoaded(true);
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  };

  const userOptions = useMemo(() => {
    return profiles.map(p => ({
      value: p.user_id,
      label: p.display_name || 'Unbekannter Benutzer',
    }));
  }, [profiles]);

  const handleSave = async () => {
    setSettings({
      participants: selectedUsers,
      visibleToAll,
      sendByEmail,
      sendViaMatrix,
    });

    if (decisionTabSettings) {
      const success = await decisionTabSettings.onSave({
        order: decisionTabOrder,
        hiddenTabs: hiddenDecisionTabs,
      });

      if (!success) {
        toast({
          title: "Fehler",
          description: "Tab-Einstellungen konnten nicht gespeichert werden.",
          variant: "destructive",
        });
        return;
      }
    }

    toast({
      title: "Gespeichert",
      description: "Standard-Einstellungen für neue Entscheidungen gespeichert.",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Standard-Einstellungen
          </DialogTitle>
          <DialogDescription>
            Diese Einstellungen werden bei neuen Entscheidungen automatisch vorausgewählt.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-5">
          {/* Participants */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <Users className="h-4 w-4" />
              Standard-Teilnehmer
            </Label>
            {loaded ? (
              <MultiSelect
                options={userOptions}
                selected={selectedUsers}
                onChange={setSelectedUsers}
                placeholder="Benutzer auswählen..."
              />
            ) : (
              <div className="h-10 bg-muted animate-pulse rounded-md" />
            )}
          </div>

          <Separator />

          {/* Toggles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="default-visible" className="flex items-center gap-1.5 text-sm">
                <Globe className="h-4 w-4" />
                Öffentlich (für alle sichtbar)
              </Label>
              <Switch
                id="default-visible"
                checked={visibleToAll}
                onCheckedChange={setVisibleToAll}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="default-email" className="flex items-center gap-1.5 text-sm">
                <Mail className="h-4 w-4" />
                Per E-Mail versenden
              </Label>
              <Switch
                id="default-email"
                checked={sendByEmail}
                onCheckedChange={setSendByEmail}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="default-matrix" className="flex items-center gap-1.5 text-sm">
                <MessageSquare className="h-4 w-4" />
                Via Matrix versenden
              </Label>
              <Switch
                id="default-matrix"
                checked={sendViaMatrix}
                onCheckedChange={setSendViaMatrix}
              />
            </div>
          </div>

          {decisionTabSettings && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-medium">Reihenfolge & Sichtbarkeit der Tabs</Label>
                <p className="text-xs text-muted-foreground">
                  Gilt für „Meine Arbeit / Entscheidungen“ und „Aufgaben / Entscheidungen“.
                </p>
                <div className="space-y-2">
                  {decisionTabOrder.map((tab, index) => {
                    const isHidden = hiddenDecisionTabs.includes(tab);
                    return (
                      <div key={tab} className="flex items-center justify-between rounded-md border px-3 py-2 gap-2">
                        <span className="text-sm">{decisionTabLabels[tab]}</span>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={!isHidden}
                            onCheckedChange={(visible) => toggleDecisionTabHidden(tab, !visible)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveDecisionTab(tab, -1)}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveDecisionTab(tab, 1)}
                            disabled={index === decisionTabOrder.length - 1}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
