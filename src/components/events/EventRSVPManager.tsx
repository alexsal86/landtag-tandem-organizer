import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, Plus, Mail, Send, Check, X, AlertCircle, Clock, Bell, MessageSquare, BookmarkPlus, ListPlus } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { ContactSelector } from '@/components/ContactSelector';

interface EventRSVP {
  id: string;
  email: string;
  name: string;
  status: string;
  comment?: string;
  responded_at?: string;
  invited_at?: string;
  token: string;
  invitation_sent: boolean;
  reminder_sent_at?: string;
  reminder_count: number;
  notes_sent: any[];
  custom_message?: string;
}

interface EventRSVPManagerProps {
  eventPlanningId: string;
  eventTitle: string;
}

const DEFAULT_INVITATION_TEXT = `Hallo {name},

Sie sind herzlich zur Veranstaltung "{eventTitle}" eingeladen.

Bitte teilen Sie uns mit, ob Sie teilnehmen können.

Mit freundlichen Grüßen`;

const DEFAULT_REMINDER_TEXT = `Hallo {name},

wir möchten Sie freundlich an die Veranstaltung "{eventTitle}" erinnern.

Bitte teilen Sie uns mit, ob Sie teilnehmen können.

Mit freundlichen Grüßen`;

export const EventRSVPManager = ({ eventPlanningId, eventTitle }: EventRSVPManagerProps) => {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [rsvps, setRsvps] = useState<EventRSVP[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [pendingInvites, setPendingInvites] = useState<{ name: string; email: string }[]>([]);
  const [sending, setSending] = useState(false);

  // Email customization
  const [customEmailText, setCustomEmailText] = useState(DEFAULT_INVITATION_TEXT.replace('{eventTitle}', eventTitle));
  const [showEmailEditor, setShowEmailEditor] = useState(false);

  // Reminder dialog
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [reminderText, setReminderText] = useState(DEFAULT_REMINDER_TEXT.replace('{eventTitle}', eventTitle));
  const [reminderTargetIds, setReminderTargetIds] = useState<string[]>([]);
  const [sendingReminder, setSendingReminder] = useState(false);

  // Note/hint dialog
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteTarget, setNoteTarget] = useState<'accepted' | 'tentative' | 'all'>('accepted');
  const [sendingNote, setSendingNote] = useState(false);

  // Distribution list
  const [distributionLists, setDistributionLists] = useState<any[]>([]);
  const [selectedDistList, setSelectedDistList] = useState('');

  useEffect(() => {
    loadRSVPs();
    loadDistributionLists();
  }, [eventPlanningId]);

  const loadRSVPs = async () => {
    try {
      const { data, error } = await supabase
        .from('event_rsvps')
        .select('*')
        .eq('event_planning_id', eventPlanningId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRsvps((data || []).map(r => ({
        ...r,
        invitation_sent: r.invitation_sent ?? false,
        reminder_count: r.reminder_count ?? 0,
        notes_sent: (r.notes_sent as any[]) ?? [],
      })));
    } catch (error) {
      console.error('Error loading RSVPs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDistributionLists = async () => {
    try {
      const { data } = await supabase
        .from('distribution_lists')
        .select('id, name')
        .order('name');
      setDistributionLists(data || []);
    } catch (e) {
      console.error('Error loading distribution lists:', e);
    }
  };

  const addFromContact = (contact: any) => {
    if (!contact.email) {
      toast({ title: "Keine E-Mail", description: "Kontakt hat keine E-Mail-Adresse.", variant: "destructive" });
      return;
    }
    if (pendingInvites.find(p => p.email === contact.email) || rsvps.find(r => r.email === contact.email)) {
      toast({ title: "Bereits vorhanden", variant: "destructive" });
      return;
    }
    setPendingInvites(prev => [...prev, { name: contact.name, email: contact.email }]);
  };

  const addFromDistributionList = async (listId: string) => {
    try {
      const { data: members } = await supabase
        .from('distribution_list_members')
        .select('contact_id')
        .eq('distribution_list_id', listId);

      if (!members?.length) {
        toast({ title: "Leere Liste", description: "Die Verteilerliste hat keine Mitglieder.", variant: "destructive" });
        return;
      }

      const contactIds = members.map(m => m.contact_id);
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email')
        .in('id', contactIds);

      let added = 0;
      (contacts || []).forEach(c => {
        if (!c.email) return;
        const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email;
        if (pendingInvites.find(p => p.email === c.email) || rsvps.find(r => r.email === c.email)) return;
        setPendingInvites(prev => [...prev, { name, email: c.email! }]);
        added++;
      });

      toast({ title: `${added} Kontakt(e) hinzugefügt` });
      setSelectedDistList('');
    } catch (e) {
      console.error('Error loading distribution list members:', e);
    }
  };

  const addExternalEmail = () => {
    if (!newEmail) return;
    if (pendingInvites.find(p => p.email === newEmail) || rsvps.find(r => r.email === newEmail)) {
      toast({ title: "Bereits vorhanden", variant: "destructive" });
      return;
    }
    setPendingInvites(prev => [...prev, { name: newEmail.split('@')[0], email: newEmail }]);
    setNewEmail('');
  };

  const removePending = (email: string) => {
    setPendingInvites(prev => prev.filter(p => p.email !== email));
  };

  // Save as draft (vormerken) without sending emails
  const saveDraft = async () => {
    if (pendingInvites.length === 0) return;
    setSending(true);
    try {
      const rsvpData = pendingInvites.map(p => ({
        event_planning_id: eventPlanningId,
        email: p.email,
        name: p.name,
        tenant_id: currentTenant?.id,
        invitation_sent: false,
      }));

      const { error: insertError } = await supabase
        .from('event_rsvps')
        .insert(rsvpData);

      if (insertError) throw insertError;

      toast({
        title: "Vorgemerkt",
        description: `${pendingInvites.length} Gast/Gäste vorgemerkt. Einladungen können später versendet werden.`,
      });

      setPendingInvites([]);
      setDialogOpen(false);
      loadRSVPs();
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({ title: "Fehler", description: "Vormerken fehlgeschlagen.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // Send invitations (new or unsent)
  const sendInvitations = async (rsvpIdsToSend?: string[]) => {
    setSending(true);
    try {
      let idsToSend = rsvpIdsToSend;

      // If no specific IDs, insert pending invites first
      if (!idsToSend) {
        if (pendingInvites.length === 0) return;

        const rsvpData = pendingInvites.map(p => ({
          event_planning_id: eventPlanningId,
          email: p.email,
          name: p.name,
          tenant_id: currentTenant?.id,
          invitation_sent: false,
        }));

        const { data: insertedRsvps, error: insertError } = await supabase
          .from('event_rsvps')
          .insert(rsvpData)
          .select();

        if (insertError) throw insertError;
        idsToSend = (insertedRsvps || []).map(r => r.id);
      }

      if (idsToSend && idsToSend.length > 0) {
        try {
          await supabase.functions.invoke('send-event-invitation', {
            body: {
              eventPlanningId,
              eventTitle,
              rsvpIds: idsToSend,
              type: 'invitation',
              customMessage: customEmailText,
            }
          });

          // Mark as sent
          await supabase
            .from('event_rsvps')
            .update({ invitation_sent: true, invited_at: new Date().toISOString() })
            .in('id', idsToSend);

        } catch (emailError) {
          console.error('Email sending failed:', emailError);
        }
      }

      toast({
        title: "Einladungen versendet",
        description: `${idsToSend?.length || pendingInvites.length} Einladung(en) wurden versendet.`,
      });

      setPendingInvites([]);
      setDialogOpen(false);
      setShowEmailEditor(false);
      loadRSVPs();
    } catch (error) {
      console.error('Error sending invitations:', error);
      toast({ title: "Fehler", description: "Einladungen konnten nicht versendet werden.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // Send unsent invitations (vorgemerkte)
  const sendUnsentInvitations = async () => {
    const unsent = rsvps.filter(r => !r.invitation_sent);
    if (unsent.length === 0) {
      toast({ title: "Keine ausstehenden Einladungen" });
      return;
    }
    await sendInvitations(unsent.map(r => r.id));
  };

  // Send reminder
  const sendReminder = async () => {
    if (reminderTargetIds.length === 0) return;
    setSendingReminder(true);
    try {
      await supabase.functions.invoke('send-event-invitation', {
        body: {
          eventPlanningId,
          eventTitle,
          rsvpIds: reminderTargetIds,
          type: 'reminder',
          customMessage: reminderText,
        }
      });

      // Update reminder tracking
      for (const id of reminderTargetIds) {
        const rsvp = rsvps.find(r => r.id === id);
        await supabase
          .from('event_rsvps')
          .update({
            reminder_sent_at: new Date().toISOString(),
            reminder_count: (rsvp?.reminder_count || 0) + 1,
          })
          .eq('id', id);
      }

      toast({ title: "Erinnerung versendet", description: `${reminderTargetIds.length} Erinnerung(en) versendet.` });
      setReminderDialogOpen(false);
      loadRSVPs();
    } catch (error) {
      console.error('Error sending reminder:', error);
      toast({ title: "Fehler", description: "Erinnerung konnte nicht versendet werden.", variant: "destructive" });
    } finally {
      setSendingReminder(false);
    }
  };

  // Send note/hint to accepted guests
  const sendNote = async () => {
    if (!noteText.trim()) return;
    setSendingNote(true);
    try {
      const targetStatuses = noteTarget === 'all'
        ? ['accepted', 'tentative']
        : [noteTarget];

      const targetRsvps = rsvps.filter(r => targetStatuses.includes(r.status));
      if (targetRsvps.length === 0) {
        toast({ title: "Keine Empfänger", description: "Keine Gäste mit dem gewählten Status.", variant: "destructive" });
        setSendingNote(false);
        return;
      }

      const targetIds = targetRsvps.map(r => r.id);

      await supabase.functions.invoke('send-event-invitation', {
        body: {
          eventPlanningId,
          eventTitle,
          rsvpIds: targetIds,
          type: 'note',
          customMessage: noteText,
        }
      });

      // Track sent notes
      const noteEntry = { text: noteText, sent_at: new Date().toISOString(), target: noteTarget };
      for (const rsvp of targetRsvps) {
        const existingNotes = Array.isArray(rsvp.notes_sent) ? rsvp.notes_sent : [];
        await supabase
          .from('event_rsvps')
          .update({ notes_sent: [...existingNotes, noteEntry] })
          .eq('id', rsvp.id);
      }

      toast({ title: "Hinweis versendet", description: `${targetRsvps.length} Nachricht(en) versendet.` });
      setNoteDialogOpen(false);
      setNoteText('');
      loadRSVPs();
    } catch (error) {
      console.error('Error sending note:', error);
      toast({ title: "Fehler", description: "Hinweis konnte nicht versendet werden.", variant: "destructive" });
    } finally {
      setSendingNote(false);
    }
  };

  const deleteRSVP = async (rsvpId: string) => {
    try {
      const { error } = await supabase
        .from('event_rsvps')
        .delete()
        .eq('id', rsvpId);

      if (error) throw error;
      setRsvps(prev => prev.filter(r => r.id !== rsvpId));
      toast({ title: "Einladung entfernt" });
    } catch (error) {
      console.error('Error deleting RSVP:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted': return <Badge className="bg-green-500 text-white"><Check className="h-3 w-3 mr-1" />Zugesagt</Badge>;
      case 'declined': return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Abgesagt</Badge>;
      case 'tentative': return <Badge className="bg-yellow-500 text-white"><AlertCircle className="h-3 w-3 mr-1" />Vorbehalt</Badge>;
      default: return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Eingeladen</Badge>;
    }
  };

  const accepted = rsvps.filter(r => r.status === 'accepted').length;
  const declined = rsvps.filter(r => r.status === 'declined').length;
  const tentative = rsvps.filter(r => r.status === 'tentative').length;
  const pending = rsvps.filter(r => r.status === 'invited').length;
  const unsent = rsvps.filter(r => !r.invitation_sent).length;

  const openReminderForPending = () => {
    const pendingRsvps = rsvps.filter(r => r.status === 'invited' && r.invitation_sent);
    setReminderTargetIds(pendingRsvps.map(r => r.id));
    setReminderText(DEFAULT_REMINDER_TEXT.replace('{eventTitle}', eventTitle));
    setReminderDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Einladungen & RSVP
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            {unsent > 0 && (
              <Button size="sm" variant="outline" onClick={sendUnsentInvitations} disabled={sending}>
                <Send className="h-4 w-4 mr-2" />
                {unsent} Vorgemerkte senden
              </Button>
            )}
            {rsvps.some(r => r.status === 'invited' && r.invitation_sent) && (
              <Button size="sm" variant="outline" onClick={openReminderForPending}>
                <Bell className="h-4 w-4 mr-2" />
                Erinnerung
              </Button>
            )}
            {rsvps.some(r => r.status === 'accepted' || r.status === 'tentative') && (
              <Button size="sm" variant="outline" onClick={() => setNoteDialogOpen(true)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Hinweis senden
              </Button>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Gäste einladen
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Gäste einladen</DialogTitle>
                  <DialogDescription>Kontakte, Verteilerlisten oder E-Mail-Adressen hinzufügen.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm">Aus Kontakten</Label>
                    <ContactSelector
                      onSelect={addFromContact}
                      placeholder="Kontakt auswählen..."
                      clearAfterSelect={true}
                    />
                  </div>

                  {distributionLists.length > 0 && (
                    <div>
                      <Label className="text-sm">Aus Verteilerliste</Label>
                      <div className="flex gap-2">
                        <Select value={selectedDistList} onValueChange={setSelectedDistList}>
                          <SelectTrigger>
                            <SelectValue placeholder="Verteilerliste wählen..." />
                          </SelectTrigger>
                          <SelectContent>
                            {distributionLists.map(dl => (
                              <SelectItem key={dl.id} value={dl.id}>{dl.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!selectedDistList}
                          onClick={() => selectedDistList && addFromDistributionList(selectedDistList)}
                        >
                          <ListPlus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-sm">E-Mail-Adresse</Label>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="gast@email.de"
                        onKeyPress={(e) => e.key === 'Enter' && addExternalEmail()}
                      />
                      <Button onClick={addExternalEmail} size="sm" variant="outline">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {pendingInvites.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm">Ausstehende Einladungen ({pendingInvites.length}):</Label>
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                        {pendingInvites.map((p) => (
                          <Badge key={p.email} variant="secondary" className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {p.name}
                            <button onClick={() => removePending(p.email)} className="ml-1 hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Email customization toggle */}
                  {pendingInvites.length > 0 && (
                    <div className="space-y-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowEmailEditor(!showEmailEditor)}
                        className="text-xs"
                      >
                        <Mail className="h-3 w-3 mr-1" />
                        {showEmailEditor ? 'E-Mail-Text ausblenden' : 'E-Mail-Text anpassen'}
                      </Button>
                      {showEmailEditor && (
                        <Textarea
                          value={customEmailText}
                          onChange={(e) => setCustomEmailText(e.target.value)}
                          rows={6}
                          className="text-sm"
                          placeholder="Einladungstext..."
                        />
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
                    <Button
                      variant="secondary"
                      onClick={saveDraft}
                      disabled={sending || pendingInvites.length === 0}
                    >
                      <BookmarkPlus className="h-4 w-4 mr-2" />
                      Vormerken
                    </Button>
                    <Button onClick={() => sendInvitations()} disabled={sending || pendingInvites.length === 0}>
                      <Send className="h-4 w-4 mr-2" />
                      {sending ? 'Sende...' : `Jetzt senden (${pendingInvites.length})`}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center text-muted-foreground animate-pulse py-4">Lädt...</div>
        ) : rsvps.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Noch keine Einladungen versendet.
          </div>
        ) : (
          <>
            <div className="flex gap-3 mb-4 text-sm flex-wrap">
              <span className="text-green-600 font-medium">{accepted} zugesagt</span>
              <span className="text-yellow-600 font-medium">{tentative} Vorbehalt</span>
              <span className="text-destructive font-medium">{declined} abgesagt</span>
              <span className="text-muted-foreground">{pending} ausstehend</span>
              {unsent > 0 && <span className="text-orange-500 font-medium">{unsent} vorgemerkt</span>}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>E-Mail</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Gesendet</TableHead>
                    <TableHead className="text-center">Erinnerungen</TableHead>
                    <TableHead className="text-center">Antwort am</TableHead>
                    <TableHead className="text-center">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rsvps.map((rsvp) => (
                    <TableRow key={rsvp.id}>
                      <TableCell className="font-medium">{rsvp.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{rsvp.email}</TableCell>
                      <TableCell className="text-center">
                        {!rsvp.invitation_sent ? (
                          <Badge variant="outline" className="border-orange-300 text-orange-600">
                            <BookmarkPlus className="h-3 w-3 mr-1" />Vorgemerkt
                          </Badge>
                        ) : getStatusBadge(rsvp.status)}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {rsvp.invited_at
                          ? format(new Date(rsvp.invited_at), 'dd.MM.yy', { locale: de })
                          : '-'}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              {rsvp.reminder_count > 0 ? (
                                <Badge variant="secondary" className="text-xs">
                                  {rsvp.reminder_count}x
                                </Badge>
                              ) : '-'}
                            </TooltipTrigger>
                            {rsvp.reminder_sent_at && (
                              <TooltipContent>
                                Letzte: {format(new Date(rsvp.reminder_sent_at), 'dd.MM.yy HH:mm', { locale: de })}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {rsvp.responded_at
                          ? format(new Date(rsvp.responded_at), 'dd.MM.yy HH:mm', { locale: de })
                          : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {rsvp.invitation_sent && rsvp.status === 'invited' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setReminderTargetIds([rsvp.id]);
                                      setReminderText(DEFAULT_REMINDER_TEXT.replace('{eventTitle}', eventTitle));
                                      setReminderDialogOpen(true);
                                    }}
                                    className="h-7 w-7 p-0"
                                  >
                                    <Bell className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Erinnerung senden</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteRSVP(rsvp.id)}
                            className="h-7 w-7 p-0"
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>

      {/* Reminder Dialog */}
      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Erinnerung senden</DialogTitle>
            <DialogDescription>
              Erinnerung an {reminderTargetIds.length} Gast/Gäste senden.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={reminderText}
              onChange={(e) => setReminderText(e.target.value)}
              rows={6}
              placeholder="Erinnerungstext..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReminderDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={sendReminder} disabled={sendingReminder}>
                <Bell className="h-4 w-4 mr-2" />
                {sendingReminder ? 'Sende...' : 'Erinnerung senden'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Note/Hint Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hinweis an Teilnehmer senden</DialogTitle>
            <DialogDescription>
              Senden Sie eine Nachricht an Gäste.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Empfänger</Label>
              <Select value={noteTarget} onValueChange={(v: any) => setNoteTarget(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accepted">Nur Zugesagte ({accepted})</SelectItem>
                  <SelectItem value="tentative">Nur Vorbehalt ({tentative})</SelectItem>
                  <SelectItem value="all">Zugesagte + Vorbehalt ({accepted + tentative})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={6}
              placeholder="Ihr Hinweis an die Teilnehmer..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={sendNote} disabled={sendingNote || !noteText.trim()}>
                <MessageSquare className="h-4 w-4 mr-2" />
                {sendingNote ? 'Sende...' : 'Hinweis senden'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
