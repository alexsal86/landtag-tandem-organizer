import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Database 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProtocolExportProps {
  protocolId: string;
  protocolTitle: string;
}

export function ProtocolExport({ protocolId, protocolTitle }: ProtocolExportProps) {
  const [isExporting, setIsExporting] = React.useState(false);

  const exportToJSON = async () => {
    setIsExporting(true);
    try {
      // Fetch protocol data with all related tables
      const { data: protocol, error: protocolError } = await supabase
        .from('parliament_protocols')
        .select(`
          *,
          protocol_agenda_items (*),
          protocol_speeches (*),
          protocol_sessions (*)
        `)
        .eq('id', protocolId)
        .single();

      if (protocolError) throw protocolError;

      // Create export object
      const exportData = {
        protocol: {
          id: protocol.id,
          session_number: protocol.session_number,
          protocol_date: protocol.protocol_date,
          legislature_period: protocol.legislature_period,
          original_filename: protocol.original_filename
        },
        agenda_items: protocol.protocol_agenda_items || [],
        speeches: protocol.protocol_speeches || [],
        sessions: protocol.protocol_sessions || [],
        exported_at: new Date().toISOString()
      };

      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${protocolTitle}_export.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('JSON-Export erfolgreich erstellt');
    } catch (error) {
      console.error('Error exporting JSON:', error);
      toast.error('Fehler beim JSON-Export');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToCSV = async () => {
    setIsExporting(true);
    try {
      // Fetch speeches for CSV export
      const { data: speeches, error } = await supabase
        .from('protocol_speeches')
        .select('*')
        .eq('protocol_id', protocolId)
        .order('page_number');

      if (error) throw error;

      // Create CSV content
      const headers = ['Seite', 'Redner', 'Partei', 'Inhalt', 'Start Zeit'];
      const csvContent = [
        headers.join(','),
        ...(speeches || []).map(speech => [
          speech.page_number || '',
          `"${(speech.speaker_name || '').replace(/"/g, '""')}"`,
          `"${(speech.speaker_party || '').replace(/"/g, '""')}"`,
          `"${(speech.speech_content || '').replace(/"/g, '""')}"`,
          speech.start_time || ''
        ].join(','))
      ].join('\n');

      // Download as CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${protocolTitle}_speeches.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('CSV-Export erfolgreich erstellt');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Fehler beim CSV-Export');
    } finally {
      setIsExporting(false);
    }
  };

  const downloadOriginalPDF = async () => {
    setIsExporting(true);
    try {
      const { data: protocol, error } = await supabase
        .from('parliament_protocols')
        .select('file_path, original_filename')
        .eq('id', protocolId)
        .single();

      if (error) throw error;

      if (protocol.file_path) {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('documents')
          .download(protocol.file_path);

        if (downloadError) throw downloadError;

        const url = URL.createObjectURL(fileData);
        const a = document.createElement('a');
        a.href = url;
        a.download = protocol.original_filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success('PDF-Download gestartet');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Fehler beim PDF-Download');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Export & Download
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button
          variant="outline"
          onClick={exportToJSON}
          disabled={isExporting}
          className="flex items-center gap-2"
        >
          <Database className="h-4 w-4" />
          JSON Export
        </Button>
        
        <Button
          variant="outline"
          onClick={exportToCSV}
          disabled={isExporting}
          className="flex items-center gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          CSV Export
        </Button>
        
        <Button
          variant="outline"
          onClick={downloadOriginalPDF}
          disabled={isExporting}
          className="flex items-center gap-2"
        >
          <FileText className="h-4 w-4" />
          Original PDF
        </Button>
      </CardContent>
    </Card>
  );
}