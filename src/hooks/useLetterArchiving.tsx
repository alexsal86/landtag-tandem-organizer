import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { debugConsole } from '@/utils/debugConsole';
import type { LetterRecord } from '@/components/letter-pdf/types';
import { archiveLetter as archiveLetterViaFunction } from '@/utils/letterArchiving';

export const useLetterArchiving = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isArchiving, setIsArchiving] = useState(false);

  const archiveLetter = async (letter: LetterRecord): Promise<boolean> => {
    if (!user) {
      toast({
        title: 'Fehler',
        description: 'Benutzer nicht gefunden.',
        variant: 'destructive',
      });
      return false;
    }

    setIsArchiving(true);

    try {
      const result = await archiveLetterViaFunction(letter.id, user.id);

      if (!result.success) {
        throw new Error(result.error || 'Der Brief konnte nicht archiviert werden.');
      }

      toast({
        title: 'Brief archiviert',
        description: `Der Brief wurde erfolgreich archiviert und in die Dokumentenverwaltung übernommen.`,
      });

      return true;
    } catch (error: unknown) {
      debugConsole.error('Error archiving letter:', error);
      toast({
        title: 'Archivierungsfehler',
        description: error instanceof Error ? error.message : 'Der Brief konnte nicht archiviert werden.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsArchiving(false);
    }
  };

  return {
    archiveLetter,
    isArchiving,
  };
};
