import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, Calendar, CheckSquare, MessageSquare, Users, FileText, 
  Calendar as CalendarIcon, Clock, Settings, Edit3, X, Save,
  GripVertical, Trash2, Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  link: string;
  iconSize: 'sm' | 'md' | 'lg';
  color?: string;
  description?: string;
}

interface QuickActionsWidgetProps {
  className?: string;
  widgetSize?: string;
  onConfigurationChange?: (config: any) => void;
  configuration?: {
    actions?: QuickAction[];
    columns?: number;
    theme?: string;
  };
}

// Available icons
const iconMap = {
  Plus, Calendar, CheckSquare, MessageSquare, Users, FileText,
  CalendarIcon, Clock, Settings, Edit3, X, Save, GripVertical, Trash2
};

const iconOptions = [
  { value: 'Plus', label: 'Plus' },
  { value: 'Calendar', label: 'Kalender' },
  { value: 'CheckSquare', label: 'Aufgaben' },
  { value: 'MessageSquare', label: 'Nachrichten' },
  { value: 'Users', label: 'Kontakte' },
  { value: 'FileText', label: 'Dokumente' },
  { value: 'CalendarIcon', label: 'Termine' },
  { value: 'Clock', label: 'Zeit' },
  { value: 'Settings', label: 'Einstellungen' },
  { value: 'Edit3', label: 'Bearbeiten' },
  { value: 'X', label: 'Schließen' },
  { value: 'Save', label: 'Speichern' },
  { value: 'GripVertical', label: 'Verschieben' },
  { value: 'Trash2', label: 'Löschen' }
];

const defaultActions: QuickAction[] = [
  {
    id: '1',
    label: 'Neue Aufgabe',
    icon: 'CheckSquare',
    link: '/create-task',
    iconSize: 'md',
    description: 'Erstelle eine neue Aufgabe'
  },
  {
    id: '2',
    label: 'Termin anlegen',
    icon: 'Calendar',
    link: '/create-appointment',
    iconSize: 'md',
    description: 'Neuen Termin eintragen'
  },
  {
    id: '3',
    label: 'Kontakt erstellen',
    icon: 'Users',
    link: '/create-contact',
    iconSize: 'md',
    description: 'Neuen Kontakt hinzufügen'
  },
  {
    id: '4',
    label: 'Entscheidung',
    icon: 'MessageSquare',
    link: '/task-decisions',
    iconSize: 'md',
    description: 'Entscheidungsanfrage stellen'
  },
  {
    id: '5',
    label: 'Dokumente',
    icon: 'FileText',
    link: '/documents',
    iconSize: 'md',
    description: 'Dokumente verwalten'
  },
  {
    id: '6',
    label: 'Kalender',
    icon: 'CalendarIcon',
    link: '/calendar',
    iconSize: 'md',
    description: 'Kalender öffnen'
  },
  {
    id: '7',
    label: 'Nachrichten',
    icon: 'MessageSquare',
    link: '/messages',
    iconSize: 'md',
    description: 'Nachrichten anzeigen'
  },
  {
    id: '8',
    label: 'Einstellungen',
    icon: 'Settings',
    link: '/settings',
    iconSize: 'md',
    description: 'System konfigurieren'
  }
];

export const QuickActionsWidget: React.FC<QuickActionsWidgetProps> = ({
  className,
  widgetSize = '3x2',
  onConfigurationChange,
  configuration = {}
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [actions, setActions] = useState<QuickAction[]>(configuration.actions || defaultActions);
  const [editingAction, setEditingAction] = useState<QuickAction | null>(null);
  const [newAction, setNewAction] = useState<Partial<QuickAction>>({
    label: '',
    icon: 'Plus',
    link: '',
    iconSize: 'md'
  });

  const getColumns = () => {
    if (widgetSize === 'full-width') return 'auto';
    if (configuration.columns) return configuration.columns;
    
    // Auto-determine columns based on widget size
    const [width] = widgetSize.split('x').map(Number);
    if (width <= 2) return 2;
    if (width <= 3) return 3;
    return 4;
  };

  const getIconSize = (size: 'sm' | 'md' | 'lg') => {
    switch (size) {
      case 'sm': return 'h-4 w-4';
      case 'md': return 'h-5 w-5';
      case 'lg': return 'h-6 w-6';
      default: return 'h-5 w-5';
    }
  };

  const getActionButtonSize = (): "sm" | "lg" | "default" => {
    const [width, height] = widgetSize.split('x').map(Number);
    if (width <= 2 || height <= 1) return 'sm';
    if (width >= 4 || height >= 3) return 'lg';
    return 'default';
  };

  const handleSaveConfiguration = () => {
    const newConfig = {
      ...configuration,
      actions,
      columns: getColumns()
    };
    
    onConfigurationChange?.(newConfig);
    setIsEditMode(false);
    toast.success('Konfiguration gespeichert');
  };

  const handleAddAction = () => {
    if (!newAction.label || !newAction.link) {
      toast.error('Label und Link sind erforderlich');
      return;
    }

    const action: QuickAction = {
      id: Date.now().toString(),
      label: newAction.label!,
      icon: newAction.icon || 'Plus',
      link: newAction.link!,
      iconSize: newAction.iconSize || 'md',
      description: newAction.description
    };

    setActions(prev => [...prev, action]);
    setNewAction({ label: '', icon: 'Plus', link: '', iconSize: 'md' });
  };

  const handleEditAction = (action: QuickAction) => {
    setEditingAction(action);
  };

  const handleUpdateAction = () => {
    if (!editingAction) return;

    setActions(prev => prev.map(action => 
      action.id === editingAction.id ? editingAction : action
    ));
    setEditingAction(null);
  };

  const handleDeleteAction = (id: string) => {
    setActions(prev => prev.filter(action => action.id !== id));
  };

  const handleMoveAction = (fromIndex: number, toIndex: number) => {
    const newActions = [...actions];
    const [movedAction] = newActions.splice(fromIndex, 1);
    newActions.splice(toIndex, 0, movedAction);
    setActions(newActions);
  };

  const renderIcon = (iconName: string, size: string = 'h-5 w-5') => {
    const IconComponent = iconMap[iconName as keyof typeof iconMap];
    return IconComponent ? <IconComponent className={size} /> : <Plus className={size} />;
  };

  const buttonSize = getActionButtonSize();
  const columns = getColumns();

  // Full-width layout (horizontal scrollbar)
  if (widgetSize === 'full-width') {
    return (
      <Card className={`w-full ${className}`}>
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Schnellzugriff
            </CardTitle>
            {!isEditMode && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsEditMode(true)}
                className="h-7 w-7 p-0"
              >
                <Edit3 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pb-3 px-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {actions.map((action) => (
              <Button
                key={action.id}
                asChild
                variant="outline"
                size="sm"
                className="flex-shrink-0 h-auto min-w-[100px] p-3 flex flex-col items-center gap-1.5 hover:bg-accent"
              >
                <Link to={action.link}>
                  {renderIcon(action.icon, 'h-5 w-5')}
                  <span className="text-xs text-center leading-tight whitespace-nowrap">
                    {action.label}
                  </span>
                </Link>
              </Button>
            ))}
            
            {isEditMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddAction}
                className="flex-shrink-0 h-auto min-w-[100px] p-3 flex flex-col items-center gap-1.5 border-dashed"
              >
                <Plus className="h-5 w-5" />
                <span className="text-xs">Hinzufügen</span>
              </Button>
            )}
          </div>
          
          {isEditMode && (
            <div className="mt-3 pt-3 border-t space-y-3">
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setIsEditMode(false)}>
                  <X className="h-3 w-3 mr-1" />
                  Schließen
                </Button>
                <Button size="sm" onClick={handleSaveConfiguration}>
                  <Save className="h-3 w-3 mr-1" />
                  Speichern
                </Button>
              </div>
              
              {/* Existing Actions List */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {actions.map((action) => (
                  <div key={action.id} className="flex items-center gap-2 p-2 border rounded bg-background">
                    <div className="flex-1 grid grid-cols-3 gap-2 text-xs">
                      <span className="truncate">{action.label}</span>
                      <span className="truncate text-muted-foreground">{action.link}</span>
                      <div className="flex items-center gap-1">
                        {renderIcon(action.icon, 'h-3 w-3')}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleEditAction(action)} className="h-6 w-6 p-0">
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteAction(action.id)} className="h-6 w-6 p-0">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>

        {/* Edit Action Dialog */}
        <Dialog open={!!editingAction} onOpenChange={() => setEditingAction(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Aktion bearbeiten</DialogTitle>
            </DialogHeader>
            {editingAction && (
              <div className="space-y-4">
                <div>
                  <Label>Label</Label>
                  <Input
                    value={editingAction.label}
                    onChange={(e) => setEditingAction(prev => prev ? { ...prev, label: e.target.value } : null)}
                  />
                </div>
                <div>
                  <Label>Link</Label>
                  <Input
                    value={editingAction.link}
                    onChange={(e) => setEditingAction(prev => prev ? { ...prev, link: e.target.value } : null)}
                  />
                </div>
                <div>
                  <Label>Beschreibung</Label>
                  <Textarea
                    value={editingAction.description || ''}
                    onChange={(e) => setEditingAction(prev => prev ? { ...prev, description: e.target.value } : null)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Icon</Label>
                    <Select 
                      value={editingAction.icon} 
                      onValueChange={(value) => setEditingAction(prev => prev ? { ...prev, icon: value } : null)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {iconOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              {renderIcon(option.value, 'h-4 w-4')}
                              {option.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Icon-Größe</Label>
                    <Select 
                      value={editingAction.iconSize} 
                      onValueChange={(value: 'sm' | 'md' | 'lg') => setEditingAction(prev => prev ? { ...prev, iconSize: value } : null)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sm">Klein</SelectItem>
                        <SelectItem value="md">Mittel</SelectItem>
                        <SelectItem value="lg">Groß</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditingAction(null)}>
                    Abbrechen
                  </Button>
                  <Button onClick={handleUpdateAction}>
                    Speichern
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </Card>
    );
  }

  // Regular widget layout
  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Schnellzugriff
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditMode(!isEditMode)}
            className="h-7 w-7 p-0"
          >
            <Edit3 className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto">
        {isEditMode ? (
          <div className="space-y-4">
            {/* Configuration Panel */}
            <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Aktionen bearbeiten</h4>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveConfiguration}>
                    <Save className="h-3 w-3 mr-1" />
                    Speichern
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditMode(false)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Add New Action */}
              <div className="space-y-2 p-2 border rounded bg-background">
                <Label className="text-xs font-medium">Neue Aktion hinzufügen</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Label"
                    value={newAction.label}
                    onChange={(e) => setNewAction(prev => ({ ...prev, label: e.target.value }))}
                    className="text-xs"
                  />
                  <Input
                    placeholder="Link (z.B. /tasks)"
                    value={newAction.link}
                    onChange={(e) => setNewAction(prev => ({ ...prev, link: e.target.value }))}
                    className="text-xs"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Select 
                    value={newAction.icon} 
                    onValueChange={(value) => setNewAction(prev => ({ ...prev, icon: value }))}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {iconOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            {renderIcon(option.value, 'h-3 w-3')}
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select 
                    value={newAction.iconSize} 
                    onValueChange={(value: 'sm' | 'md' | 'lg') => setNewAction(prev => ({ ...prev, iconSize: value }))}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sm">Klein</SelectItem>
                      <SelectItem value="md">Mittel</SelectItem>
                      <SelectItem value="lg">Groß</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleAddAction}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Existing Actions */}
              <div className="space-y-2">
                {actions.map((action, index) => (
                  <div key={action.id} className="flex items-center gap-2 p-2 border rounded bg-background">
                    <GripVertical className="h-3 w-3 text-muted-foreground cursor-move" />
                    <div className="flex-1 grid grid-cols-3 gap-2 text-xs">
                      <span className="truncate">{action.label}</span>
                      <span className="truncate text-muted-foreground">{action.link}</span>
                      <div className="flex items-center gap-1">
                        {renderIcon(action.icon, 'h-3 w-3')}
                        <span className="text-muted-foreground">{action.iconSize}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleEditAction(action)} className="h-6 w-6 p-0">
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteAction(action.id)} className="h-6 w-6 p-0">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Normal View */
          <div 
            className={`grid gap-2 h-full`}
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          >
            {actions.map((action) => (
              <Button
                key={action.id}
                asChild
                variant="outline"
                size={buttonSize}
                className="h-auto p-3 flex flex-col items-center justify-center gap-2 hover:bg-accent/50 transition-colors"
                title={action.description}
              >
                <Link to={action.link}>
                  {renderIcon(action.icon, getIconSize(action.iconSize))}
                  <span className={`text-center leading-tight ${
                    buttonSize === 'sm' ? 'text-xs' : 
                    buttonSize === 'lg' ? 'text-sm' : 'text-xs'
                  }`}>
                    {action.label}
                  </span>
                </Link>
              </Button>
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit Action Dialog */}
      <Dialog open={!!editingAction} onOpenChange={() => setEditingAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aktion bearbeiten</DialogTitle>
          </DialogHeader>
          {editingAction && (
            <div className="space-y-4">
              <div>
                <Label>Label</Label>
                <Input
                  value={editingAction.label}
                  onChange={(e) => setEditingAction(prev => prev ? { ...prev, label: e.target.value } : null)}
                />
              </div>
              <div>
                <Label>Link</Label>
                <Input
                  value={editingAction.link}
                  onChange={(e) => setEditingAction(prev => prev ? { ...prev, link: e.target.value } : null)}
                />
              </div>
              <div>
                <Label>Beschreibung</Label>
                <Textarea
                  value={editingAction.description || ''}
                  onChange={(e) => setEditingAction(prev => prev ? { ...prev, description: e.target.value } : null)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Icon</Label>
                  <Select 
                    value={editingAction.icon} 
                    onValueChange={(value) => setEditingAction(prev => prev ? { ...prev, icon: value } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {iconOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            {renderIcon(option.value, 'h-4 w-4')}
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Icon-Größe</Label>
                  <Select 
                    value={editingAction.iconSize} 
                    onValueChange={(value: 'sm' | 'md' | 'lg') => setEditingAction(prev => prev ? { ...prev, iconSize: value } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sm">Klein</SelectItem>
                      <SelectItem value="md">Mittel</SelectItem>
                      <SelectItem value="lg">Groß</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingAction(null)}>
                  Abbrechen
                </Button>
                <Button onClick={handleUpdateAction}>
                  Speichern
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
