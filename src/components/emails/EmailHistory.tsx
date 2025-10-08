import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Mail, Eye, CheckCircle, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";

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
      
      // Cast JSONB fields to proper types
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

  const filteredEmailLogs = emailLogs.filter((log) =>
    log.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.recipients.some(r => r.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
            {emailLogs.length} gesendete E-Mail{emailLogs.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="E-Mails durchsuchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">E-Mails werden geladen...</p>
            </div>
          ) : filteredEmailLogs.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? "Keine E-Mails für diese Suche gefunden." : "Noch keine E-Mails versendet."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Betreff</TableHead>
                  <TableHead>Empfänger</TableHead>
                  <TableHead>Gesendet am</TableHead>
                  <TableHead>Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmailLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status)}
                        {getStatusBadge(log.status)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{log.subject}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span>{log.recipients.length} Empfänger</span>
                        {log.recipients.length > 0 && (
                          <span className="text-xs text-muted-foreground truncate max-w-xs">
                            {log.recipients[0]}
                            {log.recipients.length > 1 && ` +${log.recipients.length - 1} weitere`}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(log.sent_at), "dd.MM.yyyy HH:mm", { locale: de })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(log)}
                        className="gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>E-Mail-Details</DialogTitle>
            <DialogDescription>
              Gesendet am{" "}
              {selectedEmail &&
                format(new Date(selectedEmail.sent_at), "dd.MM.yyyy HH:mm", { locale: de })}
            </DialogDescription>
          </DialogHeader>

          {selectedEmail && (
            <div className="space-y-4">
              <div>
                <Label className="font-semibold">Status</Label>
                <div className="mt-1">{getStatusBadge(selectedEmail.status)}</div>
                {selectedEmail.error_message && (
                  <p className="text-sm text-red-600 mt-1">{selectedEmail.error_message}</p>
                )}
              </div>

              <div>
                <Label className="font-semibold">Betreff</Label>
                <p className="mt-1">{selectedEmail.subject}</p>
              </div>

              <div>
                <Label className="font-semibold">Empfänger ({selectedEmail.recipients.length})</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {selectedEmail.recipients.map((recipient, idx) => (
                    <Badge key={idx} variant="secondary">
                      {recipient}
                    </Badge>
                  ))}
                </div>
              </div>

              {selectedEmail.cc && selectedEmail.cc.length > 0 && (
                <div>
                  <Label className="font-semibold">CC</Label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {selectedEmail.cc.map((cc, idx) => (
                      <Badge key={idx} variant="outline">
                        {cc}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedEmail.bcc && selectedEmail.bcc.length > 0 && (
                <div>
                  <Label className="font-semibold">BCC</Label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {selectedEmail.bcc.map((bcc, idx) => (
                      <Badge key={idx} variant="outline">
                        {bcc}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="font-semibold">Nachricht</Label>
                <div
                  className="mt-1 p-4 border rounded-lg bg-muted/20"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Label = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <label className={`text-sm font-medium ${className}`}>{children}</label>
);