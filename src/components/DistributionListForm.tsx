import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { X, Users, Save, Search, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  name: string;
  email?: string;
  organization?: string;
  avatar_url?: string;
  category?: string;
}

interface DistributionListFormProps {
  distributionListId?: string;
  onSuccess?: () => void;
  onBack?: () => void;
}

export function DistributionListForm({ distributionListId, onSuccess, onBack }: DistributionListFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchContacts();
    if (distributionListId) {
      fetchDistributionList();
    }
  }, [distributionListId]);

  useEffect(() => {
    const filtered = contacts.filter(contact => 
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.organization?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredContacts(filtered);
  }, [contacts, searchQuery]);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, email, organization, avatar_url, category')
        .order('name');

      if (error) throw error;
      setContacts(data || []);
      setFilteredContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast({
        title: "Fehler",
        description: "Kontakte konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setContactsLoading(false);
    }
  };

  const fetchDistributionList = async () => {
    try {
      const { data: distributionList, error: listError } = await supabase
        .from('distribution_lists')
        .select('*')
        .eq('id', distributionListId)
        .single();

      if (listError) throw listError;

      setName(distributionList.name);
      setDescription(distributionList.description || "");
      setTopic(distributionList.topic || "");

      const { data: members, error: membersError } = await supabase
        .from('distribution_list_members')
        .select('contact_id')
        .eq('distribution_list_id', distributionListId);

      if (membersError) throw membersError;
      setSelectedContactIds(members?.map(m => m.contact_id) || []);
    } catch (error) {
      console.error('Error fetching distribution list:', error);
      toast({
        title: "Fehler",
        description: "Verteiler konnte nicht geladen werden.",
        variant: "destructive",
      });
    }
  };

  const handleContactToggle = (contactId: string) => {
    setSelectedContactIds(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Fehler", description: "Bitte geben Sie einen Namen für den Verteiler ein.", variant: "destructive" });
      return;
    }

    if (selectedContactIds.length === 0) {
      toast({ title: "Fehler", description: "Bitte wählen Sie mindestens einen Kontakt aus.", variant: "destructive" });
      return;
    }

    setLoading(true);
    
    try {
      let distributionListIdToUse = distributionListId;

      if (distributionListId) {
        const { error: updateError } = await supabase
          .from('distribution_lists')
          .update({ name, description, topic })
          .eq('id', distributionListId);

        if (updateError) throw updateError;

        const { error: deleteError } = await supabase
          .from('distribution_list_members')
          .delete()
          .eq('distribution_list_id', distributionListId);

        if (deleteError) throw deleteError;
      } else {
        const { data: newList, error: createError } = await supabase
          .from('distribution_lists')
          .insert({ user_id: user!.id, name, description, topic })
          .select()
          .single();

        if (createError) throw createError;
        distributionListIdToUse = newList.id;
      }

      const members = selectedContactIds.map(contactId => ({
        distribution_list_id: distributionListIdToUse,
        contact_id: contactId,
      }));

      const { error: membersError } = await supabase
        .from('distribution_list_members')
        .insert(members);

      if (membersError) throw membersError;

      toast({
        title: "Erfolg",
        description: distributionListId 
          ? "Verteiler wurde erfolgreich aktualisiert."
          : "Verteiler wurde erfolgreich erstellt.",
      });

      onSuccess?.();
    } catch (error) {
      console.error('Error saving distribution list:', error);
      toast({ title: "Fehler", description: "Verteiler konnte nicht gespeichert werden.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  const getCategoryLabel = (category?: string) => {
    switch (category) {
      case "citizen": return "Bürger";
      case "colleague": return "Kollege";
      case "business": return "Wirtschaft";
      case "media": return "Medien";
      case "lobbyist": return "Lobbyist";
      default: return category || "";
    }
  };

  const selectedContacts = selectedContactIds
    .map(id => contacts.find(c => c.id === id))
    .filter(Boolean) as Contact[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Button>
        )}
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {distributionListId ? 'Verteiler bearbeiten' : 'Neuer Verteiler'}
          </h2>
          <p className="text-sm text-muted-foreground">
            Erstellen Sie eine Sammlung von Kontakten für bestimmte Themen oder Zwecke
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Basic Information */}
        <Card className="bg-card shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Verteiler-Informationen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Name des Verteilers *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Umweltausschuss, Presseverteiler..." />
            </div>
            <div>
              <Label htmlFor="topic">Thema/Zweck</Label>
              <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="z.B. Klimaschutz, Verkehrspolitik..." />
            </div>
            <div>
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Weitere Details zum Verteiler..." rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Contact Selection */}
        <Card className="bg-card shadow-card border-border">
          <CardHeader>
            <CardTitle>Kontakte auswählen</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ausgewählt: {selectedContactIds.length} von {filteredContacts.length} Kontakten
              {searchQuery && ` (gefiltert aus ${contacts.length} Kontakten)`}
            </p>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Kontakte durchsuchen..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
            </div>

            {contactsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Kontakte werden geladen...</p>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {searchQuery ? 'Keine Kontakte für diese Suche gefunden.' : 'Keine Kontakte verfügbar.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 max-h-96 overflow-y-auto">
                {filteredContacts.map((contact) => (
                  <div key={contact.id} className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <Checkbox id={contact.id} checked={selectedContactIds.includes(contact.id)} onCheckedChange={() => handleContactToggle(contact.id)} />
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={contact.avatar_url} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">{getInitials(contact.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{contact.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {contact.email || contact.organization || "Keine weiteren Informationen"}
                      </p>
                    </div>
                    {contact.category && (
                      <Badge variant="outline" className="text-xs">{getCategoryLabel(contact.category)}</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected Contacts Preview as Table */}
        {selectedContacts.length > 0 && (
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle>Ausgewählte Kontakte ({selectedContacts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-9">Name</TableHead>
                      <TableHead className="h-9">E-Mail</TableHead>
                      <TableHead className="h-9 hidden sm:table-cell">Organisation</TableHead>
                      <TableHead className="h-9 hidden md:table-cell">Kategorie</TableHead>
                      <TableHead className="h-9 w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedContacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="py-2 font-medium">{contact.name}</TableCell>
                        <TableCell className="py-2 text-muted-foreground">{contact.email || '–'}</TableCell>
                        <TableCell className="py-2 text-muted-foreground hidden sm:table-cell">{contact.organization || '–'}</TableCell>
                        <TableCell className="py-2 hidden md:table-cell">
                          {contact.category && <Badge variant="outline" className="text-xs">{getCategoryLabel(contact.category)}</Badge>}
                        </TableCell>
                        <TableCell className="py-2">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleContactToggle(contact.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <Button onClick={handleSave} disabled={loading} className="gap-2">
            <Save className="h-4 w-4" />
            {loading ? "Wird gespeichert..." : "Verteiler speichern"}
          </Button>
          {onBack && (
            <Button variant="outline" onClick={onBack}>Abbrechen</Button>
          )}
        </div>
      </div>
    </div>
  );
}
