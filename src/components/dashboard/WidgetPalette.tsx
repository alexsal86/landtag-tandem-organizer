import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3,
  CheckSquare,
  Calendar,
  Zap,
  MessageSquare,
  StickyNote,
  Timer,
  Target,
  Phone,
  Users,
  Search,
  X,
  Plus,
  Sparkles,
  Clock,
  TrendingUp
} from 'lucide-react';
import { DashboardWidget } from '@/hooks/useDashboardLayout';

interface WidgetPaletteProps {
  onAddWidget: (type: DashboardWidget['type'], position?: { x: number; y: number }) => void;
  onClose: () => void;
  suggestions: any[];
}

const WIDGET_TYPES = [
  {
    type: 'stats' as const,
    title: 'Statistiken',
    description: 'Übersicht über wichtige KPIs',
    icon: BarChart3,
    category: 'analytics',
    popular: true
  },
  {
    type: 'tasks' as const,
    title: 'Aufgaben',
    description: 'To-Do Liste und Projektmanagement',
    icon: CheckSquare,
    category: 'productivity',
    popular: true
  },
  {
    type: 'schedule' as const,
    title: 'Terminplan',
    description: 'Heutige Termine und Events',
    icon: Calendar,
    category: 'calendar',
    popular: true
  },
  {
    type: 'actions' as const,
    title: 'Schnellaktionen',
    description: 'Häufig verwendete Funktionen',
    icon: Zap,
    category: 'productivity',
    popular: false
  },
  {
    type: 'messages' as const,
    title: 'Nachrichten',
    description: 'E-Mails und Kommunikation',
    icon: MessageSquare,
    category: 'communication',
    popular: true
  },
  {
    type: 'quicknotes' as const,
    title: 'Notizen',
    description: 'Schnelle Notizen und Memos',
    icon: StickyNote,
    category: 'productivity',
    popular: true
  },
  {
    type: 'pomodoro' as const,
    title: 'Pomodoro Timer',
    description: 'Zeitmanagement und Fokus',
    icon: Timer,
    category: 'productivity',
    popular: false
  },
  {
    type: 'habits' as const,
    title: 'Gewohnheiten',
    description: 'Habit Tracking und Streaks',
    icon: Target,
    category: 'wellness',
    popular: false
  },
  {
    type: 'calllog' as const,
    title: 'Anrufliste',
    description: 'Anrufprotokoll und Follow-ups',
    icon: Phone,
    category: 'communication',
    popular: false
  },
  {
    type: 'teamchat' as const,
    title: 'Team Chat',
    description: 'Interne Kommunikation',
    icon: Users,
    category: 'communication',
    popular: false
  }
];

const CATEGORIES = [
  { id: 'all', name: 'Alle', icon: Sparkles },
  { id: 'popular', name: 'Beliebt', icon: TrendingUp },
  { id: 'recent', name: 'Kürzlich', icon: Clock },
  { id: 'analytics', name: 'Analytics', icon: BarChart3 },
  { id: 'productivity', name: 'Produktivität', icon: CheckSquare },
  { id: 'communication', name: 'Kommunikation', icon: MessageSquare },
  { id: 'calendar', name: 'Kalender', icon: Calendar },
  { id: 'wellness', name: 'Wellness', icon: Target }
];

export function WidgetPalette({ onAddWidget, onClose, suggestions }: WidgetPaletteProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [recentWidgets, setRecentWidgets] = useState<string[]>([]);
  const [draggedType, setDraggedType] = useState<string | null>(null);

  useEffect(() => {
    // Load recent widgets from localStorage
    const recent = localStorage.getItem('recent-widgets');
    if (recent) {
      setRecentWidgets(JSON.parse(recent));
    }
  }, []);

  const filteredWidgets = WIDGET_TYPES.filter(widget => {
    if (searchTerm && !widget.title.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !widget.description.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'popular') return widget.popular;
    if (selectedCategory === 'recent') return recentWidgets.includes(widget.type);
    return widget.category === selectedCategory;
  });

  const handleAddWidget = (type: DashboardWidget['type']) => {
    onAddWidget(type);
    
    // Update recent widgets
    const newRecent = [type, ...recentWidgets.filter(t => t !== type)].slice(0, 5);
    setRecentWidgets(newRecent);
    localStorage.setItem('recent-widgets', JSON.stringify(newRecent));
  };

  const handleDragStart = (type: string, event: React.DragEvent) => {
    setDraggedType(type);
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', type);
  };

  const handleDragEnd = () => {
    setDraggedType(null);
  };

  return (
    <Card className="fixed top-20 right-6 w-96 max-h-[80vh] z-50 shadow-elegant border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Widget hinzufügen</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Widget suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>

      <CardContent className="overflow-y-auto max-h-[60vh]">
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="grid grid-cols-4 mb-4 h-auto">
            {CATEGORIES.slice(0, 4).map((category) => {
              const Icon = category.icon;
              return (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="flex flex-col gap-1 p-2 text-xs"
                >
                  <Icon className="h-3 w-3" />
                  {category.name}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="all" className="mt-0">
            <WidgetGrid
              widgets={filteredWidgets}
              onAddWidget={handleAddWidget}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              draggedType={draggedType}
            />
          </TabsContent>

          <TabsContent value="popular" className="mt-0">
            <WidgetGrid
              widgets={filteredWidgets}
              onAddWidget={handleAddWidget}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              draggedType={draggedType}
            />
          </TabsContent>

          <TabsContent value="recent" className="mt-0">
            <WidgetGrid
              widgets={filteredWidgets}
              onAddWidget={handleAddWidget}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              draggedType={draggedType}
            />
          </TabsContent>

          {CATEGORIES.slice(3).map((category) => (
            <TabsContent key={category.id} value={category.id} className="mt-0">
              <WidgetGrid
                widgets={filteredWidgets}
                onAddWidget={handleAddWidget}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                draggedType={draggedType}
              />
            </TabsContent>
          ))}
        </Tabs>

        {/* AI Suggestions */}
        {suggestions.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">KI-Vorschläge</span>
            </div>
            <div className="space-y-2">
              {suggestions.slice(0, 3).map((suggestion, index) => (
                <div
                  key={index}
                  className="p-3 bg-accent/50 rounded-lg border border-primary/10"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{suggestion.title}</p>
                      <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddWidget(suggestion.type)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface WidgetGridProps {
  widgets: typeof WIDGET_TYPES;
  onAddWidget: (type: DashboardWidget['type']) => void;
  onDragStart: (type: string, event: React.DragEvent) => void;
  onDragEnd: () => void;
  draggedType: string | null;
}

function WidgetGrid({ widgets, onAddWidget, onDragStart, onDragEnd, draggedType }: WidgetGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {widgets.map((widget) => {
        const Icon = widget.icon;
        return (
          <div
            key={widget.type}
            className={`
              group p-4 border rounded-lg cursor-pointer transition-all duration-200
              hover:border-primary/40 hover:bg-accent/30 hover:scale-[1.02]
              ${draggedType === widget.type ? 'opacity-50 scale-95' : ''}
              bg-card border-border
            `}
            draggable
            onDragStart={(e) => onDragStart(widget.type, e)}
            onDragEnd={onDragEnd}
            onClick={() => onAddWidget(widget.type)}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm text-foreground">{widget.title}</h3>
                  {widget.popular && (
                    <Badge variant="secondary" className="text-xs">
                      Beliebt
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {widget.description}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddWidget(widget.type);
                }}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}