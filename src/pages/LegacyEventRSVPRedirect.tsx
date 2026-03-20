import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

export default function LegacyEventRSVPRedirect() {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");

  if (code) {
    return <Navigate to={`/einladung/${encodeURIComponent(code)}`} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-lg">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          {eventId
            ? "Dieser ältere Einladungslink wird nicht mehr unterstützt. Bitte verwenden Sie den aktuellen Link aus der Einladung."
            : "Ungültiger Einladungslink."}
        </CardContent>
      </Card>
    </div>
  );
}
