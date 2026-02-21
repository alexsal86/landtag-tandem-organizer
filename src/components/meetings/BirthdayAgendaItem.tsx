import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Cake, Mail, Phone, Gift, CreditCard, Trash, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { format, addDays, differenceInYears, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { MultiUserAssignSelect } from './MultiUserAssignSelect';

interface BirthdayContact {
  id: string;
  name: string;
  birthday: string;
  avatar_url?: string | null;
  age: number;
  nextBirthday: Date;
}

interface BirthdayAction {
  action: 'card' | 'mail' | 'call' | 'gift';
  note?: string;
  assigned_to?: string[];
}

interface ProfileInfo {
  user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
}

interface BirthdayAgendaItemProps {
  meetingDate?: string | Date;
  meetingId?: string;
  resultText?: string | null;
  onUpdateResult?: (result: string) => void;
  onDelete?: () => void;
  className?: string;
  isEmbedded?: boolean;
  profiles?: ProfileInfo[];
}

const ACTION_OPTIONS = [
  { key: 'card' as const, label: 'Karte', icon: CreditCard, color: 'text-purple-600' },
  { key: 'mail' as const, label: 'Mail', icon: Mail, color: 'text-blue-600' },
  { key: 'call' as const, label: 'Anruf', icon: Phone, color: 'text-green-600' },
  { key: 'gift' as const, label: 'Geschenk', icon: Gift, color: 'text-amber-600' },
];

export function BirthdayAgendaItem({
  meetingDate,
  meetingId,
  resultText,
  onUpdateResult,
  onDelete,
  className,
  isEmbedded = false,
  profiles = [],
}: BirthdayAgendaItemProps) {
  const { currentTenant } = useTenant();
  const [contacts, setContacts] = useState<BirthdayContact[]>([]);
  const [actions, setActions] = useState<Record<string, BirthdayAction>>({});
  const [loading, setLoading] = useState(true);

  // Parse existing actions from result_text
  useEffect(() => {
    if (resultText) {
      try {
        const parsed = JSON.parse(resultText);
        setActions(parsed);
      } catch {
        setActions({});
      }
    }
  }, [resultText]);

  // Load contacts with birthdays in the next 14 days
  useEffect(() => {
    const loadBirthdays = async () => {
      if (!currentTenant?.id) return;
      setLoading(true);

      try {
        const refDate = meetingDate ? new Date(meetingDate) : new Date();
        const endDate = addDays(refDate, 14);

        const { data: allContacts } = await supabase
          .from('contacts')
          .select('id, name, birthday, avatar_url')
          .eq('tenant_id', currentTenant.id)
          .not('birthday', 'is', null);

        if (!allContacts) {
          setContacts([]);
          setLoading(false);
          return;
        }

        const birthdayContacts: BirthdayContact[] = [];
        const refYear = refDate.getFullYear();

        for (const contact of allContacts) {
          if (!contact.birthday) continue;
          const bday = parseISO(contact.birthday);
          if (Number.isNaN(bday.getTime())) continue;
          const month = bday.getMonth();
          const day = bday.getDate();

          for (const year of [refYear, refYear + 1]) {
            const nextBday = new Date(year, month, day);
            if (nextBday >= refDate && nextBday <= endDate) {
              const age = differenceInYears(nextBday, bday);
              birthdayContacts.push({
                id: contact.id,
                name: contact.name,
                birthday: contact.birthday,
                avatar_url: contact.avatar_url,
                age,
                nextBirthday: nextBday,
              });
              break;
            }
          }
        }

        birthdayContacts.sort((a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime());
        setContacts(birthdayContacts);
      } catch (error) {
        console.error('Error loading birthday contacts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBirthdays();
  }, [currentTenant?.id, meetingDate]);

  const toggleAction = (contactId: string, actionKey: BirthdayAction['action']) => {
    const newActions = { ...actions };
    if (newActions[contactId]?.action === actionKey) {
      delete newActions[contactId];
    } else {
      newActions[contactId] = { 
        action: actionKey,
        assigned_to: newActions[contactId]?.assigned_to,
      };
    }
    setActions(newActions);
    onUpdateResult?.(JSON.stringify(newActions));
  };

  const updateAssignment = (contactId: string, userIds: string[]) => {
    const newActions = { ...actions };
    if (!newActions[contactId]) return;
    newActions[contactId] = {
      ...newActions[contactId],
      assigned_to: userIds.length > 0 ? userIds : undefined,
    };
    setActions(newActions);
    onUpdateResult?.(JSON.stringify(newActions));
  };

  return (
    <Card className={cn("border-l-4 border-l-pink-500", className)}>
      <CardHeader className="py-2 px-3 pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Cake className="h-4 w-4 text-pink-500" />
            Geburtstage
            {contacts.length > 0 && <Badge variant="secondary">{contacts.length}</Badge>}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-xs bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300 dark:border-pink-800">
              <Cake className="h-3 w-3 mr-1" />
              System
            </Badge>
            {onDelete && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={onDelete}
                aria-label="Punkt löschen"
              >
                <Trash className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-2 pt-0">
        {loading ? (
          <p className="text-sm text-muted-foreground">Lade Geburtstage...</p>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Geburtstage in den nächsten 14 Tagen.
          </p>
        ) : (
          <div className="space-y-2">
            {contacts.map((contact) => {
              const contactAction = actions[contact.id];
              const selectedAction = contactAction?.action;
              return (
                <div key={contact.id} className="p-3 bg-muted/50 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-sm">{contact.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {format(contact.nextBirthday, 'dd. MMMM', { locale: de })} — wird {contact.age} Jahre
                      </p>
                    </div>
                    <Cake className="h-4 w-4 text-pink-400" />
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {ACTION_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = selectedAction === opt.key;
                      return (
                        <Button
                          key={opt.key}
                          size="sm"
                          variant={isSelected ? 'default' : 'outline'}
                          className={cn("h-7 text-xs gap-1", isSelected && 'bg-pink-600 hover:bg-pink-700 text-white')}
                          onClick={() => toggleAction(contact.id, opt.key)}
                        >
                          <Icon className="h-3 w-3" />
                          {opt.label}
                        </Button>
                      );
                    })}
                  </div>
                  {/* Assignment selector - only shown when an action is selected */}
                  {selectedAction && profiles.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground shrink-0">Zuständig:</span>
                      <MultiUserAssignSelect
                        assignedTo={contactAction?.assigned_to || null}
                        profiles={profiles}
                        onChange={(userIds) => updateAssignment(contact.id, userIds)}
                        size="sm"
                      />
                      {!contactAction?.assigned_to?.length && (
                        <span className="text-xs text-muted-foreground italic">Alle Mitarbeiter</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { type BirthdayContact, type BirthdayAction };
