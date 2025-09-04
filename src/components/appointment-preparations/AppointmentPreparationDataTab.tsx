import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EditIcon, SaveIcon, XIcon, FileTextIcon } from "lucide-react";
import { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";

interface AppointmentPreparationDataTabProps {
  preparation: AppointmentPreparation;
  onUpdate: (updates: Partial<AppointmentPreparation>) => Promise<void>;
}

export function AppointmentPreparationDataTab({ 
  preparation, 
  onUpdate 
}: AppointmentPreparationDataTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(preparation.preparation_data || {});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await onUpdate({ preparation_data: editData });
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving preparation data:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditData(preparation.preparation_data || {});
    setIsEditing(false);
  };

  const handleFieldChange = (field: string, value: string) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const fields = [
    { key: "objectives", label: "Ziele", placeholder: "Welche Ziele sollen erreicht werden?" },
    { key: "key_topics", label: "Hauptthemen", placeholder: "Wichtigste Gesprächsthemen" },
    { key: "talking_points", label: "Gesprächspunkte", placeholder: "Konkrete Punkte für das Gespräch" },
    { key: "audience", label: "Zielgruppe", placeholder: "An wen richtet sich der Termin?" },
    { key: "contact_person", label: "Ansprechpartner", placeholder: "Hauptansprechpartner vor Ort" },
    { key: "materials_needed", label: "Benötigte Materialien", placeholder: "Welche Materialien werden benötigt?" },
    { key: "facts_figures", label: "Fakten & Zahlen", placeholder: "Wichtige Daten und Statistiken" },
    { key: "position_statements", label: "Positionspapiere", placeholder: "Offizielle Positionen und Standpunkte" },
    { key: "questions_answers", label: "Fragen & Antworten", placeholder: "Mögliche Fragen und vorbereitete Antworten" },
    { key: "technology_setup", label: "Technik-Setup", placeholder: "Technische Voraussetzungen" },
    { key: "dress_code", label: "Kleiderordnung", placeholder: "Angemessene Kleidung für den Anlass" },
    { key: "event_type", label: "Veranstaltungstyp", placeholder: "Art der Veranstaltung" }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileTextIcon className="h-5 w-5" />
              Vorbereitungsdaten
            </CardTitle>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <EditIcon className="h-4 w-4 mr-2" />
                Bearbeiten
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <label className="text-sm font-medium">{field.label}</label>
                    {field.key === "objectives" || 
                     field.key === "talking_points" || 
                     field.key === "facts_figures" || 
                     field.key === "position_statements" || 
                     field.key === "questions_answers" ? (
                      <Textarea
                        value={editData[field.key] || ""}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        rows={3}
                      />
                    ) : (
                      <Input
                        value={editData[field.key] || ""}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                      />
                    )}
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={handleSave} disabled={saving}>
                  <SaveIcon className="h-4 w-4 mr-2" />
                  {saving ? "Speichern..." : "Speichern"}
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  <XIcon className="h-4 w-4 mr-2" />
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {fields.map((field) => {
                  const value = preparation.preparation_data?.[field.key];
                  if (!value) return null;
                  
                  return (
                    <div key={field.key} className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        {field.label}
                      </label>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-sm whitespace-pre-wrap">{value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {!fields.some(field => preparation.preparation_data?.[field.key]) && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileTextIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Noch keine Vorbereitungsdaten vorhanden.</p>
                  <p className="text-sm">Klicken Sie auf "Bearbeiten", um Daten hinzuzufügen.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}