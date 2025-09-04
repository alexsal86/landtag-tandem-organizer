import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileTextIcon, ChevronDownIcon, ChevronRightIcon, UsersIcon, FolderIcon, MessageSquareIcon, SettingsIcon, CheckCircleIcon } from "lucide-react";
import { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import { debounce } from "@/utils/debounce";
import { toast } from "@/hooks/use-toast";

interface AppointmentPreparationDataTabProps {
  preparation: AppointmentPreparation;
  onUpdate: (updates: Partial<AppointmentPreparation>) => Promise<void>;
}

export function AppointmentPreparationDataTab({ 
  preparation, 
  onUpdate 
}: AppointmentPreparationDataTabProps) {
  const [editData, setEditData] = useState(preparation.preparation_data || {});
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    basics: true,
    people: false,
    materials: false,
    communication: false,
    framework: false
  });

  const debouncedSave = useCallback(
    debounce(async (data: any) => {
      try {
        setSaving(true);
        await onUpdate({ preparation_data: data });
        toast({
          title: "Gespeichert",
          description: "Änderungen wurden automatisch gespeichert.",
        });
      } catch (error) {
        console.error("Error saving preparation data:", error);
        toast({
          title: "Fehler",
          description: "Fehler beim Speichern der Änderungen.",
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    }, 500),
    [onUpdate]
  );

  const handleFieldChange = (field: string, value: string) => {
    const newData = { ...editData, [field]: value };
    setEditData(newData);
    debouncedSave(newData);
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const fieldSections = {
    basics: {
      title: "Grundlagen",
      icon: FileTextIcon,
      fields: [
        { key: "objectives", label: "Ziele", placeholder: "Welche Ziele sollen erreicht werden?", multiline: true },
        { key: "key_topics", label: "Hauptthemen", placeholder: "Wichtigste Gesprächsthemen" },
        { key: "talking_points", label: "Gesprächspunkte", placeholder: "Konkrete Punkte für das Gespräch", multiline: true },
      ]
    },
    people: {
      title: "Personen",
      icon: UsersIcon,
      fields: [
        { key: "audience", label: "Zielgruppe", placeholder: "An wen richtet sich der Termin?" },
        { key: "contact_person", label: "Ansprechpartner", placeholder: "Hauptansprechpartner vor Ort" },
      ]
    },
    materials: {
      title: "Materialien & Unterlagen",
      icon: FolderIcon,
      fields: [
        { key: "materials_needed", label: "Benötigte Materialien", placeholder: "Welche Materialien werden benötigt?" },
        { key: "facts_figures", label: "Fakten & Zahlen", placeholder: "Wichtige Daten und Statistiken", multiline: true },
        { key: "position_statements", label: "Positionspapiere", placeholder: "Offizielle Positionen und Standpunkte", multiline: true },
      ]
    },
    communication: {
      title: "Kommunikation",
      icon: MessageSquareIcon,
      fields: [
        { key: "questions_answers", label: "Fragen & Antworten", placeholder: "Mögliche Fragen und vorbereitete Antworten", multiline: true },
      ]
    },
    framework: {
      title: "Rahmenbedingungen",
      icon: SettingsIcon,
      fields: [
        { key: "technology_setup", label: "Technik-Setup", placeholder: "Technische Voraussetzungen" },
        { key: "dress_code", label: "Kleiderordnung", placeholder: "Angemessene Kleidung für den Anlass", type: "select" },
        { key: "event_type", label: "Veranstaltungstyp", placeholder: "Art der Veranstaltung" },
      ]
    }
  };

  const dressCodeOptions = [
    { value: "casual", label: "Casual" },
    { value: "business_casual", label: "Business Casual" },
    { value: "business_formal", label: "Business Formal" },
    { value: "festlich", label: "Festlich" },
    { value: "uniform", label: "Uniformpflicht" },
    { value: "custom", label: "Benutzerdefiniert" }
  ];

  const getFilledFieldsCount = (sectionKey: string) => {
    const section = fieldSections[sectionKey as keyof typeof fieldSections];
    const filledCount = section.fields.filter(field => editData[field.key]?.trim()).length;
    return `${filledCount}/${section.fields.length}`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5" />
            Vorbereitungsdaten
            {saving && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin h-3 w-3 border border-primary border-t-transparent rounded-full" />
                Speichert...
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(fieldSections).map(([sectionKey, section]) => {
            const SectionIcon = section.icon;
            const isExpanded = expandedSections[sectionKey as keyof typeof expandedSections];
            const filledCount = getFilledFieldsCount(sectionKey);
            
            return (
              <Collapsible
                key={sectionKey}
                open={isExpanded}
                onOpenChange={() => toggleSection(sectionKey as keyof typeof expandedSections)}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <SectionIcon className="h-5 w-5 text-primary" />
                    <h3 className="font-medium">{section.title}</h3>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                      {filledCount}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronDownIcon className="h-4 w-4" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4" />
                  )}
                </CollapsibleTrigger>
                
                <CollapsibleContent className="pt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {section.fields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <label className="text-sm font-medium">{field.label}</label>
                        
                        {field.type === "select" ? (
                          <div className="space-y-2">
                            <Select
                              value={editData[field.key] || ""}
                              onValueChange={(value) => handleFieldChange(field.key, value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={field.placeholder} />
                              </SelectTrigger>
                              <SelectContent>
                                {dressCodeOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            
                            {editData[field.key] === "custom" && (
                              <Input
                                value={editData[`${field.key}_custom`] || ""}
                                onChange={(e) => handleFieldChange(`${field.key}_custom`, e.target.value)}
                                placeholder="Benutzerdefinierte Kleiderordnung eingeben..."
                              />
                            )}
                          </div>
                        ) : field.multiline ? (
                          <Textarea
                            value={editData[field.key] || ""}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            rows={3}
                            className="resize-none"
                          />
                        ) : (
                          <Input
                            value={editData[field.key] || ""}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            placeholder={field.placeholder}
                          />
                        )}
                        
                        {editData[field.key] && (
                          <div className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircleIcon className="h-3 w-3" />
                            Ausgefüllt
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
          
          {Object.values(fieldSections).every(section => 
            section.fields.every(field => !editData[field.key])
          ) && (
            <div className="text-center py-8 text-muted-foreground">
              <FileTextIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Noch keine Vorbereitungsdaten vorhanden.</p>
              <p className="text-sm">Klappen Sie die Bereiche auf, um Daten hinzuzufügen.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}