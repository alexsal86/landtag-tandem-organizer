import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  FileText, 
  Calendar, 
  Download, 
  Eye, 
  Search, 
  Filter,
  MoreHorizontal,
  Trash2,
  RefreshCw
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  file_size?: number;
}

interface ProtocolsListProps {
  protocols: Protocol[];
  onProtocolSelect: (protocol: Protocol) => void;
  onProtocolsRefresh: () => void;
}

export function ProtocolsList({ protocols, onProtocolSelect, onProtocolsRefresh }: ProtocolsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'filename' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter and sort protocols
  const filteredProtocols = protocols
    .filter(protocol => {
      const matchesSearch = 
        protocol.original_filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        protocol.session_number.includes(searchTerm) ||
        protocol.legislature_period.includes(searchTerm);
      
      const matchesStatus = statusFilter === 'all' || protocol.processing_status === statusFilter;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case 'date':
          compareValue = new Date(a.protocol_date).getTime() - new Date(b.protocol_date).getTime();
          break;
        case 'filename':
          compareValue = a.original_filename.localeCompare(b.original_filename);
          break;
        case 'status':
          compareValue = a.processing_status.localeCompare(b.processing_status);
          break;
      }
      
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  // Get status label
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Verarbeitet';
      case 'processing':
        return 'Verarbeitung';
      case 'error':
        return 'Fehler';
      case 'uploaded':
        return 'Hochgeladen';
      default:
        return status;
    }
  };

  // Delete protocol
  const deleteProtocol = async (protocolId: string) => {
    try {
      const { error } = await supabase
        .from('parliament_protocols')
        .delete()
        .eq('id', protocolId);

      if (error) throw error;
      
      toast.success('Protokoll erfolgreich gelöscht');
      onProtocolsRefresh();
    } catch (error) {
      console.error('Error deleting protocol:', error);
      toast.error('Fehler beim Löschen des Protokolls');
    }
  };

  // Reprocess protocol
  const reprocessProtocol = async (protocolId: string) => {
    try {
      // Reset status to uploaded
      const { error } = await supabase
        .from('parliament_protocols')
        .update({ 
          processing_status: 'uploaded',
          processing_error_message: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', protocolId);

      if (error) throw error;

      // Trigger reprocessing
      try {
        await supabase.functions.invoke('analyze-parliament-protocol', {
          body: { protocolId }
        });
      } catch (error) {
        console.warn('Protocol analysis function not available:', error);
      }
      
      toast.success('Protokoll wird erneut verarbeitet');
      onProtocolsRefresh();
    } catch (error) {
      console.error('Error reprocessing protocol:', error);
      toast.error('Fehler beim erneuten Verarbeiten');
    }
  };

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Protokoll-Übersicht
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters and Search */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Protokolle durchsuchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="uploaded">Hochgeladen</SelectItem>
                <SelectItem value="processing">Verarbeitung</SelectItem>
                <SelectItem value="completed">Verarbeitet</SelectItem>
                <SelectItem value="error">Fehler</SelectItem>
              </SelectContent>
            </Select>

            <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
              const [field, order] = value.split('-');
              setSortBy(field as 'date' | 'filename' | 'status');
              setSortOrder(order as 'asc' | 'desc');
            }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Sortierung" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Datum (neueste zuerst)</SelectItem>
                <SelectItem value="date-asc">Datum (älteste zuerst)</SelectItem>
                <SelectItem value="filename-asc">Dateiname (A-Z)</SelectItem>
                <SelectItem value="filename-desc">Dateiname (Z-A)</SelectItem>
                <SelectItem value="status-asc">Status (A-Z)</SelectItem>
                <SelectItem value="status-desc">Status (Z-A)</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={onProtocolsRefresh}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Aktualisieren
            </Button>
          </div>

          {/* Results Summary */}
          <div className="text-sm text-muted-foreground">
            {filteredProtocols.length} von {protocols.length} Protokollen
          </div>

          {/* Protocols Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Protokoll</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Sitzung</TableHead>
                  <TableHead>Wahlperiode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Größe</TableHead>
                  <TableHead>Hochgeladen</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProtocols.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {searchTerm || statusFilter !== 'all' 
                        ? 'Keine Protokolle gefunden' 
                        : 'Noch keine Protokolle hochgeladen'
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProtocols.map((protocol) => (
                    <TableRow key={protocol.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Button
                          variant="link"
                          className="p-0 h-auto font-medium"
                          onClick={() => onProtocolSelect(protocol)}
                        >
                          {protocol.original_filename}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(protocol.protocol_date)}
                        </div>
                      </TableCell>
                      <TableCell>{protocol.session_number}</TableCell>
                      <TableCell>{protocol.legislature_period}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(protocol.processing_status)}>
                          {getStatusLabel(protocol.processing_status)}
                        </Badge>
                        {protocol.processing_status === 'error' && protocol.processing_error_message && (
                          <div className="text-xs text-red-600 mt-1">
                            {protocol.processing_error_message}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatFileSize(protocol.file_size)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(protocol.created_at)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onProtocolSelect(protocol)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Anzeigen
                            </DropdownMenuItem>
                            {protocol.processing_status === 'error' && (
                              <DropdownMenuItem onClick={() => reprocessProtocol(protocol.id)}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Erneut verarbeiten
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={() => deleteProtocol(protocol.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}