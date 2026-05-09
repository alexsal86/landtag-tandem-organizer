import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft } from "lucide-react";
import { EmployeeMeetingProtocol } from "@/features/employees/components/EmployeeMeetingProtocol";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { debugConsole } from "@/utils/debugConsole";
import { notify } from "@/lib/notify";
import { toast } from "@/hooks/use-toast";

export default function EmployeeMeetingDetail() {
  const { meetingId, subId } = useParams<{ meetingId?: string; subId?: string }>();
  const resolvedMeetingId = meetingId || subId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user || !resolvedMeetingId) {
        setLoading(false);
        return;
      }

      try {
        const { data: meeting, error } = await supabase
          .from("employee_meetings")
          .select("employee_id, conducted_by")
          .eq("id", resolvedMeetingId)
          .maybeSingle();

        if (error) throw error;
        if (!meeting) {
          notify.error("Nicht gefunden", { description: "Gespräch konnte nicht gefunden werden."
});
          navigate("/employee");
          return;
        }

        const canAccess = meeting.employee_id === user.id || meeting.conducted_by === user.id;
        setHasAccess(canAccess);

        if (!canAccess) {
          notify.error("Zugriff verweigert", {
            description: "Sie haben keinen Zugriff auf dieses Gespräch."
});
          navigate("/employee");
        }
      } catch (error: unknown) {
        debugConsole.error("Error checking access:", error);
        notify.error("Fehler", {
          description: "Gespräch konnte nicht geladen werden."
});
        navigate("/employee");
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [user, resolvedMeetingId, navigate, toast]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!hasAccess || !resolvedMeetingId) {
    return null;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Button>
      </div>
      <EmployeeMeetingProtocol meetingId={resolvedMeetingId} onBack={() => navigate("/employee")} />
    </div>
  );
}
