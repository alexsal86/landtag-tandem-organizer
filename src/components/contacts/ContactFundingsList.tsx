import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useContactFundings } from "@/hooks/useContactFundings";
import { Euro, ChevronDown, ChevronRight, Users } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface ContactFundingsListProps {
  contactId: string;
  isExpanded: boolean;
  onToggle: () => void;
}

export function ContactFundingsList({ contactId, isExpanded, onToggle }: ContactFundingsListProps) {
  const { data: fundings = [], isLoading } = useContactFundings(contactId);

  const totalAmount = fundings.reduce((sum, f) => sum + (f.allocated_amount || 0), 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'completed':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'cancelled':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      default:
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Aktiv';
      case 'completed': return 'Abgeschlossen';
      case 'cancelled': return 'Abgebrochen';
      default: return 'Geplant';
    }
  };

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Euro className="h-4 w-4 mr-1" />
        Laden...
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className="w-full justify-start"
      >
        <Euro className="h-4 w-4 mr-2" />
        <span className="font-medium">{fundings.length}</span>
        <span className="ml-1 text-muted-foreground">
          {totalAmount > 0 && ` · ${totalAmount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`}
        </span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 ml-auto" />
        ) : (
          <ChevronRight className="h-4 w-4 ml-auto" />
        )}
      </Button>

      {isExpanded && fundings.length > 0 && (
        <div className="space-y-2 pl-4">
          {fundings.map((funding) => (
            <div key={funding.id} className="p-3 border rounded-lg space-y-2 bg-card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{funding.title}</h4>
                  {funding.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {funding.description}
                    </p>
                  )}
                </div>
                <Badge variant="secondary" className={getStatusColor(funding.status)}>
                  {getStatusLabel(funding.status)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {funding.allocated_amount && (
                  <div>
                    <span className="text-muted-foreground">Anteil: </span>
                    <span className="font-medium">
                      {funding.allocated_amount.toLocaleString('de-DE', { 
                        style: 'currency', 
                        currency: 'EUR' 
                      })}
                    </span>
                  </div>
                )}
                {funding.total_amount && (
                  <div>
                    <span className="text-muted-foreground">Gesamt: </span>
                    <span className="font-medium">
                      {funding.total_amount.toLocaleString('de-DE', { 
                        style: 'currency', 
                        currency: 'EUR' 
                      })}
                    </span>
                  </div>
                )}
                {funding.start_date && (
                  <div>
                    <span className="text-muted-foreground">Von: </span>
                    <span>
                      {format(new Date(funding.start_date), 'dd.MM.yyyy', { locale: de })}
                    </span>
                  </div>
                )}
                {funding.end_date && (
                  <div>
                    <span className="text-muted-foreground">Bis: </span>
                    <span>
                      {format(new Date(funding.end_date), 'dd.MM.yyyy', { locale: de })}
                    </span>
                  </div>
                )}
              </div>

              {(funding.funding_source || funding.category || funding.participant_role) && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {funding.funding_source && (
                    <Badge variant="outline" className="text-xs">
                      {funding.funding_source}
                    </Badge>
                  )}
                  {funding.category && (
                    <Badge variant="outline" className="text-xs">
                      {funding.category}
                    </Badge>
                  )}
                  {funding.participant_role && (
                    <Badge variant="outline" className="text-xs">
                      {funding.participant_role}
                    </Badge>
                  )}
                  {funding.participant_count > 1 && (
                    <Badge variant="outline" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {funding.participant_count}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
