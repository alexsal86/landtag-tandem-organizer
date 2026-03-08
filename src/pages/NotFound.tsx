import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { SearchX, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
      <div className="text-center max-w-md space-y-6">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
          <SearchX className="h-10 w-10 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">404</h1>
          <p className="text-lg text-muted-foreground">
            Seite nicht gefunden
          </p>
          <p className="text-sm text-muted-foreground/70">
            Die Seite <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">{location.pathname}</code> existiert nicht oder wurde verschoben.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button onClick={() => navigate(-1)} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Zurück
          </Button>
          <Button onClick={() => navigate("/mywork")} size="sm">
            <Home className="h-4 w-4 mr-1.5" />
            Zur Startseite
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
