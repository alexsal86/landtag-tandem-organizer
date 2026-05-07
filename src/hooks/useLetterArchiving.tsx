import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { debugConsole } from '@/utils/debugConsole';
import type { LetterRecord } from '@/components/letter-pdf/types';
import { archiveLetter as archiveLetterViaFunction } from '@/utils/letterArchiving';
import { notify } from "@/lib/notify";

export const useLetterArchiving = () => {
  const { user } = useAuth();
  const [isArchiving, setIsArchiving] = useState(false);

  const archiveLetter = async (letter: LetterRecord): Promise<boolean> => {
    if (!user) {
      notify.error('Fehler', {
        description: 'Benutzer nicht gefunden.'
});
      return false;
    }

    setIsArchiving(true);

    try {
      const result = await archiveLetterViaFunction(letter.id, user.id);

      if (!result.success) {
        throw new Error(result.error || 'Der Brief konnte nicht archiviert werden.');
      }

      notify.success('Brief archiviert', {
        description: `Der Brief wurde erfolgreich archiviert und in die Dokumentenverwaltung übernommen.`
});

      return true;
    } catch (error: unknown) {
      debugConsole.error('Error archiving letter:', error);
      notify.error('Archivierungsfehler', {
        description: error instanceof Error ? error.message : 'Der Brief konnte nicht archiviert werden.'
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
