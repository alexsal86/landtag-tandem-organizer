import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface Profile {
  user_id: string;
  display_name: string;
  avatar_url?: string;
}

interface MessageComposerProps {
  onClose: () => void;
  onSent: () => void;
}

export function MessageComposer({ onClose, onSent }: MessageComposerProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isForAllUsers, setIsForAllUsers] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .neq('user_id', user?.id);
      
      setProfiles(data || []);
    };

    if (user) {
      fetchProfiles();
    }
  }, [user]);

  const handleRecipientToggle = (userId: string) => {
    setSelectedRecipients(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSend = async () => {
    if (!user || !title.trim() || !content.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Felder aus.",
        variant: "destructive"
      });
      return;
    }

    if (!isForAllUsers && selectedRecipients.length === 0) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie mindestens einen Empfänger aus.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      await (supabase as any)
        .rpc('send_message', {
          author_id_param: user.id,
          title_param: title.trim(),
          content_param: content.trim(),
          is_for_all_param: isForAllUsers,
          recipient_ids_param: isForAllUsers ? [] : selectedRecipients
        });

      toast({
        title: "Nachricht gesendet",
        description: "Ihre Nachricht wurde erfolgreich versendet."
      });

      onSent();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Fehler",
        description: "Die Nachricht konnte nicht gesendet werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg">Neue Nachricht</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Betreff</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nachrichtentitel eingeben..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">Nachricht</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Nachrichteninhalt eingeben..."
            rows={4}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox 
            id="all-users"
            checked={isForAllUsers}
            onCheckedChange={(checked) => setIsForAllUsers(checked as boolean)}
          />
          <Label htmlFor="all-users">An alle Benutzer senden</Label>
        </div>

        {!isForAllUsers && (
          <div className="space-y-2">
            <Label>Empfänger auswählen</Label>
            <ScrollArea className="h-48 border rounded-lg p-2">
              {profiles.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Keine anderen Benutzer gefunden
                </p>
              ) : (
                <div className="space-y-2">
                  {profiles.map((profile) => (
                    <div key={profile.user_id} className="flex items-center space-x-2">
                      <Checkbox
                        id={profile.user_id}
                        checked={selectedRecipients.includes(profile.user_id)}
                        onCheckedChange={() => handleRecipientToggle(profile.user_id)}
                      />
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={profile.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {profile.display_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <Label 
                        htmlFor={profile.user_id}
                        className="cursor-pointer flex-1"
                      >
                        {profile.display_name || 'Unbekannt'}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={handleSend} disabled={loading}>
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Senden
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}