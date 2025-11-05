import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Settings, X } from 'lucide-react';
import { useAppointmentFeedback } from '@/hooks/useAppointmentFeedback';
import { useAppointmentCategories } from '@/hooks/useAppointmentCategories';

export const AppointmentFeedbackSettings = () => {
  const { settings, updateSettings } = useAppointmentFeedback();
  const { data: categories } = useAppointmentCategories();
  const [isOpen, setIsOpen] = useState(false);
  const [reminderTime, setReminderTime] = useState(settings?.reminder_start_time || '17:00:00');
  const [priorityCategories, setPriorityCategories] = useState<string[]>(
    settings?.priority_categories || []
  );
  const [showAllAppointments, setShowAllAppointments] = useState(
    settings?.show_all_appointments ?? true
  );
  const [autoSkipInternal, setAutoSkipInternal] = useState(
    settings?.auto_skip_internal ?? false
  );

  const toggleCategory = (category: string) => {
    if (priorityCategories.includes(category)) {
      setPriorityCategories(priorityCategories.filter(c => c !== category));
    } else {
      setPriorityCategories([...priorityCategories, category]);
    }
  };

  const handleSave = () => {
    updateSettings({
      reminder_start_time: reminderTime,
      priority_categories: priorityCategories,
      show_all_appointments: showAllAppointments,
      auto_skip_internal: autoSkipInternal
    });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Termin-Feedback Einstellungen</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Reminder Zeit */}
          <div className="space-y-2">
            <Label htmlFor="reminder-time">Reminder-Zeit</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Ab dieser Uhrzeit wird das Reminder-Badge angezeigt
            </p>
            <Input
              id="reminder-time"
              type="time"
              value={reminderTime.slice(0, 5)}
              onChange={(e) => setReminderTime(`${e.target.value}:00`)}
            />
          </div>

          {/* Prioritäts-Kategorien */}
          <div className="space-y-2">
            <Label>Prioritäts-Kategorien</Label>
            <p className="text-xs text-muted-foreground mb-3">
              Diese Kategorien werden zuerst angezeigt
            </p>
            <div className="flex flex-wrap gap-2">
              {categories?.map((category) => (
                <Badge
                  key={category.id}
                  variant={priorityCategories.includes(category.name) ? 'default' : 'outline'}
                  className="cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => toggleCategory(category.name)}
                  style={{
                    backgroundColor: priorityCategories.includes(category.name) ? category.color : undefined,
                    borderColor: category.color,
                    color: priorityCategories.includes(category.name) ? '#fff' : category.color
                  }}
                >
                  {category.label}
                  {priorityCategories.includes(category.name) && (
                    <X className="w-3 h-3 ml-1" />
                  )}
                </Badge>
              ))}
            </div>
          </div>

          {/* Alle Termine anzeigen */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Alle Termine anzeigen</Label>
              <p className="text-xs text-muted-foreground">
                Auch Termine ohne Priorität anzeigen
              </p>
            </div>
            <Switch
              checked={showAllAppointments}
              onCheckedChange={setShowAllAppointments}
            />
          </div>

          {/* Auto-Skip interne Termine */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Interne Termine überspringen</Label>
              <p className="text-xs text-muted-foreground">
                Interne Termine automatisch als erledigt markieren
              </p>
            </div>
            <Switch
              checked={autoSkipInternal}
              onCheckedChange={setAutoSkipInternal}
            />
          </div>

          {/* Speichern Button */}
          <Button onClick={handleSave} className="w-full">
            Einstellungen speichern
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
