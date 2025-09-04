import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { 
  CalendarIcon, 
  MapPin, 
  Users, 
  FileText, 
  Settings, 
  Video, 
  Clock, 
  CheckCircle2, 
  Circle,
  MessageSquare,
  Paperclip,
  User,
  Globe,
  Lock,
  Edit2,
  Save,
  X,
  Plus,
  Trash2,
  ArrowLeft,
  Download,
  Share,
  Archive
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface EventPlanning {
  id: string;
  title: string;
  description?: string;
  location?: string;
  background_info?: string;
  confirmed_date?: string;
  is_private: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
  is_digital?: boolean;
  digital_platform?: string;
  digital_link?: string;
  digital_access_info?: string;
}

interface EventPlanningContact {
  id: string;
  event_planning_id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  created_at: string;
  updated_at: string;
}

interface EventPlanningSpeaker {
  id: string;
  event_planning_id: string;
  name: string;
  email?: string;
  phone?: string;
  bio?: string;
  topic?: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface EventPlanningDate {
  id: string;
  event_planning_id: string;
  date_time: string;
  is_confirmed: boolean;
  appointment_id?: string;
}

interface ChecklistItem {
  id: string;
  event_planning_id: string;
  title: string;
  is_completed: boolean;
  order_index: number;
  type?: string;
  sub_items?: Array<{
    title: string;
    is_completed: boolean;
  }>;
}

interface Collaborator {
  id: string;
  event_planning_id: string;
  user_id: string;
  can_edit: boolean;
  profiles?: {
    display_name?: string;
    avatar_url?: string;
  };
}

interface EventPlanningDetailViewProps {
  planning: EventPlanning;
  planningDates: EventPlanningDate[];
  checklistItems: ChecklistItem[];
  collaborators: Collaborator[];
  contacts: EventPlanningContact[];
  speakers: EventPlanningSpeaker[];
  onBack: () => void;
  onDelete: () => void;
  onUpdate: (planning: Partial<EventPlanning>) => void;
}

export function EventPlanningDetailView({
  planning,
  planningDates,
  checklistItems,
  collaborators,
  contacts,
  speakers,
  onBack,
  onDelete,
  onUpdate
}: EventPlanningDetailViewProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [editMode, setEditMode] = useState(false);
  const [editedPlanning, setEditedPlanning] = useState<Partial<EventPlanning>>({});

  useEffect(() => {
    setEditedPlanning(planning);
  }, [planning]);

  const handleSave = () => {
    onUpdate(editedPlanning);
    setEditMode(false);
  };

  const handleCancel = () => {
    setEditedPlanning(planning);
    setEditMode(false);
  };

  const confirmedDate = planningDates.find(d => d.is_confirmed);
  const suggestedDates = planningDates.filter(d => !d.is_confirmed);
  
  const completedTasks = checklistItems.filter(item => item.is_completed).length;
  const totalTasks = checklistItems.length;
  const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const getStatusInfo = () => {
    if (confirmedDate) {
      return { 
        status: "Bestätigt", 
        variant: "default" as const, 
        icon: CheckCircle2,
        color: "text-green-600"
      };
    }
    if (suggestedDates.length > 0) {
      return { 
        status: "Terminvorschläge vorhanden", 
        variant: "secondary" as const, 
        icon: Clock,
        color: "text-orange-600"
      };
    }
    return { 
      status: "In Planung", 
      variant: "outline" as const, 
      icon: Circle,
      color: "text-blue-600"
    };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <div className="bg-background border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Zurück
              </Button>
              <div className="space-y-1">
                {editMode ? (
                  <Input
                    value={editedPlanning.title || ""}
                    onChange={(e) => setEditedPlanning({ ...editedPlanning, title: e.target.value })}
                    className="text-2xl font-bold h-auto border-none p-0 bg-transparent"
                    placeholder="Veranstaltungstitel..."
                  />
                ) : (
                  <h1 className="text-2xl font-bold">{planning.title}</h1>
                )}
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <StatusIcon className={cn("h-4 w-4", statusInfo.color)} />
                    <span>{statusInfo.status}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {planning.is_private ? (
                      <>
                        <Lock className="h-4 w-4" />
                        <span>Privat</span>
                      </>
                    ) : (
                      <>
                        <Globe className="h-4 w-4" />
                        <span>Team</span>
                      </>
                    )}
                  </div>
                  <span>Erstellt am {format(new Date(planning.created_at), "dd.MM.yyyy", { locale: de })}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Share className="h-4 w-4 mr-2" />
                Teilen
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportieren
              </Button>
              {editMode ? (
                <>
                  <Button onClick={handleSave} size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Speichern
                  </Button>
                  <Button variant="outline" onClick={handleCancel} size="sm">
                    <X className="h-4 w-4 mr-2" />
                    Abbrechen
                  </Button>
                </>
              ) : (
                <Button onClick={() => setEditMode(true)} size="sm">
                  <Edit2 className="h-4 w-4 mr-2" />
                  Bearbeiten
                </Button>
              )}
              <Button variant="destructive" onClick={onDelete} size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Löschen
              </Button>
            </div>
          </div>

          {/* Progress Bar */}
          {totalTasks > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fortschritt</span>
                <span className="font-medium">{completedTasks} von {totalTasks} Aufgaben</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="dates">Termine</TabsTrigger>
            <TabsTrigger value="contacts">Kontakte</TabsTrigger>
            <TabsTrigger value="speakers">Redner</TabsTrigger>
            <TabsTrigger value="checklist">Checkliste</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Info */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <FileText className="h-5 w-5" />
                      <span>Grundinformationen</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Beschreibung</Label>
                      {editMode ? (
                        <Textarea
                          value={editedPlanning.description || ""}
                          onChange={(e) => setEditedPlanning({ ...editedPlanning, description: e.target.value })}
                          placeholder="Beschreibung der Veranstaltung..."
                          rows={4}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground mt-1">
                          {planning.description || "Keine Beschreibung vorhanden"}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label>Ort</Label>
                      {editMode ? (
                        <Input
                          value={editedPlanning.location || ""}
                          onChange={(e) => setEditedPlanning({ ...editedPlanning, location: e.target.value })}
                          placeholder="Veranstaltungsort..."
                        />
                      ) : (
                        <div className="flex items-center mt-1">
                          <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span className="text-sm">{planning.location || "Kein Ort angegeben"}</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <Label>Hintergrundinformationen</Label>
                      {editMode ? (
                        <Textarea
                          value={editedPlanning.background_info || ""}
                          onChange={(e) => setEditedPlanning({ ...editedPlanning, background_info: e.target.value })}
                          placeholder="Zusätzliche Hintergrundinformationen..."
                          rows={3}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground mt-1">
                          {planning.background_info || "Keine Hintergrundinformationen vorhanden"}
                        </p>
                      )}
                    </div>

                    {editMode && (
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={editedPlanning.is_private || false}
                          onCheckedChange={(checked) => setEditedPlanning({ ...editedPlanning, is_private: checked })}
                        />
                        <Label>Nur für mich sichtbar</Label>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Digital Event Info */}
                {(planning.is_digital || editMode) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Video className="h-5 w-5" />
                        <span>Digitale Veranstaltung</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {editMode && (
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={editedPlanning.is_digital || false}
                            onCheckedChange={(checked) => setEditedPlanning({ ...editedPlanning, is_digital: checked })}
                          />
                          <Label>Digitale Veranstaltung</Label>
                        </div>
                      )}

                      {(editedPlanning.is_digital || planning.is_digital) && (
                        <>
                          <div>
                            <Label>Plattform</Label>
                            {editMode ? (
                              <Input
                                value={editedPlanning.digital_platform || ""}
                                onChange={(e) => setEditedPlanning({ ...editedPlanning, digital_platform: e.target.value })}
                                placeholder="z.B. Zoom, Teams, Meet..."
                              />
                            ) : (
                              <p className="text-sm mt-1">{planning.digital_platform || "Nicht angegeben"}</p>
                            )}
                          </div>

                          <div>
                            <Label>Meeting-Link</Label>
                            {editMode ? (
                              <Input
                                value={editedPlanning.digital_link || ""}
                                onChange={(e) => setEditedPlanning({ ...editedPlanning, digital_link: e.target.value })}
                                placeholder="https://..."
                              />
                            ) : (
                              <p className="text-sm mt-1">
                                {planning.digital_link ? (
                                  <a href={planning.digital_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                    {planning.digital_link}
                                  </a>
                                ) : (
                                  "Nicht angegeben"
                                )}
                              </p>
                            )}
                          </div>

                          <div>
                            <Label>Zugangsinfos</Label>
                            {editMode ? (
                              <Textarea
                                value={editedPlanning.digital_access_info || ""}
                                onChange={(e) => setEditedPlanning({ ...editedPlanning, digital_access_info: e.target.value })}
                                placeholder="Passwort, Meeting-ID, etc..."
                                rows={2}
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground mt-1">
                                {planning.digital_access_info || "Keine Zugangsinfos vorhanden"}
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Status Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Badge variant={statusInfo.variant} className="w-full justify-center">
                      <StatusIcon className="h-4 w-4 mr-2" />
                      {statusInfo.status}
                    </Badge>

                    {confirmedDate && (
                      <div className="space-y-2">
                        <Label>Bestätigter Termin</Label>
                        <div className="flex items-center text-sm">
                          <CalendarIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                          {format(new Date(confirmedDate.date_time), "dd.MM.yyyy HH:mm", { locale: de })}
                        </div>
                      </div>
                    )}

                    {suggestedDates.length > 0 && (
                      <div className="space-y-2">
                        <Label>Terminvorschläge ({suggestedDates.length})</Label>
                        <div className="space-y-1">
                          {suggestedDates.slice(0, 3).map((date) => (
                            <div key={date.id} className="flex items-center text-sm text-muted-foreground">
                              <Clock className="h-3 w-3 mr-2" />
                              {format(new Date(date.date_time), "dd.MM.yyyy HH:mm", { locale: de })}
                            </div>
                          ))}
                          {suggestedDates.length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              +{suggestedDates.length - 3} weitere
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle>Übersicht</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Aufgaben</span>
                      <Badge variant="outline">{completedTasks}/{totalTasks}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Kontakte</span>
                      <Badge variant="outline">{contacts.length}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Redner</span>
                      <Badge variant="outline">{speakers.length}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Team</span>
                      <Badge variant="outline">{collaborators.length + 1}</Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Team Members */}
                {collaborators.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Users className="h-4 w-4" />
                        <span>Team</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {collaborators.slice(0, 4).map((collab) => (
                          <div key={collab.id} className="flex items-center space-x-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={collab.profiles?.avatar_url} />
                              <AvatarFallback className="text-xs">
                                {collab.profiles?.display_name?.[0] || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{collab.profiles?.display_name || "Unbekannt"}</span>
                            {collab.can_edit && (
                              <Badge variant="secondary" className="text-xs">Edit</Badge>
                            )}
                          </div>
                        ))}
                        {collaborators.length > 4 && (
                          <p className="text-xs text-muted-foreground">
                            +{collaborators.length - 4} weitere Mitglieder
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Other tabs would be implemented similarly */}
          <TabsContent value="dates">
            <Card>
              <CardHeader>
                <CardTitle>Terminverwaltung</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Terminverwaltung wird hier implementiert...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts">
            <Card>
              <CardHeader>
                <CardTitle>Kontakte</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Kontaktverwaltung wird hier implementiert...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="speakers">
            <Card>
              <CardHeader>
                <CardTitle>Redner</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Rednerverwaltung wird hier implementiert...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="checklist">
            <Card>
              <CardHeader>
                <CardTitle>Checkliste</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Checkliste wird hier implementiert...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team">
            <Card>
              <CardHeader>
                <CardTitle>Team & Zusammenarbeit</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Team-Management wird hier implementiert...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
