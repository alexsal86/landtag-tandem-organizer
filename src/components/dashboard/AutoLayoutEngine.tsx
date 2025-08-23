import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  Layout, 
  BarChart3, 
  Monitor,
  Smartphone,
  Tablet,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { DashboardLayout, DashboardWidget } from '@/hooks/useDashboardLayout';
import { toast } from 'sonner';

interface AutoLayoutEngineProps {
  currentLayout: DashboardLayout;
  onLayoutOptimized: (layout: DashboardLayout) => void;
}

interface LayoutSuggestion {
  id: string;
  name: string;
  description: string;
  layout: DashboardLayout;
  score: number;
  type: 'efficiency' | 'visual' | 'usage' | 'responsive';
}

const DEVICE_PRESETS = [
  { id: 'desktop', name: 'Desktop', icon: Monitor, cols: 6 },
  { id: 'tablet', name: 'Tablet', icon: Tablet, cols: 4 },
  { id: 'mobile', name: 'Mobile', icon: Smartphone, cols: 2 }
];

export function AutoLayoutEngine({ currentLayout, onLayoutOptimized }: AutoLayoutEngineProps) {
  const [suggestions, setSuggestions] = useState<LayoutSuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState('desktop');

  useEffect(() => {
    const timer = setTimeout(() => {
      generateSuggestions();
    }, 2000);

    return () => clearTimeout(timer);
  }, [currentLayout]);

  const generateSuggestions = async () => {
    setIsAnalyzing(true);
    
    // Simulate AI analysis
    await new Promise(resolve => setTimeout(resolve, 1500));

    const newSuggestions: LayoutSuggestion[] = [
      {
        id: 'efficiency',
        name: 'Effizienz-optimiert',
        description: 'Häufig verwendete Widgets im Fokus',
        layout: optimizeForEfficiency(currentLayout),
        score: 8.5,
        type: 'efficiency'
      },
      {
        id: 'visual',
        name: 'Visuell balanciert',
        description: 'Gleichmäßige Verteilung und Symmetrie',
        layout: optimizeForVisual(currentLayout),
        score: 7.8,
        type: 'visual'
      },
      {
        id: 'usage',
        name: 'Nutzungsbasiert',
        description: 'Basierend auf Ihren Gewohnheiten',
        layout: optimizeForUsage(currentLayout),
        score: 9.2,
        type: 'usage'
      },
      {
        id: 'responsive',
        name: 'Responsive',
        description: 'Optimiert für alle Bildschirmgrößen',
        layout: optimizeForResponsive(currentLayout),
        score: 8.1,
        type: 'responsive'
      }
    ];

    setSuggestions(newSuggestions);
    setIsAnalyzing(false);
    
    if (newSuggestions.some(s => s.score > 8.5)) {
      setShowSuggestions(true);
    }
  };

  const optimizeForEfficiency = (layout: DashboardLayout): DashboardLayout => {
    // High-priority widgets go to top-left
    const priorityOrder = ['stats', 'tasks', 'messages', 'schedule', 'quicknotes'];
    const sortedWidgets = [...layout.widgets].sort((a, b) => {
      const aPriority = priorityOrder.indexOf(a.type);
      const bPriority = priorityOrder.indexOf(b.type);
      return (aPriority === -1 ? 999 : aPriority) - (bPriority === -1 ? 999 : bPriority);
    });

    // Arrange in grid pattern
    const optimizedWidgets = sortedWidgets.map((widget, index) => {
      const row = Math.floor(index / 3);
      const col = index % 3;
      return {
        ...widget,
        position: { x: col * 2, y: row * 2 }
      };
    });

    return { ...layout, widgets: optimizedWidgets };
  };

  const optimizeForVisual = (layout: DashboardLayout): DashboardLayout => {
    // Create symmetric layout
    const widgets = [...layout.widgets];
    const center = widgets.length / 2;
    
    const optimizedWidgets = widgets.map((widget, index) => {
      const isLeft = index < center;
      const pairIndex = isLeft ? index : widgets.length - 1 - index;
      const row = Math.floor(pairIndex / 2);
      const col = isLeft ? 0 : 4;
      
      return {
        ...widget,
        position: { x: col, y: row * 2 },
        widgetSize: balanceSize(widget.widgetSize, isLeft)
      };
    });

    return { ...layout, widgets: optimizedWidgets };
  };

  const optimizeForUsage = (layout: DashboardLayout): DashboardLayout => {
    // Mock usage data - in real app, this would come from analytics
    const usageData = {
      'quicknotes': 95,
      'tasks': 87,
      'pomodoro': 76,
      'stats': 65,
      'messages': 54,
      'schedule': 43
    };

    const sortedWidgets = [...layout.widgets].sort((a, b) => {
      const aUsage = usageData[a.type as keyof typeof usageData] || 0;
      const bUsage = usageData[b.type as keyof typeof usageData] || 0;
      return bUsage - aUsage;
    });

    // Place most used widgets in prime real estate
    const optimizedWidgets = sortedWidgets.map((widget, index) => {
      if (index === 0) {
        // Most used: top-left, larger size
        return { ...widget, position: { x: 0, y: 0 }, widgetSize: '2x2' as const };
      } else if (index === 1) {
        // Second most: top-right
        return { ...widget, position: { x: 2, y: 0 }, widgetSize: '2x1' as const };
      } else {
        // Rest: fill remaining space
        const row = Math.floor((index - 2) / 2) + 1;
        const col = ((index - 2) % 2) * 2;
        return { ...widget, position: { x: col, y: row * 2 } };
      }
    });

    return { ...layout, widgets: optimizedWidgets };
  };

  const optimizeForResponsive = (layout: DashboardLayout): DashboardLayout => {
    // Create mobile-first layout that scales well
    const optimizedWidgets = layout.widgets.map((widget, index) => {
      // Stack vertically for mobile, arrange in grid for desktop
      return {
        ...widget,
        position: { x: 0, y: index * 2 },
        widgetSize: getResponsiveSize(widget.type)
      };
    });

    return { ...layout, widgets: optimizedWidgets };
  };

  const balanceSize = (currentSize: string, isLeft: boolean): any => {
    // Balance sizes for visual symmetry
    const sizeMap: Record<string, string> = {
      '1x1': '1x1',
      '2x1': isLeft ? '2x1' : '2x1',
      '2x2': '2x2',
      '3x1': '2x1',
      '3x2': '2x2'
    };
    return sizeMap[currentSize] || currentSize;
  };

  const getResponsiveSize = (widgetType: string): any => {
    const responsiveSizes: Record<string, string> = {
      'stats': '2x1',
      'tasks': '2x2',
      'quicknotes': '2x2',
      'messages': '2x1',
      'pomodoro': '1x1',
      'habits': '2x1'
    };
    return responsiveSizes[widgetType] || '2x1';
  };

  const applySuggestion = (suggestion: LayoutSuggestion) => {
    onLayoutOptimized(suggestion.layout);
    setShowSuggestions(false);
    toast.success(`Layout "${suggestion.name}" angewendet`);
  };

  const getTypeIcon = (type: LayoutSuggestion['type']) => {
    const icons = {
      efficiency: Sparkles,
      visual: Layout,
      usage: BarChart3,
      responsive: Monitor
    };
    return icons[type];
  };

  return (
    <>
      {/* Auto Layout Trigger */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowSuggestions(true)}
        className="fixed top-20 left-6 z-40 bg-background/95 backdrop-blur border-primary/20"
      >
        <Sparkles className="h-4 w-4 mr-2" />
        Auto-Layout
        {suggestions.length > 0 && (
          <Badge variant="secondary" className="ml-2">
            {suggestions.length}
          </Badge>
        )}
      </Button>

      {/* Suggestions Panel */}
      {showSuggestions && (
        <Card className="fixed top-16 left-6 w-80 max-h-[70vh] z-50 shadow-elegant border-primary/20 bg-background/95 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Layout-Vorschläge</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSuggestions(false)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>

            {isAnalyzing ? (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Layout wird analysiert...</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {suggestions.map((suggestion) => {
                  const Icon = getTypeIcon(suggestion.type);
                  return (
                    <div
                      key={suggestion.id}
                      className="p-3 border rounded-lg hover:border-primary/40 hover:bg-accent/30 transition-all cursor-pointer group"
                      onClick={() => applySuggestion(suggestion)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="p-1 bg-primary/10 rounded">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-sm">{suggestion.name}</h4>
                              <Badge 
                                variant="outline" 
                                className="text-xs"
                              >
                                {suggestion.score.toFixed(1)}★
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {suggestion.description}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Preview dots */}
                      <div className="mt-2 grid grid-cols-6 gap-1 opacity-50 group-hover:opacity-70 transition-opacity">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-1 bg-primary/30 rounded-full"
                            style={{
                              opacity: Math.random() > 0.5 ? 1 : 0.3
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Device Presets */}
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">Geräte-Optimierung:</p>
              <div className="flex gap-1">
                {DEVICE_PRESETS.map((device) => {
                  const Icon = device.icon;
                  return (
                    <Button
                      key={device.id}
                      variant={selectedDevice === device.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedDevice(device.id)}
                      className="flex-1 h-8"
                    >
                      <Icon className="h-3 w-3" />
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}