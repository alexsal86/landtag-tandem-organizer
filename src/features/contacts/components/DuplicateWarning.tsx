import React from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Users, Mail, Phone, Building } from "lucide-react";
import { DuplicateMatch, getDuplicateMessage } from "@/lib/utils";

interface DuplicateWarningProps {
  duplicates: DuplicateMatch[];
  onContinueAnyway?: () => void;
  onCancel?: () => void;
  showActions?: boolean;
}

export function DuplicateWarning({ 
  duplicates, 
  onContinueAnyway, 
  onCancel, 
  showActions = true 
}: DuplicateWarningProps) {
  if (duplicates.length === 0) {
    return null;
  }

  const getConfidenceBadgeColor = (confidence: 'high' | 'medium') => {
    return confidence === 'high' 
      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
  };

  const getMatchIcon = (matchType: 'email' | 'name_phone' | 'name_organization') => {
    switch (matchType) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'name_phone':
        return <Phone className="h-4 w-4" />;
      case 'name_organization':
        return <Building className="h-4 w-4" />;
    }
  };

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        <Users className="h-4 w-4" />
        Mögliche Duplikate gefunden
      </AlertTitle>
      <AlertDescription>
        <div className="mt-2 space-y-3">
          <p className="text-sm">
            Es wurden {duplicates.length} mögliche{' '}
            {duplicates.length === 1 ? 'Duplikat' : 'Duplikate'} gefunden:
          </p>
          
          <div className="space-y-2">
            {duplicates.map((duplicate, index) => (
              <div
                key={`${duplicate.contact.id || index}`}
                className="p-3 bg-white/10 rounded-md border border-white/20"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getMatchIcon(duplicate.matchType)}
                    <span className="font-medium">{duplicate.contact.name}</span>
                  </div>
                  <Badge className={getConfidenceBadgeColor(duplicate.confidence)}>
                    {duplicate.confidence === 'high' ? 'Hoch' : 'Mittel'}
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  {getDuplicateMessage(duplicate)}
                </p>
                
                {duplicate.contact.organization && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Organisation: {duplicate.contact.organization}
                  </p>
                )}
              </div>
            ))}
          </div>

          {showActions && (
            <div className="flex gap-2 mt-4">
              {onContinueAnyway && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onContinueAnyway}
                  className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  Trotzdem speichern
                </Button>
              )}
              {onCancel && (
                <Button variant="outline" size="sm" onClick={onCancel}>
                  Abbrechen
                </Button>
              )}
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}