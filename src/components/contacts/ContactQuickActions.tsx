import React from 'react';
import { Button } from '@/components/ui/button';
import { Mail, Phone, Calendar, Users } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface ContactQuickActionsProps {
  contact: Contact;
  onAddToDistribution?: (contactId: string) => void;
  onCreateAppointment?: (contactId: string) => void;
}

export function ContactQuickActions({
  contact,
  onAddToDistribution,
  onCreateAppointment,
}: ContactQuickActionsProps) {
  const handleEmail = () => {
    if (contact.email) {
      window.location.href = `mailto:${contact.email}`;
    }
  };

  const handleCall = () => {
    if (contact.phone) {
      window.location.href = `tel:${contact.phone}`;
    }
  };

  return (
    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1 bg-background/95 backdrop-blur-sm p-1 rounded-md shadow-lg">
      <TooltipProvider delayDuration={300}>
        {contact.email && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEmail();
                }}
                className="h-8 w-8 p-0"
              >
                <Mail className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>E-Mail senden</p>
            </TooltipContent>
          </Tooltip>
        )}

        {contact.phone && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCall();
                }}
                className="h-8 w-8 p-0"
              >
                <Phone className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Anrufen</p>
            </TooltipContent>
          </Tooltip>
        )}

        {onCreateAppointment && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateAppointment(contact.id);
                }}
                className="h-8 w-8 p-0"
              >
                <Calendar className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Termin erstellen</p>
            </TooltipContent>
          </Tooltip>
        )}

        {onAddToDistribution && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToDistribution(contact.id);
                }}
                className="h-8 w-8 p-0"
              >
                <Users className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zu Verteiler hinzufügen</p>
            </TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  );
}
