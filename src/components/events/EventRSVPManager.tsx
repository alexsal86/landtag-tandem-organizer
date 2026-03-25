import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Users, Plus, Mail, Send, Check, X, AlertCircle, Clock, Bell, MessageSquare, BookmarkPlus, ListPlus, ChevronDown, Globe, Link2Off, RefreshCw, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { ContactSelector } from '@/components/ContactSelector';
import { debugConsole } from '@/utils/debugConsole';

interface EventRSVP {
  id: string;
  email: string;
  name: string;
  status: string;
  comment?: string | null;
  responded_at?: string | null;
  invited_at?: string | null;
  token: string | null;
  invitation_sent: boolean;
  reminder_sent_at?: string | null;
  reminder_count: number;
  notes_sent: ReadonlyArray<Record<string, unknown>>;
  custom_message?: string | null;
  created_at?: string | null;
}

interface DistributionList {
  id: string;
  name: string;
}

interface RSVPParticipant {
  name: string;
  email: string | null;
}

interface PublicInvitationLink {
  id: string;
  event_rsvp_id: string;
  public_code: string;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  response_count: number;
  revoked_at: string | null;
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

const PUBLIC_INVITATION_DOMAIN = 'https://www.alexander-salomon.de';
const DEFAULT_PUBLIC_LINK_TTL_DAYS = 45;

function computePublicLinkExpiry(confirmedDate: string | null | undefined): string {
  const now = new Date();
  const defaultExpiry = new Date(now.getTime() + DEFAULT_PUBLIC_LINK_TTL_DAYS * 24 * 60 * 60 * 1000);

  if (!confirmedDate) return defaultExpiry.toISOString();

  const parsedEventDate = new Date(confirmedDate);
  if (Number.isNaN(parsedEventDate.getTime())) return defaultExpiry.toISOString();

  const eventExpiry = new Date(parsedEventDate.getTime() + 14 * 24 * 60 * 60 * 1000);
  return new Date(Math.max(defaultExpiry.getTime(), eventExpiry.getTime())).toISOString();
}

export const EventRSVPManager = ({ eventPlanningId, eventTitle }: EventRSVPManagerProps) => {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [rsvps, setRsvps] = useState<EventRSVP[]>([]);
  const [publicLinksByRsvpId, setPublicLinksByRsvpId] = useState<Record<string, PublicInvitationLink | null>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [pendingInvites, setPendingInvites] = useState<RSVPParticipant[]>([]);
  const [sending, setSending] = useState(false);
  const [actionRsvpId, setActionRsvpId] = useState<string | null>(null);

  // DB-loaded email templates (null = not yet loaded or not found in DB)
  const [invitationTemplate, setInvitationTemplate] = useState<string | null>(null);
  const [reminderTemplate, setReminderTemplate] = useState<string | null>(null);
  const [noteTemplate, setNoteTemplate] = useState<string | null>(null);

  // Email customization
  const [customEmailText, setCustomEmailText] = useState('');
  const [showEmailEditor, setShowEmailEditor] = useState(false);

  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [reminderText, setReminderText] = useState('');
  const [reminderTargetIds, setReminderTargetIds] = useState<string[]>([]);
  const [sendingReminder, setSendingReminder] = useState(false);

  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteTarget, setNoteTarget] = useState<'accepted' | 'tentative' | 'accepted_tentative' | 'declined' | 'invited' | 'everyone'>('accepted');
  const [sendingNote, setSendingNote] = useState(false);

  const [distributionLists, setDistributionLists] = useState<DistributionList[]>([]);
  const [selectedDistList, setSelectedDistList] = useState('');
  const [isRsvpListOpen, setIsRsvpListOpen] = useState(true);
  const [hasUserToggledRsvpList, setHasUserToggledRsvpList] = useState(false);

  useEffect(() => {
    loadRSVPs();
    loadDistributionLists();
    loadEmailTemplates();
    setHasUserToggledRsvpList(false);
  }, [eventPlanningId]);

  useEffect(() => {
    setCustomEmailText((invitationTemplate ?? DEFAULT_INVITATION_TEXT).replace('{eventTitle}', eventTitle));
  }, [invitationTemplate, eventTitle]);

  useEffect(() => {
    if (hasUserToggledRsvpList) return;
    setIsRsvpListOpen(rsvps.length < 10);
  }, [rsvps.length, hasUserToggledRsvpList]);

  const loadEmailTemplates = async () => {
    if (!currentTenant?.id) return;
    try {
      const { data } = await supabase
        .from('event_email_templates')
        .select('type, body')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true);
      for (const row of (data ?? [])) {
        if (row.type === 'invitation' && row.body) setInvitationTemplate(row.body);
        if (row.type === 'reminder' && row.body) setReminderTemplate(row.body);
        if (row.type === 'note' && row.body) setNoteTemplate(row.body);
      }
    } catch (e) {
      debugConsole.error('Error loading event email templates:', e);
    }
  };

  const loadRSVPs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('event_rsvps')
        .select('id, email, name, status, comment, responded_at, invited_at, token, invitation_sent, reminder_sent_at, reminder_count, notes_sent, custom_message, created_at')
        .eq('event_planning_id', eventPlanningId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const nextRsvps = (data || []).map((r) => ({
        ...r,
        invitation_sent: r.invitation_sent ?? false,
        reminder_count: r.reminder_count ?? 0,
        notes_sent: (Array.isArray(r.notes_sent) ? r.notes_sent : []) as ReadonlyArray<Record<string, unknown>>,
      }));

      setRsvps(nextRsvps);
      await loadPublicLinks(nextRsvps.map((r) => r.id));
    } catch (error) {
      debugConsole.error('Error loading RSVPs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPublicLinks = async (rsvpIds: string[]) => {
    if (rsvpIds.length === 0) {
      setPublicLinksByRsvpId({});
      return;
    }

    const { data, error } = await supabase
      .from('event_rsvp_public_links')
      .select('id, event_rsvp_id, public_code, created_at, expires_at, last_used_at, response_count, revoked_at')
      .in('event_rsvp_id', rsvpIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const byRsvpId = rsvpIds.reduce<Record<string, PublicInvitationLink | null>>((acc, rsvpId) => {
      const rsvpLinks = (data || []).filter((link) => link.event_rsvp_id === rsvpId);
      const latestActiveLink = rsvpLinks.find((link) => link.revoked_at == null && (!link.expires_at || new Date(link.expires_at).getTime() > Date.now()));
      const latestLink = latestActiveLink ?? rsvpLinks[0] ?? null;
      acc[rsvpId] = latestLink;
      return acc;
    }, {});

    setPublicLinksByRsvpId(byRsvpId);
  };

  const loadDistributionLists = async () => {
    try {
      const { data } = await supabase.from('distribution_lists').select('id, name').order('name');
      setDistributionLists(data || []);
    } catch (e) {
      debugConsole.error('Error loading distribution lists:', e);
    }
  };

  const addFromContact = (contact: { name: string; email?: string | null }) => {
    if (!contact.email) {
      toast({ title: 'Keine E-Mail', description: 'Kontakt hat keine E-Mail-Adresse.', variant: 'destructive' });
      return;
    }
    const email = contact.email;
    if (pendingInvites.find((p) => p.email === email) || rsvps.find((r) => r.email === email)) {
      toast({ title: 'Bereits vorhanden', variant: 'destructive' });
      return;
    }
    setPendingInvites((prev) => [...prev, { name: contact.name, email }]);
  };

  const addFromDistributionList = async (listId: string) => {
    try {
      const { data: members } = await supabase.from('distribution_list_members').select('contact_id').eq('distribution_list_id', listId);

      if (!members?.length) {
        toast({ title: 'Leere Liste', description: 'Die Verteilerliste hat keine Mitglieder.', variant: 'destructive' });
        return;
      }

      const contactIds = members.map((m) => m.contact_id);
      const { data: contacts } = await supabase.from('contacts').select('id, first_name, last_name, email').in('id', contactIds);

      let added = 0;
      (contacts || []).forEach((c) => {
        if (!c.email) return;
        const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email;
        if (pendingInvites.find((p) => p.email === c.email) || rsvps.find((r) => r.email === c.email)) return;
        setPendingInvites((prev) => [...prev, { name, email: c.email! }]);
        added++;
      });

      toast({ title: `${added} Kontakt(e) hinzugefügt` });
      setSelectedDistList('');
    } catch (e) {
      debugConsole.error('Error loading distribution list members:', e);
    }
  };

  const addExternalEmail = () => {
    if (!newEmail) return;
    if (pendingInvites.find((p) => p.email === newEmail) || rsvps.find((r) => r.email === newEmail)) {
      toast({ title: 'Bereits vorhanden', variant: 'destructive' });
      return;
    }
    setPendingInvites((prev) => [...prev, { name: newEmail.split('@')[0], email: newEmail }]);
    setNewEmail('');
  };

  const removePending = (email: string) => {
    setPendingInvites((prev) => prev.filter((p) => p.email !== email));
  };

  const sendEventEmails = async ({
    rsvpIds,
    type,
    customMessage,
  }: {
    rsvpIds: string[];
    type: 'invitation' | 'reminder';
    customMessage: string;
  }) => {
    const { error } = await supabase.functions.invoke('send-event-invitation', {
      body: {
        eventPlanningId,
        eventTitle,
        rsvpIds,
        type,
        customMessage,
      },
    });

    if (error) {
      throw error;
    }
  };

  const saveDraft = async () => {
    if (pendingInvites.length === 0) return;
    setSending(true);
    try {
      const rsvpData = pendingInvites.map((p) => ({
        event_planning_id: eventPlanningId,
        email: p.email,
        name: p.name,
        tenant_id: currentTenant?.id,
        invitation_sent: false,
      }));

      const { error: insertError } = await supabase.from('event_rsvps').insert(rsvpData);
      if (insertError) throw insertError;

      toast({ title: 'Vorgemerkt', description: `${pendingInvites.length} Gast/Gäste vorgemerkt. Einladungen können später versendet werden.` });
      setPendingInvites([]);
      setDialogOpen(false);
      await loadRSVPs();
    } catch (error) {
      debugConsole.error('Error saving draft:', error);
      toast({ title: 'Fehler', description: 'Vormerken fehlgeschlagen.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const sendInvitations = async (rsvpIdsToSend?: string[]) => {
    setSending(true);
    try {
      let idsToSend = rsvpIdsToSend;

      if (!idsToSend) {
        if (pendingInvites.length === 0) return;

        const rsvpData = pendingInvites.map((p) => ({
          event_planning_id: eventPlanningId,
          email: p.email,
          name: p.name,
          tenant_id: currentTenant?.id,
          invitation_sent: false,
        }));

        const { data: insertedRsvps, error: insertError } = await supabase.from('event_rsvps').insert(rsvpData).select();
        if (insertError) throw insertError;
        idsToSend = (insertedRsvps || []).map((r) => r.id);
      }

      if (idsToSend && idsToSend.length > 0) {
        await sendEventEmails({ rsvpIds: idsToSend, type: 'invitation', customMessage: customEmailText });

        await supabase
          .from('event_rsvps')
          .update({ invitation_sent: true, invited_at: new Date().toISOString() })
          .in('id', idsToSend);
      }

      toast({ title: 'Einladungen versendet', description: `${idsToSend?.length || pendingInvites.length} Einladung(en) wurden versendet.` });
      setPendingInvites([]);
      setDialogOpen(false);
      setShowEmailEditor(false);
      await loadRSVPs();
    } catch (error) {
      debugConsole.error('Error sending invitations:', error);
      toast({ title: 'Fehler', description: 'Einladungen konnten nicht versendet werden.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const sendUnsentInvitations = async () => {
    const unsent = rsvps.filter((r) => !r.invitation_sent);
    if (unsent.length === 0) {
      toast({ title: 'Keine ausstehenden Einladungen' });
      return;
    }
    await sendInvitations(unsent.map((r) => r.id));
  };

  const isLinkCurrentlyActive = (link: PublicInvitationLink | null | undefined) => Boolean(link) && link?.revoked_at == null && (!link?.expires_at || new Date(link.expires_at).getTime() > Date.now());

  const getComputedLinkExpiry = async () => {
    const { data, error } = await supabase
      .from('event_plannings')
      .select('confirmed_date')
      .eq('id', eventPlanningId)
      .maybeSingle();

    if (error) throw error;
    return computePublicLinkExpiry(data?.confirmed_date ?? null);
  };

  const sendReminder = async () => {
    if (reminderTargetIds.length === 0) return;
    setSendingReminder(true);
    try {
      await sendEventEmails({ rsvpIds: reminderTargetIds, type: 'reminder', customMessage: reminderText });

      for (const id of reminderTargetIds) {
        const rsvp = rsvps.find((entry) => entry.id === id);
        await supabase
          .from('event_rsvps')
          .update({ reminder_sent_at: new Date().toISOString(), reminder_count: (rsvp?.reminder_count || 0) + 1 })
          .eq('id', id);
      }

      toast({ title: 'Erinnerung versendet', description: `${reminderTargetIds.length} Erinnerung(en) versendet.` });
      setReminderDialogOpen(false);
      await loadRSVPs();
    } catch (error) {
      debugConsole.error('Error sending reminder:', error);
      toast({ title: 'Fehler', description: 'Erinnerung konnte nicht versendet werden.', variant: 'destructive' });
    } finally {
      setSendingReminder(false);
    }
  };

  const regeneratePublicLink = async (rsvp: EventRSVP) => {
    setActionRsvpId(rsvp.id);
    try {
      const now = new Date().toISOString();
      const { error: revokeError } = await supabase
        .from('event_rsvp_public_links')
        .update({ revoked_at: now })
        .eq('event_rsvp_id', rsvp.id)
        .is('revoked_at', null);

      if (revokeError) throw revokeError;

      const expiresAt = await getComputedLinkExpiry();
      const { error: insertError } = await supabase.from('event_rsvp_public_links').insert({ event_rsvp_id: rsvp.id, expires_at: expiresAt });
      if (insertError) throw insertError;

      toast({
        title: 'Öffentlicher Link neu generiert',
        description: `Der bisherige Link für ${rsvp.name} wurde gesperrt und ein neuer Link unter alexander-salomon.de erzeugt.`,
      });

      await loadRSVPs();
    } catch (error) {
      debugConsole.error('Error regenerating public invitation link:', error);
      toast({ title: 'Fehler', description: 'Öffentlicher Link konnte nicht neu generiert werden.', variant: 'destructive' });
    } finally {
      setActionRsvpId(null);
    }
  };

  const revokePublicLink = async (rsvp: EventRSVP) => {
    setActionRsvpId(rsvp.id);
    try {
      const { error } = await supabase
        .from('event_rsvp_public_links')
        .update({ revoked_at: new Date().toISOString() })
        .eq('event_rsvp_id', rsvp.id)
        .is('revoked_at', null);

      if (error) throw error;

      toast({
        title: 'Öffentlicher Link deaktiviert',
        description: `Der öffentliche Einladungslink für ${rsvp.name} wurde gesperrt. Gäste sehen damit keinen aktiven Plattform-Link mehr.`,
      });

      await loadRSVPs();
    } catch (error) {
      debugConsole.error('Error revoking public invitation link:', error);
      toast({ title: 'Fehler', description: 'Öffentlicher Link konnte nicht deaktiviert werden.', variant: 'destructive' });
    } finally {
      setActionRsvpId(null);
    }
  };

  const resendInvitation = async (rsvp: EventRSVP) => {
    setActionRsvpId(rsvp.id);
    try {
      await sendEventEmails({ rsvpIds: [rsvp.id], type: 'invitation', customMessage: customEmailText });
      await supabase.from('event_rsvps').update({ invitation_sent: true, invited_at: new Date().toISOString() }).eq('id', rsvp.id);

      toast({
        title: 'Einladung erneut versendet',
        description: `Die Einladung an ${rsvp.name} wurde erneut über alexander-salomon.de verschickt.`,
      });

      await loadRSVPs();
    } catch (error) {
      debugConsole.error('Error resending invitation:', error);
      toast({ title: 'Fehler', description: 'Einladung konnte nicht erneut versendet werden.', variant: 'destructive' });
    } finally {
      setActionRsvpId(null);
    }
  };

  const sendNote = async () => {
    if (!noteText.trim()) return;
    setSendingNote(true);
    try {
      const targetStatuses = noteTarget === 'everyone' ? ['accepted', 'tentative'] : [noteTarget];
      const targetRsvps = rsvps.filter((r) => targetStatuses.includes(r.status));
      if (targetRsvps.length === 0) {
        toast({ title: 'Keine Empfänger', description: 'Keine Gäste mit dem gewählten Status.', variant: 'destructive' });
        setSendingNote(false);
        return;
      }

      const targetIds = targetRsvps.map((r) => r.id);
      await supabase.functions.invoke('send-event-invitation', {
        body: { eventPlanningId, eventTitle, rsvpIds: targetIds, type: 'note', customMessage: noteText },
      });

      const noteEntry = { text: noteText, sent_at: new Date().toISOString(), target: noteTarget };
      for (const rsvp of targetRsvps) {
        const existingNotes = Array.isArray(rsvp.notes_sent) ? rsvp.notes_sent : [];
        await supabase.from('event_rsvps').update({ notes_sent: [...existingNotes, noteEntry] }).eq('id', rsvp.id);
      }

      toast({ title: 'Hinweis versendet', description: `${targetRsvps.length} Nachricht(en) versendet.` });
      setNoteDialogOpen(false);
      setNoteText('');
      await loadRSVPs();
    } catch (error) {
      debugConsole.error('Error sending note:', error);
      toast({ title: 'Fehler', description: 'Hinweis konnte nicht versendet werden.', variant: 'destructive' });
    } finally {
      setSendingNote(false);
    }
  };

  const deleteRSVP = async (rsvpId: string) => {
    try {
      const { error } = await supabase.from('event_rsvps').delete().eq('id', rsvpId);
      if (error) throw error;
      setRsvps((prev) => prev.filter((r) => r.id !== rsvpId));
      toast({ title: 'Einladung entfernt' });
    } catch (error) {
      debugConsole.error('Error deleting RSVP:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted': return <Badge className="bg-green-500 text-white"><Check className="h-3 w-3 mr-1" />Zugesagt</Badge>;
      case 'declined': return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Abgesagt</Badge>;
      case 'tentative': return <Badge className="bg-yellow-500 text-white"><AlertCircle className="h-3 w-3 mr-1" />Vorbehalt</Badge>;
      default: return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Ausstehend</Badge>;
    }
  };

  const getPublicLinkLabel = (rsvp: EventRSVP) => {
    const link = publicLinksByRsvpId[rsvp.id];
    if (!rsvp.invitation_sent) return <Badge variant="outline" className="border-orange-300 text-orange-600">Noch nicht versendet</Badge>;
    if (!link) return <Badge variant="outline">Wird beim Versand erzeugt</Badge>;
    if (link.revoked_at) return <Badge variant="outline" className="border-rose-300 text-rose-600">Deaktiviert</Badge>;
    if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) return <Badge variant="outline" className="border-amber-300 text-amber-700">Abgelaufen</Badge>;
    return <Badge className="bg-emerald-600 text-white">Aktiv</Badge>;
  };

  const formatDateTime = (value?: string | null, fallback = '-') => {
    if (!value) return fallback;
    return format(new Date(value), 'dd.MM.yy HH:mm', { locale: de });
  };

  const accepted = rsvps.filter((r) => r.status === 'accepted').length;
  const declined = rsvps.filter((r) => r.status === 'declined').length;
  const tentative = rsvps.filter((r) => r.status === 'tentative').length;
  const pending = rsvps.filter((r) => r.status === 'invited').length;
  const unsent = rsvps.filter((r) => !r.invitation_sent).length;

  const openReminderForPending = () => {
    const pendingRsvps = rsvps.filter(r => r.status === 'invited' && r.invitation_sent);
    setReminderTargetIds(pendingRsvps.map(r => r.id));
    setReminderText((reminderTemplate ?? DEFAULT_REMINDER_TEXT).replace('{eventTitle}', eventTitle));
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
            {rsvps.some((r) => r.status === 'invited' && r.invitation_sent) && (
              <Button size="sm" variant="outline" onClick={openReminderForPending}>
                <Bell className="h-4 w-4 mr-2" />
                Erinnerung
              </Button>
            )}
            {rsvps.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => {
                if (noteTemplate && !noteText) setNoteText(noteTemplate);
                setNoteDialogOpen(true);
              }}>
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
                  <Alert>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>Neuer öffentlicher Ablauf</AlertTitle>
                    <AlertDescription>
                      Neue Einladungen und Erinnerungen verwenden ausschließlich öffentliche Links unter <strong>alexander-salomon.de</strong>. Gäste sollen keine Plattform-Domain mehr sehen.
                    </AlertDescription>
                  </Alert>

                  <div>
                    <Label className="text-sm">Aus Kontakten</Label>
                    <ContactSelector onSelect={addFromContact} placeholder="Kontakt auswählen..." clearAfterSelect={true} />
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
                            {distributionLists.map((dl) => (
                              <SelectItem key={dl.id} value={dl.id}>{dl.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" disabled={!selectedDistList} onClick={() => selectedDistList && addFromDistributionList(selectedDistList)}>
                          <ListPlus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-sm">E-Mail-Adresse</Label>
                    <div className="flex gap-2">
                      <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="gast@email.de" onKeyPress={(e) => e.key === 'Enter' && addExternalEmail()} />
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
                            <button onClick={() => p.email && removePending(p.email)} className="ml-1 hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {pendingInvites.length > 0 && (
                    <div className="space-y-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowEmailEditor(!showEmailEditor)} className="text-xs">
                        <Mail className="h-3 w-3 mr-1" />
                        {showEmailEditor ? 'E-Mail-Text ausblenden' : 'E-Mail-Text anpassen'}
                      </Button>
                      {showEmailEditor && (
                        <Textarea value={customEmailText} onChange={(e) => setCustomEmailText(e.target.value)} rows={6} className="text-sm" placeholder="Einladungstext..." />
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
                    <Button variant="secondary" onClick={saveDraft} disabled={sending || pendingInvites.length === 0}>
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
        <div className="mb-4 space-y-3">
          <Alert className="border-blue-200 bg-blue-50/60">
            <Globe className="h-4 w-4" />
            <AlertTitle>Öffentliche Einladungslinks über alexander-salomon.de</AlertTitle>
            <AlertDescription>
              Im Planungsbereich wird pro RSVP nachvollziehbar verwaltet, ob die Einladung versendet wurde, ob ein öffentlicher Link aktiv ist und wann er zuletzt genutzt wurde. Gäste erhalten nur noch öffentliche Links unter <strong>alexander-salomon.de</strong>.
            </AlertDescription>
          </Alert>
          <div className="flex gap-3 text-sm flex-wrap text-muted-foreground">
            <span>{rsvps.filter(r => isLinkCurrentlyActive(publicLinksByRsvpId[r.id])).length} aktive öffentliche Links</span>
            <span>{rsvps.filter(r => !isLinkCurrentlyActive(publicLinksByRsvpId[r.id])).length} ohne aktiven Link</span>
            <span>Erstversand und Reminder nutzen denselben öffentlichen Link-Workflow</span>
          </div>
        </div>

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
            <Collapsible open={isRsvpListOpen} onOpenChange={(open) => { setIsRsvpListOpen(open); setHasUserToggledRsvpList(true); }}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="mb-4 flex w-full items-center justify-between px-3">
                  <span className="text-sm font-medium">Liste mit Einladungen & RSVP {isRsvpListOpen ? 'ausblenden' : 'einblenden'}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isRsvpListOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>E-Mail</TableHead>
                        <TableHead className="text-center">Einladung versendet</TableHead>
                        <TableHead className="text-center">Öffentlicher Link</TableHead>
                        <TableHead className="text-center">Letzter Zugriff</TableHead>
                        <TableHead className="text-center">Antwortstatus</TableHead>
                        <TableHead className="text-center">Erinnerungen</TableHead>
                        <TableHead className="text-center">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rsvps.map((rsvp) => {
                        const publicLink = publicLinksByRsvpId[rsvp.id];
                        const actionPending = actionRsvpId === rsvp.id;
                        const activePublicUrl = isLinkCurrentlyActive(publicLink) ? `${PUBLIC_INVITATION_DOMAIN}/einladung/${publicLink?.public_code ?? ''}` : null;

                        return (
                          <TableRow key={rsvp.id}>
                            <TableCell className="font-medium">{rsvp.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{rsvp.email}</TableCell>
                            <TableCell className="text-center text-sm">
                              <div className="space-y-1">
                                {rsvp.invitation_sent ? <Badge className="bg-blue-600 text-white">Versendet</Badge> : <Badge variant="outline" className="border-orange-300 text-orange-600">Vorgemerkt</Badge>}
                                <div className="text-xs text-muted-foreground">{formatDateTime(rsvp.invited_at, '-')}</div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm">
                              <div className="space-y-1">
                                {getPublicLinkLabel(rsvp)}
                                <div className="text-xs text-muted-foreground">
                                  {activePublicUrl ? `alexander-salomon.de/einladung/… · ${publicLink?.response_count ?? 0} Antwort(en)` : 'Kein aktiver öffentlicher Link'}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm">{formatDateTime(publicLink?.last_used_at, 'Optional / noch kein Zugriff')}</TableCell>
                            <TableCell className="text-center">
                              <div className="space-y-1">
                                {getStatusBadge(rsvp.status)}
                                <div className="text-xs text-muted-foreground">{formatDateTime(rsvp.responded_at, 'Noch keine Antwort')}</div>
                                {rsvp.comment && (
                                  <div className="text-xs text-muted-foreground italic mt-1">„{rsvp.comment}"</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    {rsvp.reminder_count > 0 ? <Badge variant="secondary" className="text-xs">{rsvp.reminder_count}x</Badge> : '-'}
                                  </TooltipTrigger>
                                  {rsvp.reminder_sent_at && <TooltipContent>Letzte: {format(new Date(rsvp.reminder_sent_at), 'dd.MM.yy HH:mm', { locale: de })}</TooltipContent>}
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-wrap items-center justify-center gap-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button size="sm" variant="ghost" onClick={() => regeneratePublicLink(rsvp)} disabled={actionPending} className="h-7 w-7 p-0">
                                        <RefreshCw className={`h-4 w-4 text-muted-foreground ${actionPending ? 'animate-spin' : ''}`} />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Link neu generieren und alten Link sperren</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button size="sm" variant="ghost" onClick={() => revokePublicLink(rsvp)} disabled={actionPending || !isLinkCurrentlyActive(publicLink)} className="h-7 w-7 p-0">
                                        <Link2Off className="h-4 w-4 text-muted-foreground" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Öffentlichen Link deaktivieren</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setReminderTargetIds([rsvp.id]);
                                          setReminderText((reminderTemplate ?? DEFAULT_REMINDER_TEXT).replace('{eventTitle}', eventTitle));
                                          setReminderDialogOpen(true);
                                        }}
                                        className="h-7 w-7 p-0"
                                      >
                                        <Bell className="h-4 w-4 text-muted-foreground" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Einladung erneut senden</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                {rsvp.invitation_sent && rsvp.status === 'invited' && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="sm" variant="ghost" onClick={() => { setReminderTargetIds([rsvp.id]); setReminderText(DEFAULT_REMINDER_TEXT.replace('{eventTitle}', eventTitle)); setReminderDialogOpen(true); }} className="h-7 w-7 p-0">
                                          <Bell className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Erinnerung senden</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                <Button size="sm" variant="ghost" onClick={() => deleteRSVP(rsvp.id)} className="h-7 w-7 p-0">
                                  <X className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </CardContent>

      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Erinnerung senden</DialogTitle>
            <DialogDescription>Erinnerung an {reminderTargetIds.length} Gast/Gäste senden. Der Versand nutzt denselben öffentlichen Link-Ablauf über alexander-salomon.de wie der Erstversand.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea value={reminderText} onChange={(e) => setReminderText(e.target.value)} rows={6} placeholder="Erinnerungstext..." />
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

      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hinweis an Teilnehmer senden</DialogTitle>
            <DialogDescription>Senden Sie eine Nachricht an Gäste.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Empfänger</Label>
              <Select
                value={noteTarget}
                onValueChange={(v: 'accepted' | 'tentative' | 'accepted_tentative' | 'declined' | 'invited' | 'everyone') => setNoteTarget(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accepted">Nur Zugesagte ({accepted})</SelectItem>
                  <SelectItem value="tentative">Nur Vorbehalt ({tentative})</SelectItem>
                  <SelectItem value="accepted_tentative">Zugesagte + Vorbehalt ({accepted + tentative})</SelectItem>
                  <SelectItem value="declined">Nur Abgesagte ({declined})</SelectItem>
                  <SelectItem value="invited">Nur Ausstehende ({pending})</SelectItem>
                  <SelectItem value="everyone">Alle ({rsvps.length})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={6} placeholder="Ihr Hinweis an die Teilnehmer..." />
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
