import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { EmployeeMeetingProtocol } from "@/components/EmployeeMeetingProtocol";
import { useToast } from "@/hooks/use-toast";

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
        // Check if user has access to this meeting (either as employee or conductor)
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess || !meetingId) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 space-y-4">
      <Button variant="ghost" onClick={() => navigate("/employee")} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Zurück zur Übersicht
      </Button>
      <EmployeeMeetingProtocol meetingId={meetingId} onBack={() => navigate("/employee")} />
    </div>
  );
}
