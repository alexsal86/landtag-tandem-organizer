import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Mail, Eye, CheckCircle, XCircle, Clock, Download, RefreshCw, Filter, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { format, startOfToday, startOfWeek, startOfMonth } from "date-fns";
import { de } from "date-fns/locale";
import { EmailRetryDialog } from "./EmailRetryDialog";

interface EmailLog {
  id: string;
  subject: string;
  recipients: string[];
  cc: string[];
  bcc: string[];
  body_html: string;
  status: string;
  error_message?: string;
  sent_at: string;
  created_at: string;
  failed_recipients?: Array<{ email: string; error: string }>;
}

export function EmailHistory() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showRetryDialog, setShowRetryDialog] = useState(false);
  
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    if (user && currentTenant) {
      fetchEmailLogs();
    }
  }, [user, currentTenant]);

  const fetchEmailLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_logs")
        .select("*")
        .eq("tenant_id", currentTenant!.id)
        .eq("user_id", user!.id)
        .order("sent_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      
      const typedData = (data || []).map(log => ({
        ...log,
        recipients: Array.isArray(log.recipients) ? log.recipients : [],
        cc: Array.isArray(log.cc) ? log.cc : [],
        bcc: Array.isArray(log.bcc) ? log.bcc : [],
      })) as EmailLog[];
      
      setEmailLogs(typedData);
    } catch (error: any) {
      console.error("Error fetching email logs:", error);
      toast({
        title: "Fehler beim Laden",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getDateFilteredLogs = (logs: EmailLog[]) => {
    if (dateFilter === "all") return logs;
    
    const now = new Date();
    const filters: Record<string, Date> = {
      today: startOfToday(),
      week: startOfWeek(now, { locale: de }),
      month: startOfMonth(now),
    };
    
    const filterDate = filters[dateFilter];
    if (!filterDate) return logs;
    
    return logs.filter(log => new Date(log.sent_at) >= filterDate);
  };

  const getSortedLogs = (logs: EmailLog[]) => {
    const sorted = [...logs];
    
    switch (sortBy) {
      case "oldest":
        return sorted.sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
      case "subject-asc":
        return sorted.sort((a, b) => a.subject.localeCompare(b.subject));
      case "subject-desc":
        return sorted.sort((a, b) => b.subject.localeCompare(a.subject));
      case "status":
        return sorted.sort((a, b) => a.status.localeCompare(b.status));
      default:
        return sorted.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
    }
  };

  const filteredEmailLogs = (() => {
    let logs = emailLogs;
    
    if (searchTerm) {
      logs = logs.filter((log) =>
        log.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.recipients.some(r => r.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    if (statusFilter !== "all") {
      logs = logs.filter(log => log.status === statusFilter);
    }
    
    logs = getDateFilteredLogs(logs);
    logs = getSortedLogs(logs);
    
    return logs;
  })();

  const paginatedLogs = filteredEmailLogs.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(filteredEmailLogs.length / itemsPerPage);

  const handleExportCSV = () => {
    const headers = ["Datum", "Status", "Betreff", "Empfänger", "CC", "BCC"];
    const rows = filteredEmailLogs.map(log => [
      format(new Date(log.sent_at), "dd.MM.yyyy HH:mm", { locale: de }),
      log.status,
      log.subject,
      log.recipients.join("; "),
      log.cc?.join("; ") || "",
      log.bcc?.join("; ") || "",
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `email-verlauf-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    
    toast({ title: "Export erfolgreich", description: "CSV-Datei wurde heruntergeladen" });
  };

  const handleRetry = (email: EmailLog) => {
    setSelectedEmail(email);
    setShowRetryDialog(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "scheduled":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "destructive" | "secondary"; label: string }> = {
      sent: { variant: "default", label: "Gesendet" },
      failed: { variant: "destructive", label: "Fehlgeschlagen" },
      scheduled: { variant: "secondary", label: "Geplant" },
    };

    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleViewDetails = (email: EmailLog) => {
    setSelectedEmail(email);
    setShowDetailsDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">E-Mail-Verlauf</h2>
          <p className="text-sm text-muted-foreground">
            {filteredEmailLogs.length} von {emailLogs.length} E-Mails
          </p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          CSV Export
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="E-Mails durchsuchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="sent">Gesendet</SelectItem>
                <SelectItem value="failed">Fehlgeschlagen</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Zeiträume</SelectItem>
                <SelectItem value="today">Heute</SelectItem>
                <SelectItem value="week">Diese Woche</SelectItem>
                <SelectItem value="month">Dieser Monat</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Neueste zuerst</SelectItem>
                <SelectItem value="oldest">Älteste zuerst</SelectItem>
                <SelectItem value="subject-asc">Betreff A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Lädt...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Betreff</TableHead>
                  <TableHead>Empfänger</TableHead>
                  <TableHead>Gesendet</TableHead>
                  <TableHead>Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status)}
                        {getStatusBadge(log.status)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{log.subject}</TableCell>
                    <TableCell>{log.recipients.length} Empfänger</TableCell>
                    <TableCell>
                      {format(new Date(log.sent_at), "dd.MM.yyyy HH:mm", { locale: de })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetails(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {log.status === "failed" && (
                          <Button variant="outline" size="sm" onClick={() => handleRetry(log)}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {totalPages > 1 && (
            <div className="flex justify-between mt-4">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                Zurück
              </Button>
              <span>Seite {page} von {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Weiter
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>E-Mail-Details</DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              <div>
                <Label>Status</Label>
                <div className="mt-1">{getStatusBadge(selectedEmail.status)}</div>
              </div>
              <div>
                <Label>Betreff</Label>
                <p className="mt-1">{selectedEmail.subject}</p>
              </div>
              <div>
                <Label>Empfänger</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {selectedEmail.recipients.map((r, i) => (
                    <Badge key={i}>{r}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label>Nachricht</Label>
                <div className="mt-1 p-4 border rounded" dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedEmail && (
        <EmailRetryDialog
          open={showRetryDialog}
          onOpenChange={setShowRetryDialog}
          email={selectedEmail}
          onRetrySuccess={fetchEmailLogs}
        />
      )}
    </div>
  );
}
