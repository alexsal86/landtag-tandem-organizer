import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUp, FileText, Search, Settings, Eye } from 'lucide-react';
import { DrucksachenUpload } from './drucksachen/DrucksachenUpload';
import { ProtocolsList } from './drucksachen/ProtocolsList';
import { ProtocolViewer } from './drucksachen/ProtocolViewer';
import { ProtocolSearch } from './drucksachen/ProtocolSearch';
import { ProtocolAnalytics } from './drucksachen/ProtocolAnalytics';
import { toast } from 'sonner';

interface Protocol {
  id: string;
  protocol_date: string;
  session_number: string;
  legislature_period: string;
  original_filename: string;
  processing_status: string;
  processing_error_message?: string;
  created_at: string;
  updated_at: string;
  file_path?: string;
  file_size?: number;
  uploaded_by?: string;
}

export function DrucksachenView() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upload');

  // Load protocols
  const loadProtocols = async () => {
    if (!currentTenant) return;
    
    try {
      const { data, error } = await supabase
        .from('parliament_protocols')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('protocol_date', { ascending: false });

      if (error) throw error;
      setProtocols(data || []);
    } catch (error) {
      console.error('Error loading protocols:', error);
      toast.error('Fehler beim Laden der Protokolle');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProtocols();
  }, [currentTenant]);

  // Handle upload success
  const handleUploadSuccess = (newProtocol: Protocol) => {
    setProtocols(prev => [newProtocol, ...prev]);
    setActiveTab('protocols');
    toast.success('Protokoll erfolgreich hochgeladen');
  };

  // Handle protocol selection
  const handleProtocolSelect = (protocol: Protocol) => {
    setSelectedProtocol(protocol);
    setActiveTab('viewer');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Lade Protokolle...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Drucksachen</h1>
          <p className="text-muted-foreground">
            Landtagsprotokolle analysieren und verwalten
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{protocols.length}</div>
                <div className="text-sm text-muted-foreground">Protokolle</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {protocols.filter(p => p.processing_status === 'completed').length}
                </div>
                <div className="text-sm text-muted-foreground">Verarbeitet</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {protocols.filter(p => p.processing_status === 'processing').length}
                </div>
                <div className="text-sm text-muted-foreground">In Bearbeitung</div>
              </div>
              {protocols.filter(p => p.processing_status === 'error').length > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {protocols.filter(p => p.processing_status === 'error').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Fehler</div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="protocols" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Protokolle ({protocols.length})
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Suche
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Analytik
          </TabsTrigger>
          <TabsTrigger 
            value="viewer" 
            disabled={!selectedProtocol} 
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            Viewer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <DrucksachenUpload 
            onUploadSuccess={handleUploadSuccess}
            onProtocolsRefresh={loadProtocols}
          />
        </TabsContent>

        <TabsContent value="protocols" className="space-y-6">
          <ProtocolsList 
            protocols={protocols}
            onProtocolSelect={handleProtocolSelect}
            onProtocolsRefresh={loadProtocols}
          />
        </TabsContent>

        <TabsContent value="search" className="space-y-6">
          <ProtocolSearch 
            onResultSelect={(result) => {
              // Find and select the protocol
              const protocol = protocols.find(p => p.id === result.protocol_id);
              if (protocol) {
                setSelectedProtocol(protocol);
                setActiveTab('viewer');
              }
            }}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {currentTenant && (
            <ProtocolAnalytics 
              tenantId={currentTenant.id}
            />
          )}
        </TabsContent>

        <TabsContent value="viewer" className="space-y-6">
          {selectedProtocol ? (
            <ProtocolViewer 
              protocol={selectedProtocol}
              onClose={() => {
                setSelectedProtocol(null);
                setActiveTab('protocols');
              }}
            />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-96">
                <div className="text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4" />
                  <p>Wählen Sie ein Protokoll aus der Liste aus</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
