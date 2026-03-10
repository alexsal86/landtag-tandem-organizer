import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, CheckCircle2, Loader2, X, AlertCircle } from "lucide-react";
import { EmployeeMeetingScheduler } from "./EmployeeMeetingScheduler";
import { debugConsole } from "@/utils/debugConsole";
import { fetchPendingMeetingRequests, PendingMeetingRequest } from "./employees/hooks/meetingRequests";

interface MeetingRequestManagerProps {
  onPendingCountChange?: (count: number) => void;
  onMeetingScheduled?: () => void | Promise<void>;
}

export function EmployeeMeetingRequestManager({ onPendingCountChange, onMeetingScheduled }: MeetingRequestManagerProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<PendingMeetingRequest[]>([]);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PendingMeetingRequest | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; name: string } | null>(null);
  const [scheduledRequestId, setScheduledRequestId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (!user || !currentTenant) return;
    setLoading(true);
    try {
      const enrichedRequests = await fetchPendingMeetingRequests(currentTenant.id);
      setRequests(enrichedRequests);
      onPendingCountChange?.(enrichedRequests.length);
    } catch (error: unknown) {
      debugConsole.error("Error loading requests:", error);
      toast({
        title: "Fehler",
        description: "Anfragen konnten nicht geladen werden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentTenant, onPendingCountChange, toast, user]);

  useEffect(() => {
    if (!user || !currentTenant) return;
    loadRequests();
  }, [user, currentTenant, loadRequests]);

  const handleSchedule = (request: PendingMeetingRequest) => {
    setScheduledRequestId(request.id);
    setSelectedEmployee({
      id: request.employee_id,
      name: request.employee_name || "Unbekannt",
    });
    setSchedulerOpen(true);
  };

  const handleSchedulerClose = async () => {
    setSchedulerOpen(false);
    setSelectedEmployee(null);
    setScheduledRequestId(null);
    await Promise.all([loadRequests(), Promise.resolve(onMeetingScheduled?.())]);
  };

  const handleDecline = (request: PendingMeetingRequest) => {
    setSelectedRequest(request);
    setDeclineDialogOpen(true);
  };

  const confirmDecline = async () => {
    if (!selectedRequest || !user) return;
    setDeclining(true);
    try {
      const { error } = await supabase
        .from("employee_meeting_requests")
        .update({
          status: "declined",
          declined_reason: declineReason,
          declined_by: user.id,
          declined_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);

      if (error) throw error;

      // Send notification to employee
      await supabase.rpc("create_notification", {
        user_id_param: selectedRequest.employee_id,
        type_name: "employee_meeting_request_declined",
        title_param: "Gesprächsanfrage abgelehnt",
        message_param: `Ihre Gesprächsanfrage wurde abgelehnt. Grund: ${declineReason}`,
        data_param: {
          request_id: selectedRequest.id,
          reason: declineReason,
        },
        priority_param: "medium",
      });

      toast({
        title: "Anfrage abgelehnt",
        description: "Die Gesprächsanfrage wurde abgelehnt.",
      });

      setDeclineDialogOpen(false);
      setDeclineReason("");
      setSelectedRequest(null);
      await loadRequests();
    } catch (error: unknown) {
      debugConsole.error("Error declining request:", error);
      toast({
        title: "Fehler",
        description: "Anfrage konnte nicht abgelehnt werden",
        variant: "destructive",
      });
    } finally {
      setDeclining(false);
    }
  };

  const handleMarkCompleted = async (request: PendingMeetingRequest) => {
    try {
      const { error } = await supabase
        .from("employee_meeting_requests")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (error) throw error;

      toast({
        title: "Als erledigt markiert",
        description: "Die Anfrage wurde als erledigt markiert.",
      });

      await loadRequests();
    } catch (error: unknown) {
      debugConsole.error("Error marking as completed:", error);
      toast({
        title: "Fehler",
        description: "Status konnte nicht aktualisiert werden",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Offene Gesprächsanfragen
              {requests.length > 0 && (
                <Badge variant="default">{requests.length}</Badge>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Keine offenen Anfragen</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{request.employee_name}</h4>
                        <Badge variant="secondary">
                          {formatDistanceToNow(new Date(request.created_at), {
                            addSuffix: true,
                            locale: de,
                          })}
                        </Badge>
                      </div>
                      {request.reason && (
                        <div className="flex items-start gap-2 text-sm">
                          <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <p className="text-muted-foreground">{request.reason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => handleSchedule(request)}
                      className="flex items-center gap-2"
                    >
                      <Calendar className="h-4 w-4" />
                      Terminieren
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkCompleted(request)}
                      className="flex items-center gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Als erledigt
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDecline(request)}
                      className="flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      Ablehnen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decline Dialog */}
      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gesprächsanfrage ablehnen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Grund für die Ablehnung</Label>
              <Textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Bitte geben Sie einen Grund für die Ablehnung an..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeclineDialogOpen(false);
                setDeclineReason("");
              }}
              disabled={declining}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDecline}
              disabled={declining || !declineReason.trim()}
            >
              {declining ? "Wird abgelehnt..." : "Ablehnen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scheduler Dialog */}
      {selectedEmployee && (
        <EmployeeMeetingScheduler
          employeeId={selectedEmployee.id}
          employeeName={selectedEmployee.name}
          requestId={scheduledRequestId}
          open={schedulerOpen}
          onOpenChange={setSchedulerOpen}
          onScheduled={handleSchedulerClose}
        />
      )}
    </>
  );
}
