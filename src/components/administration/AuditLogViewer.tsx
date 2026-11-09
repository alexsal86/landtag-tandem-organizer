import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, LoadingState } from '@/components/ui-patterns';
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, Info, Search } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import Papa from "papaparse";

const LIMIT = 50;
type AuditLog = { id: string; created_at: string; ip_address: string | null; payload: unknown };
type AuditResult = { logs: AuditLog[]; totalCount: number };

export function AuditLogViewer() {
  const [offset, setOffset] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [ipFilter, setIpFilter] = useState("");
  const { currentTenant } = useTenant();
  const [filters, setFilters] = useState({ search: "", ip: "" });
  useEffect(() => {
    const timer = setTimeout(() => { setFilters({ search: searchTerm, ip: ipFilter }); setOffset(0); }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm, ipFilter]);
  useEffect(() => { setOffset(0); }, [currentTenant?.id]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit-logs', offset, filters, currentTenant?.id],
    queryFn: async (): Promise<AuditResult> => {
      if (!currentTenant?.id) return { logs: [], totalCount: 0 };
      const { data, error } = await supabase.rpc('search_admin_audit_logs', {
        _tenant_id: currentTenant.id, _search: filters.search, _ip: filters.ip, _offset: offset, _limit: LIMIT,
      });
      if (error) throw error;
      return data as unknown as AuditResult;
    },
    enabled: !!currentTenant?.id,
  });

  const handleExport = () => {
    if (!data?.logs) return;

    const csv = data.logs.map((log: AuditLog) => ({
      Zeitstempel: format(new Date(log.created_at), 'dd.MM.yyyy HH:mm:ss', { locale: de }),
      'IP-Adresse': log.ip_address || 'N/A',
      Aktion: (log.payload as Record<string, unknown>)?.action as string || 'Unbekannt',
      Details: JSON.stringify(log.payload),
    }));

    const csvContent = Papa.unparse(csv, { escapeFormulae: true });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrevious = () => {
    setOffset(Math.max(0, offset - LIMIT));
  };

  const handleNext = () => {
    if (data && offset + LIMIT < data.totalCount) {
      setOffset(offset + LIMIT);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit-Logs</CardTitle>
        <CardDescription>
          Aktivitätsprotokolle und Sicherheitsereignisse des aktuellen Büros
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche in Payload..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="IP-Adresse filtern..."
              value={ipFilter}
              onChange={(e) => setIpFilter(e.target.value)}
            />
          </div>
          <Button onClick={handleExport} disabled={isError || isLoading || !data?.logs.length} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Aktuelle Seite als CSV
          </Button>
        </div>

        {isError ? <div role="alert">Audit-Logs konnten nicht geladen werden. <Button onClick={() => void refetch()}>Erneut versuchen</Button></div> : isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Lade Logs...</div>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Zeitstempel</TableHead>
                    <TableHead className="w-[150px]">IP-Adresse</TableHead>
                    <TableHead>Aktion</TableHead>
                    <TableHead className="w-[80px]">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.logs && data.logs.length > 0 ? (
                    data.logs.map((log: AuditLog) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          {format(new Date(log.created_at), 'dd.MM.yyyy HH:mm:ss', { locale: de })}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.ip_address || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {(log.payload as Record<string, unknown>)?.action as string || 'Unbekannt'}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Info className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl">
                              <DialogHeader>
                                <DialogTitle>Log-Details</DialogTitle>
                              </DialogHeader>
                              <div className="mt-4">
                                <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-[500px]">
                                  {JSON.stringify(log, null, 2)}
                                </pre>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="py-space-md">
                        <EmptyState size="sm" title="Keine Logs gefunden" description="Passe Filter oder Zeitraum an." />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center mt-4">
              <span className="text-sm text-muted-foreground">
                Zeige {data?.totalCount ? offset + 1 : 0} bis {Math.min(offset + LIMIT, data?.totalCount || 0)} von {data?.totalCount || 0}
              </span>
              <div className="flex gap-2">
                <Button 
                  onClick={handlePrevious} 
                  disabled={offset === 0}
                  variant="outline"
                  size="sm"
                >
                  Zurück
                </Button>
                <Button 
                  onClick={handleNext} 
                  disabled={!data || offset + LIMIT >= data.totalCount}
                  variant="outline"
                  size="sm"
                >
                  Weiter
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
