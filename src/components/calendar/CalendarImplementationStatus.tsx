import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  Circle, 
  AlertCircle, 
  Calendar, 
  MousePointer, 
  Smartphone, 
  Zap,
  Database,
  Palette,
  Users
} from 'lucide-react';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

interface FeatureStatus {
  name: string;
  status: 'complete' | 'partial' | 'missing';
  description: string;
  icon: React.ReactNode;
}

const CALENDAR_FEATURES: FeatureStatus[] = [
  {
    name: 'Basic Calendar Views',
    status: 'complete',
    description: 'Day, Week, Month views with smooth transitions',
    icon: <Calendar className="w-4 h-4" />
  },
  {
    name: 'Drag & Drop Events',
    status: 'complete',
    description: 'Move events between time slots with visual feedback',
    icon: <MousePointer className="w-4 h-4" />
  },
  {
    name: 'Event Layout Engine',
    status: 'complete',
    description: 'Smart positioning and conflict detection',
    icon: <Zap className="w-4 h-4" />
  },
  {
    name: 'Database Integration',
    status: 'partial',
    description: 'Drag events update UI, but need backend persistence',
    icon: <Database className="w-4 h-4" />
  },
  {
    name: 'Custom Styling',
    status: 'complete',
    description: 'Fully integrated with design system tokens',
    icon: <Palette className="w-4 h-4" />
  },
  {
    name: 'Responsive Design',
    status: 'complete',
    description: 'Mobile-optimized layouts and touch support',
    icon: <Smartphone className="w-4 h-4" />
  },
  {
    name: 'Event Resizing',
    status: 'missing',
    description: 'Resize events by dragging handles',
    icon: <AlertCircle className="w-4 h-4" />
  },
  {
    name: 'Multi-user Support',
    status: 'complete',
    description: 'User-specific calendars and permissions',
    icon: <Users className="w-4 h-4" />
  }
];

export function CalendarImplementationStatus() {
  const { flags, toggleFlag } = useFeatureFlag();
  
  const completedFeatures = CALENDAR_FEATURES.filter(f => f.status === 'complete').length;
  const totalFeatures = CALENDAR_FEATURES.length;
  const completionPercentage = Math.round((completedFeatures / totalFeatures) * 100);

  const getStatusIcon = (status: FeatureStatus['status']) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="w-4 h-4 text-palette-green" />;
      case 'partial':
        return <AlertCircle className="w-4 h-4 text-palette-yellow" />;
      case 'missing':
        return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: FeatureStatus['status']) => {
    switch (status) {
      case 'complete':
        return <Badge variant="secondary" className="bg-palette-green/20 text-palette-green">Complete</Badge>;
      case 'partial':
        return <Badge variant="secondary" className="bg-palette-yellow/20 text-palette-yellow">Partial</Badge>;
      case 'missing':
        return <Badge variant="outline">Missing</Badge>;
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Enhanced Calendar Implementation
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {completionPercentage}% Complete
          </Badge>
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Current implementation status compared to React Big Calendar features
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className="bg-primary rounded-full h-2 transition-all duration-300"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>

        {/* Feature List */}
        <div className="space-y-3">
          {CALENDAR_FEATURES.map((feature, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-2">
                  {getStatusIcon(feature.status)}
                  {feature.icon}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{feature.name}</div>
                  <div className="text-xs text-muted-foreground">{feature.description}</div>
                </div>
              </div>
              {getStatusBadge(feature.status)}
            </div>
          ))}
        </div>

        {/* Action Section */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">Enhanced Calendar Mode</div>
              <div className="text-xs text-muted-foreground">
                {flags.useReactBigCalendar 
                  ? '✅ Using enhanced calendar with drag & drop' 
                  : '⚪ Using standard calendar views'
                }
              </div>
            </div>
            <Button
              variant={flags.useReactBigCalendar ? "default" : "outline"}
              size="sm"
              onClick={() => toggleFlag('useReactBigCalendar')}
            >
              {flags.useReactBigCalendar ? 'Disable' : 'Enable'} Enhanced Mode
            </Button>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="font-medium text-sm mb-2">🎯 Next Implementation Steps:</div>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Add database persistence for drag & drop operations</li>
            <li>• Implement event resizing with database updates</li>
            <li>• Add React Big Calendar package (if needed)</li>
            <li>• Enhance touch/mobile drag experience</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}