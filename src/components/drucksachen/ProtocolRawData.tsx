import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { sanitizeRichHtml } from '@/utils/htmlSanitizer';

interface ProtocolRawDataProps {
  structuredData: any;
}

export function ProtocolRawData({ structuredData }: ProtocolRawDataProps) {
  const [copied, setCopied] = useState(false);

  const formatJSON = (obj: any): string => {
    return JSON.stringify(obj, null, 2);
  };


  const escapeHtml = (value: string): string => {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formatJSON(structuredData));
      setCopied(true);
      toast.success('JSON in die Zwischenablage kopiert');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Fehler beim Kopieren');
    }
  };

  const highlightJSON = (json: string): string => {
    const safeJson = escapeHtml(json);

    return safeJson
      .replace(/"([^"]+)":/g, '<span class="protocol-json-key">"$1"</span>:')
      .replace(/: "([^"]*)"/g, ': <span class="protocol-json-string">"$1"</span>')
      .replace(/: (\d+)/g, ': <span class="protocol-json-number">$1</span>')
      .replace(/: (true|false)/g, ': <span class="protocol-json-boolean">$1</span>');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>JSON Rohdaten</CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={copyToClipboard}
          className="gap-2"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Kopiert
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Kopieren
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-300px)]">
          <div 
            className="protocol-json-preview"
            dangerouslySetInnerHTML={{ 
              __html: sanitizeRichHtml(highlightJSON(formatJSON(structuredData))) 
            }}
          />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
