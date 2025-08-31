import React from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const TestArchiveButton: React.FC = () => {
  const { toast } = useToast();

  const handleArchive = async () => {
    try {
      const { error } = await supabase.functions.invoke('archive-letter', {
        body: { letterId: '778e692a-367b-444c-b44b-88decc0083f4' }
      });
      
      if (error) {
        console.error('Archive function error:', error);
        toast({
          title: "Archivierung fehlgeschlagen",
          description: "Fehler: " + error.message,
          variant: "destructive"
        });
      } else {
        console.log('Letter archiving triggered successfully');
        toast({
          title: "Archivierung erfolgreich",
          description: "Brief wurde erfolgreich archiviert"
        });
      }
    } catch (error) {
      console.error('Failed to trigger archiving:', error);
      toast({
        title: "Archivierung fehlgeschlagen",
        description: "Unbekannter Fehler beim Archivieren",
        variant: "destructive"
      });
    }
  };

  return (
    <Button onClick={handleArchive} variant="outline">
      Brief "fsdfsdfsdfsd" manuell archivieren
    </Button>
  );
};