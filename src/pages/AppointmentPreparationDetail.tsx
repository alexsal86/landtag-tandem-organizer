import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit, Archive, Calendar, CheckSquare, FileText, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import { AppointmentPreparationOverviewTab } from "@/components/appointment-preparations/AppointmentPreparationOverviewTab";
import { AppointmentPreparationDataTab } from "@/components/appointment-preparations/AppointmentPreparationDataTab";
import { AppointmentPreparationChecklistTab } from "@/components/appointment-preparations/AppointmentPreparationChecklistTab";
import { AppointmentPreparationDetailsTab } from "@/components/appointment-preparations/AppointmentPreparationDetailsTab";

export default function AppointmentPreparationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const {
    preparation,
    loading,
    error,
    updatePreparation,
    archivePreparation
  } = useAppointmentPreparation(id);

  useEffect(() => {
    if (error) {
      toast({
        title: "Fehler",
        description: "Terminplanung konnte nicht geladen werden.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Terminplanung wird geladen...</p>
        </div>
      </div>
    );
  }

  if (!preparation) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-6">
        <div className="max-w-6xl mx-auto">
          <Button 
            variant="outline" 
            onClick={() => navigate(-1)}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          <Card className="bg-card shadow-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <h3 className="text-lg font-semibold mb-2">Terminplanung nicht gefunden</h3>
              <p className="text-muted-foreground">Die angeforderte Terminplanung existiert nicht.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default">Abgeschlossen</Badge>;
      case "in_progress":
        return <Badge variant="secondary">In Bearbeitung</Badge>;
      case "draft":
        return <Badge variant="outline">Entwurf</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleArchive = async () => {
    try {
      await archivePreparation();
      toast({
        title: "Archiviert",
        description: "Terminplanung wurde erfolgreich archiviert.",
      });
      navigate("/eventplanning");
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Terminplanung konnte nicht archiviert werden.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate("/eventplanning")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zu Planungen
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleArchive}>
              <Archive className="h-4 w-4 mr-2" />
              Archivieren
            </Button>
          </div>
        </div>

        {/* Title Card */}
        <Card className="bg-card shadow-elegant border-border mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">{preparation.title}</CardTitle>
                <div className="flex gap-2 items-center">
                  {getStatusBadge(preparation.status)}
                  <span className="text-sm text-muted-foreground">
                    Erstellt am {new Date(preparation.created_at).toLocaleDateString('de-DE')}
                  </span>
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>Zuletzt bearbeitet:</p>
                <p>{new Date(preparation.updated_at).toLocaleString('de-DE')}</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Übersicht
            </TabsTrigger>
            <TabsTrigger value="preparation" className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Vorbereitung
            </TabsTrigger>
            <TabsTrigger value="checklist" className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              Checkliste
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Details
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="overview">
              <AppointmentPreparationOverviewTab 
                preparation={preparation}
                onUpdate={updatePreparation}
              />
            </TabsContent>

            <TabsContent value="preparation">
              <AppointmentPreparationDataTab
                preparation={preparation}
                onUpdate={updatePreparation}
              />
            </TabsContent>

            <TabsContent value="checklist">
              <AppointmentPreparationChecklistTab
                preparation={preparation}
                onUpdate={updatePreparation}
              />
            </TabsContent>

            <TabsContent value="details">
              <AppointmentPreparationDetailsTab
                preparation={preparation}
                onUpdate={updatePreparation}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}