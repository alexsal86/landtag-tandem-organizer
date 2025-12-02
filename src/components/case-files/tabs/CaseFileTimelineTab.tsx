import { useState } from "react";
import { CaseFileTimelineEntry } from "@/hooks/useCaseFileDetails";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Clock, Flag, FileText, Calendar, CheckSquare, Mail } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface CaseFileTimelineTabProps {
  timeline: CaseFileTimelineEntry[];
  onAddEntry: (entry: Omit<CaseFileTimelineEntry, 'id' | 'case_file_id' | 'created_at' | 'created_by'>) => Promise<boolean>;
  onDeleteEntry: (id: string) => Promise<boolean>;
}

const EVENT_TYPES = [
  { value: 'milestone', label: 'Meilenstein', icon: Flag, color: 'bg-purple-500' },
  { value: 'meeting', label: 'Besprechung', icon: Calendar, color: 'bg-blue-500' },
  { value: 'decision', label: 'Entscheidung', icon: CheckSquare, color: 'bg-green-500' },
  { value: 'document', label: 'Dokument', icon: FileText, color: 'bg-orange-500' },
  { value: 'correspondence', label: 'Korrespondenz', icon: Mail, color: 'bg-cyan-500' },
  { value: 'note', label: 'Notiz', icon: Clock, color: 'bg-gray-500' },
];

export function CaseFileTimelineTab({ timeline, onAddEntry, onDeleteEntry }: CaseFileTimelineTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    event_date: new Date().toISOString().split('T')[0],
    event_type: 'note',
    title: '',
    description: '',
  });

  const handleAdd = async () => {
    if (!formData.title.trim() || !formData.event_date) return;
    setIsSubmitting(true);
    const success = await onAddEntry({
      event_date: formData.event_date,
      event_type: formData.event_type,
      title: formData.title,
      description: formData.description || null,
      source_type: 'manual',
      source_id: null,
    });
    setIsSubmitting(false);
    if (success) {
      setDialogOpen(false);
      setFormData({
        event_date: new Date().toISOString().split('T')[0],
        event_type: 'note',
        title: '',
        description: '',
      });
    }
  };

  const getEventConfig = (type: string) => {
    return EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[5];
  };

  // Group timeline by month
  const groupedTimeline = timeline.reduce((acc, entry) => {
    const month = format(new Date(entry.event_date), 'MMMM yyyy', { locale: de });
    if (!acc[month]) acc[month] = [];
    acc[month].push(entry);
    return acc;
  }, {} as Record<string, CaseFileTimelineEntry[]>);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Chronologie
        </CardTitle>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Ereignis hinzufügen
        </Button>
      </CardHeader>
      <CardContent>
        {timeline.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Noch keine Ereignisse in der Chronologie
          </p>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedTimeline).map(([month, entries]) => (
              <div key={month}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-4">{month}</h3>
                <div className="relative border-l-2 border-muted pl-6 space-y-6">
                  {entries.map((entry) => {
                    const config = getEventConfig(entry.event_type);
                    const Icon = config.icon;
                    return (
                      <div key={entry.id} className="relative">
                        {/* Timeline dot */}
                        <div className={cn(
                          "absolute -left-[31px] w-4 h-4 rounded-full border-2 border-background",
                          config.color
                        )} />
                        
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                <Icon className="h-3 w-3 mr-1" />
                                {config.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(entry.event_date), 'dd. MMMM yyyy', { locale: de })}
                              </span>
                            </div>
                            <h4 className="font-medium">{entry.title}</h4>
                            {entry.description && (
                              <p className="text-sm text-muted-foreground">{entry.description}</p>
                            )}
                          </div>
                          {entry.source_type === 'manual' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => onDeleteEntry(entry.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ereignis hinzufügen</DialogTitle>
            <DialogDescription>
              Fügen Sie ein neues Ereignis zur Chronologie hinzu.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Datum</Label>
                <Input
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Typ</Label>
                <Select
                  value={formData.event_type}
                  onValueChange={(value) => setFormData({ ...formData, event_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Titel *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="z.B. Erste Lesung im Ausschuss"
              />
            </div>
            <div className="grid gap-2">
              <Label>Beschreibung (optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Weitere Details..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleAdd} 
              disabled={!formData.title.trim() || !formData.event_date || isSubmitting}
            >
              {isSubmitting ? "Füge hinzu..." : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
