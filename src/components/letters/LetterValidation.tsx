import React from 'react';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  field: string;
  message: string;
}

interface LetterValidationProps {
  letter: {
    title?: string;
    subject?: string;
    recipient_name?: string;
    recipient_address?: string;
    content?: string;
    sender_info_id?: string;
    letter_date?: string;
    status: string;
  };
  onFix?: (field: string) => void;
}

export const LetterValidation: React.FC<LetterValidationProps> = ({
  letter,
  onFix
}) => {
  const validateLetter = (): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];

    // Required fields validation
    if (!letter.title?.trim()) {
      issues.push({
        type: 'error',
        field: 'title',
        message: 'Titel ist erforderlich'
      });
    }

    if (!letter.recipient_name?.trim()) {
      issues.push({
        type: 'error',
        field: 'recipient_name',
        message: 'Empfängername ist erforderlich'
      });
    }

    if (!letter.recipient_address?.trim()) {
      issues.push({
        type: 'error',
        field: 'recipient_address',
        message: 'Empfängeradresse ist erforderlich'
      });
    }

    if (!letter.content?.trim()) {
      issues.push({
        type: 'error',
        field: 'content',
        message: 'Briefinhalt ist erforderlich'
      });
    }

    // DIN 5008 recommendations
    if (!letter.subject?.trim()) {
      issues.push({
        type: 'warning',
        field: 'subject',
        message: 'Betreff wird für DIN 5008 empfohlen'
      });
    }

    if (!letter.letter_date) {
      issues.push({
        type: 'warning',
        field: 'letter_date',
        message: 'Briefdatum wird empfohlen'
      });
    }

    if (!letter.sender_info_id) {
      issues.push({
        type: 'info',
        field: 'sender_info_id',
        message: 'Absenderinformation verbessert die Professionalität'
      });
    }

    // Status-specific validations
    if (letter.status === 'sent') {
      if (!letter.recipient_address?.includes('\n')) {
        issues.push({
          type: 'warning',
          field: 'recipient_address',
          message: 'Mehrzeilige Adresse empfohlen für versendete Briefe'
        });
      }
    }

    // Content length recommendations
    if (letter.content && letter.content.length < 50) {
      issues.push({
        type: 'info',
        field: 'content',
        message: 'Briefinhalt ist sehr kurz'
      });
    }

    if (letter.content && letter.content.length > 5000) {
      issues.push({
        type: 'warning',
        field: 'content',
        message: 'Briefinhalt ist sehr lang - erwägen Sie eine Aufteilung'
      });
    }

    return issues;
  };

  const issues = validateLetter();
  const errorCount = issues.filter(i => i.type === 'error').length;
  const warningCount = issues.filter(i => i.type === 'warning').length;
  const infoCount = issues.filter(i => i.type === 'info').length;

  if (issues.length === 0) {
    return (
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          Brief ist vollständig und bereit zum Versenden.
        </AlertDescription>
      </Alert>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertTriangle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'info': return <Info className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getAlertVariant = (type: string) => {
    switch (type) {
      case 'error': return 'destructive';
      case 'warning': return 'default';
      case 'info': return 'default';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Validierung:</span>
        {errorCount > 0 && (
          <Badge variant="destructive" className="text-xs">
            {errorCount} Fehler
          </Badge>
        )}
        {warningCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {warningCount} Warnungen
          </Badge>
        )}
        {infoCount > 0 && (
          <Badge variant="outline" className="text-xs">
            {infoCount} Hinweise
          </Badge>
        )}
      </div>

      {/* Issues */}
      <div className="space-y-2">
        {issues.map((issue, index) => (
          <Alert key={index} variant={getAlertVariant(issue.type) as any}>
            {getIcon(issue.type)}
            <AlertDescription className="flex items-center justify-between">
              <span>{issue.message}</span>
              {onFix && (
                <button
                  onClick={() => onFix(issue.field)}
                  className="text-xs underline hover:no-underline"
                >
                  Korrigieren
                </button>
              )}
            </AlertDescription>
          </Alert>
        ))}
      </div>
    </div>
  );
};