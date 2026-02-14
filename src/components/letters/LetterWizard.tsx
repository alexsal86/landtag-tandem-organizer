import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, Building2, PartyPopper, Heart, FileQuestion, 
  MessageSquare, FileText, Mail, Gavel, ArrowLeft, ArrowRight, Check,
  Search, User, X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

interface LetterWizardProps {
  onComplete: (config: {
    occasion: string;
    recipientName: string;
    recipientAddress: string;
    contactId?: string;
    templateId?: string;
    senderInfoId?: string;
  }) => void;
  onCancel: () => void;
}

interface Contact {
  id: string;
  name: string;
  address?: string | null;
  email?: string | null;
  company?: string | null;
}

interface LetterTemplate {
  id: string;
  name: string;
  description?: string;
  default_sender_id?: string;
}

interface SenderInfo {
  id: string;
  name: string;
  is_default?: boolean;
}

const FALLBACK_OCCASIONS = [
  { key: 'buergeranliegen', label: 'Bürgeranliegen', description: 'Antwort auf Anfragen von Bürgern', icon: Users, color: 'bg-blue-500' },
  { key: 'ministerium', label: 'Ministerium', description: 'Formelle Korrespondenz mit Ministerien', icon: Building2, color: 'bg-purple-500' },
  { key: 'einladung', label: 'Einladung', description: 'Veranstaltungseinladungen', icon: PartyPopper, color: 'bg-amber-500' },
  { key: 'gruss', label: 'Gruß & Dank', description: 'Glückwünsche, Beileid, Dankschreiben', icon: Heart, color: 'bg-rose-500' },
  { key: 'parlamentarische_anfrage', label: 'Parlamentarische Anfrage', description: 'Anfragen an die Regierung', icon: FileQuestion, color: 'bg-teal-500' },
  { key: 'stellungnahme', label: 'Stellungnahme', description: 'Offizielle Positionierung', icon: MessageSquare, color: 'bg-indigo-500' },
  { key: 'sonstiges', label: 'Sonstiges', description: 'Freie Briefform', icon: FileText, color: 'bg-muted-foreground' },
];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Users, Building2, PartyPopper, Heart, FileQuestion, MessageSquare, FileText, Mail, Gavel,
};

export const LetterWizard: React.FC<LetterWizardProps> = ({ onComplete, onCancel }) => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [step, setStep] = useState(1);
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [occasions, setOccasions] = useState<Array<{ key: string; label: string; description: string; icon: React.ComponentType<{ className?: string }>; color: string; default_template_id?: string | null; template_match_patterns?: string[] }>>([]);
  
  // Step 2: Recipient
  const [recipientMode, setRecipientMode] = useState<'contact' | 'manual'>('contact');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  
  // Step 3: Template & Sender
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [senders, setSenders] = useState<SenderInfo[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');

  useEffect(() => {
    if (currentTenant) {
      loadContacts();
      loadTemplates();
      loadSenders();
      loadOccasions();
    }
  }, [currentTenant]);

  const loadOccasions = async () => {
    if (!currentTenant) return;
    const { data } = await supabase
      .from('letter_occasions')
      .select('*')
      .eq('tenant_id', currentTenant.id)
      .eq('is_active', true)
      .order('sort_order');
    if (data && data.length > 0) {
      setOccasions(data.map((o: any) => ({
        key: o.key,
        label: o.label,
        description: o.description || '',
        icon: ICON_MAP[o.icon] || FileText,
        color: o.color || 'bg-muted-foreground',
        default_template_id: o.default_template_id,
        template_match_patterns: o.template_match_patterns || [],
      })));
    } else {
      setOccasions(FALLBACK_OCCASIONS);
    }
  };

  // Auto-suggest template when occasion changes
  useEffect(() => {
    if (selectedOccasion && templates.length > 0 && occasions.length > 0) {
      const occ = occasions.find(o => o.key === selectedOccasion);
      // If occasion has a direct template link, use it
      if (occ?.default_template_id) {
        const match = templates.find(t => t.id === occ.default_template_id);
        if (match) {
          setSelectedTemplateId(match.id);
          if (match.default_sender_id) setSelectedSenderId(match.default_sender_id);
          return;
        }
      }
      // Fallback to pattern matching
      const patterns = occ?.template_match_patterns || [];
      if (patterns.length > 0) {
        const match = templates.find(t => 
          patterns.some(p => t.name.toLowerCase().includes(p))
        );
        if (match) {
          setSelectedTemplateId(match.id);
          if (match.default_sender_id) setSelectedSenderId(match.default_sender_id);
          return;
        }
      }
      // Fallback: select first template
      if (!selectedTemplateId) {
        setSelectedTemplateId(templates[0]?.id || '');
      }
    }
  }, [selectedOccasion, templates, occasions]);

  // Auto-select default sender
  useEffect(() => {
    if (senders.length > 0 && !selectedSenderId) {
      const defaultSender = senders.find(s => s.is_default);
      setSelectedSenderId(defaultSender?.id || senders[0]?.id || '');
    }
  }, [senders]);

  const loadContacts = async () => {
    if (!currentTenant) return;
    const { data } = await supabase
      .from('contacts')
      .select('id, name, address, email, company')
      .eq('tenant_id', currentTenant.id)
      .order('name')
      .limit(200);
    setContacts(data || []);
  };

  const loadTemplates = async () => {
    if (!currentTenant) return;
    const { data } = await supabase
      .from('letter_templates')
      .select('id, name, default_sender_id')
      .eq('tenant_id', currentTenant.id)
      .eq('is_active', true)
      .order('name');
    setTemplates((data || []) as LetterTemplate[]);
  };

  const loadSenders = async () => {
    if (!currentTenant) return;
    const { data } = await supabase
      .from('sender_information')
      .select('id, name, is_default')
      .eq('tenant_id', currentTenant.id)
      .eq('is_active', true)
      .order('name');
    setSenders(data || []);
  };

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.company?.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const canProceedStep1 = !!selectedOccasion;
  const canProceedStep2 = recipientMode === 'contact' 
    ? !!selectedContact 
    : (manualName.trim().length > 0);
  const canComplete = canProceedStep2;

  const handleComplete = () => {
    const recipientName = recipientMode === 'contact' 
      ? selectedContact?.name || '' 
      : manualName;
    const recipientAddress = recipientMode === 'contact'
      ? selectedContact?.address || ''
      : manualAddress;

    onComplete({
      occasion: selectedOccasion || 'sonstiges',
      recipientName,
      recipientAddress,
      contactId: recipientMode === 'contact' ? selectedContact?.id : undefined,
      templateId: selectedTemplateId || undefined,
      senderInfoId: selectedSenderId || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-background border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold">Brief-Assistent</h2>
            <p className="text-sm text-muted-foreground">
              Schritt {step} von 3
            </p>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map(s => (
              <div 
                key={s} 
                className={`h-2 w-8 rounded-full transition-colors ${
                  s <= step ? 'bg-primary' : 'bg-muted'
                }`} 
              />
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[400px]">
          {/* Step 1: Occasion */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Welchen Anlass hat Ihr Brief?</h3>
              <div className="grid grid-cols-2 gap-3">
                {occasions.map(occ => {
                  const Icon = occ.icon;
                  const isSelected = selectedOccasion === occ.key;
                  return (
                    <button
                      key={occ.key}
                      onClick={() => setSelectedOccasion(occ.key)}
                      className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all ${
                        isSelected 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <div className={`${occ.color} text-white p-2 rounded-lg shrink-0`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{occ.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{occ.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Recipient */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">An wen richtet sich der Brief?</h3>
              
              <div className="flex gap-2">
                <Button 
                  variant={recipientMode === 'contact' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setRecipientMode('contact')}
                >
                  <User className="h-4 w-4 mr-1" />
                  Kontakt wählen
                </Button>
                <Button 
                  variant={recipientMode === 'manual' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setRecipientMode('manual')}
                >
                  Manuell eingeben
                </Button>
              </div>

              {recipientMode === 'contact' ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Kontakt suchen..."
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  
                  {selectedContact && (
                    <div className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-lg">
                      <User className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{selectedContact.name}</span>
                      {selectedContact.company && (
                        <span className="text-xs text-muted-foreground">({selectedContact.company})</span>
                      )}
                      <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0" onClick={() => setSelectedContact(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  <ScrollArea className="h-[240px] border rounded-lg">
                    <div className="p-2 space-y-1">
                      {filteredContacts.map(contact => (
                        <button
                          key={contact.id}
                          onClick={() => setSelectedContact(contact)}
                          className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
                            selectedContact?.id === contact.id 
                              ? 'bg-primary/10 text-primary' 
                              : 'hover:bg-muted'
                          }`}
                        >
                          <p className="font-medium">{contact.name}</p>
                          {(contact.company || contact.address) && (
                            <p className="text-xs text-muted-foreground truncate">
                              {contact.company}{contact.company && contact.address ? ' · ' : ''}{contact.address}
                            </p>
                          )}
                        </button>
                      ))}
                      {filteredContacts.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">Keine Kontakte gefunden</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label>Name des Empfängers *</Label>
                    <Input
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="z.B. Max Mustermann"
                    />
                  </div>
                  <div>
                    <Label>Adresse (optional)</Label>
                    <Input
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      placeholder="Straße, PLZ Ort"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Template & Sender */}
          {step === 3 && (
            <div className="space-y-5">
              <h3 className="font-semibold text-lg">Vorlage und Absender</h3>
              
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p className="text-muted-foreground">
                  Basierend auf dem Anlass <Badge variant="outline" className="mx-1">{occasions.find(o => o.key === selectedOccasion)?.label}</Badge> 
                  wurde automatisch eine passende Vorlage vorgeschlagen.
                </p>
              </div>

              {templates.length > 0 ? (
                <div>
                  <Label>Briefvorlage</Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vorlage wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Keine Briefvorlagen verfügbar. Der Brief wird ohne Vorlage erstellt.</p>
              )}

              {senders.length > 0 && (
                <div>
                  <Label>Absender</Label>
                  <Select value={selectedSenderId} onValueChange={setSelectedSenderId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Absender wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {senders.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} {s.is_default && '(Standard)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Summary */}
              <Card>
                <CardContent className="p-4 space-y-2 text-sm">
                  <h4 className="font-medium">Zusammenfassung</h4>
                  <div className="grid grid-cols-2 gap-y-1">
                    <span className="text-muted-foreground">Anlass:</span>
                    <span>{occasions.find(o => o.key === selectedOccasion)?.label}</span>
                    <span className="text-muted-foreground">Empfänger:</span>
                    <span>{recipientMode === 'contact' ? selectedContact?.name : manualName}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t">
          <Button variant="outline" onClick={step === 1 ? onCancel : () => setStep(s => s - 1)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {step === 1 ? 'Abbrechen' : 'Zurück'}
          </Button>
          
          {step < 3 ? (
            <Button 
              onClick={() => setStep(s => s + 1)} 
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
            >
              Weiter
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleComplete} disabled={!canComplete}>
              <Check className="h-4 w-4 mr-1" />
              Brief erstellen
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
