import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { EmployeeMeetingProtocol } from "@/components/EmployeeMeetingProtocol";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function EmployeeMeetingDetail() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user || !meetingId) {
        setLoading(false);
        return;
      }

      try {
        const { data: meeting, error } = await supabase
          .from("employee_meetings")
          .select("employee_id, conducted_by")
          .eq("id", meetingId)
          .single();

        if (error) throw error;

        const canAccess = meeting.employee_id === user.id || meeting.conducted_by === user.id;
        setHasAccess(canAccess);

        if (!canAccess) {
          toast({
            title: "Zugriff verweigert",
            description: "Sie haben keinen Zugriff auf dieses Gespräch.",
            variant: "destructive",
          });
          navigate("/employee");
        }
      } catch (error: any) {
        console.error("Error checking access:", error);
        toast({
          title: "Fehler",
          description: "Gespräch konnte nicht geladen werden.",
          variant: "destructive",
        });
        navigate("/employee");
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [user, meetingId, navigate, toast]);

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

  if (!hasAccess || !meetingId) {
    return null;
  }

  return (
    <div className="space-y-6 p-6">
      <EmployeeMeetingProtocol meetingId={meetingId} onBack={() => navigate("/employee")} />
    </div>
  );
}
