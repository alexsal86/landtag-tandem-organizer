import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Mail, Eye, CheckCircle, XCircle, Clock, Download, RefreshCw, Filter, ArrowUpDown, Calendar, Edit, X, Trash2 } from "lucide-react";
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
  const [scheduledEmails, setScheduledEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showRetryDialog, setShowRetryDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("sent");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    if (user && currentTenant) {
      fetchEmailLogs();
      fetchScheduledEmails();
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
        failed_recipients: Array.isArray(log.failed_recipients) ? log.failed_recipients as Array<{ email: string; error: string }> : undefined,
      })) as EmailLog[];
      
      setEmailLogs(typedData);
    } catch (error: any) {
      console.error("Error fetching email logs:", error);
      toast({ title: "Fehler beim Laden", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduledEmails = async () => {
    try {
      const { data, error } = await supabase
        .from("scheduled_emails")
        .select("*")
        .eq("tenant_id", currentTenant!.id)
        .eq("user_id", user!.id)
        .in("status", ["scheduled"])
        .order("scheduled_for", { ascending: true });

      if (error) throw error;
      setScheduledEmails(data || []);
    } catch (error: any) {
      console.error("Error fetching scheduled emails:", error);
    }
  };

  const handleCancelScheduled = async (emailId: string) => {
    try {
      const { error } = await supabase
        .from("scheduled_emails")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", emailId);

      if (error) throw error;
      toast({ title: "Abgebrochen", description: "Geplante E-Mail wurde abgebrochen" });
      fetchScheduledEmails();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteEmail = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from("email_logs")
        .delete()
        .eq("id", deleteTarget);

      if (error) throw error;
      toast({ title: "Gelöscht", description: "E-Mail-Eintrag wurde gelöscht." });
      setEmailLogs(prev => prev.filter(l => l.id !== deleteTarget));
      setDeleteTarget(null);
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
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
            {activeTab === "sent" 
              ? `${filteredEmailLogs.length} von ${emailLogs.length} E-Mails`
              : `${scheduledEmails.length} geplante E-Mails`}
          </p>
        </div>
        {activeTab === "sent" && (
          <Button onClick={handleExportCSV} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            CSV Export
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sent">Gesendet</TabsTrigger>
          <TabsTrigger value="scheduled">
            Geplant ({scheduledEmails.length})
          </TabsTrigger>
        </TabsList>

        {/* Sent Tab */}
        <TabsContent value="sent">
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
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetails(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {log.status === "failed" && (
                          <Button variant="outline" size="sm" onClick={() => handleRetry(log)}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(log.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
        </TabsContent>

        {/* Scheduled Tab */}
        <TabsContent value="scheduled">
          <Card>
            <CardContent className="pt-6">
              {scheduledEmails.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine geplanten E-Mails vorhanden
                </div>
              ) : (
                <div className="space-y-4">
                  {scheduledEmails.map((email) => (
                    <Card key={email.id}>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                Geplant für: {format(new Date(email.scheduled_for), "dd.MM.yyyy HH:mm", { locale: de })}
                              </span>
                            </div>
                            <h3 className="font-semibold">{email.subject}</h3>
                            <p className="text-sm text-muted-foreground">
                              {Array.isArray(email.recipients) ? email.recipients.length : 0} Empfänger
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancelScheduled(email.id)}
                              className="gap-2"
                            >
                              <X className="h-4 w-4" />
                              Abbrechen
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>E-Mail-Eintrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Eintrag wird unwiderruflich aus dem Verlauf entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEmail} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedEmail && selectedEmail.failed_recipients && (
        <EmailRetryDialog
          open={showRetryDialog}
          onOpenChange={setShowRetryDialog}
          emailLogId={selectedEmail.id}
          failedRecipients={selectedEmail.failed_recipients}
          emailSubject={selectedEmail.subject}
          emailBody={selectedEmail.body_html}
          onRetrySuccess={() => {
            fetchEmailLogs();
            setShowRetryDialog(false);
          }}
        />
      )}
    </div>
  );
}
