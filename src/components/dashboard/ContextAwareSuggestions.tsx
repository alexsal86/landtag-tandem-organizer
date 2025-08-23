import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Lightbulb, 
  Clock, 
  Calendar, 
  BarChart3, 
  MessageSquare,
  Target,
  X,
  ChevronRight
} from 'lucide-react';
import { DashboardLayout, DashboardWidget } from '@/hooks/useDashboardLayout';
import { toast } from 'sonner';

interface Suggestion {
  id: string;
  type: 'widget' | 'layout' | 'optimization' | 'workflow';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  action: string;
  icon: React.ComponentType<any>;
  reason: string;
  timeContext?: string;
  widgetType?: DashboardWidget['type'];
  confidence: number;
}

interface ContextAwareSuggestionsProps {
  currentLayout: DashboardLayout;
  onSuggestionApply: (suggestion: Suggestion) => void;
  onSuggestionsUpdate: (suggestions: Suggestion[]) => void;
}

export function ContextAwareSuggestions({ 
  currentLayout, 
  onSuggestionApply, 
  onSuggestionsUpdate 
}: ContextAwareSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>([]);

  useEffect(() => {
    generateContextAwareSuggestions();
  }, [currentLayout]);

  useEffect(() => {
    onSuggestionsUpdate(suggestions);
  }, [suggestions, onSuggestionsUpdate]);

  const generateContextAwareSuggestions = () => {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const newSuggestions: Suggestion[] = [];

    // Time-based suggestions
    if (hour >= 9 && hour <= 17) {
      // Work hours
      if (!hasWidgetType('tasks')) {
        newSuggestions.push({
          id: 'work-tasks',
          type: 'widget',
          priority: 'high',
          title: 'Add Task Widget',
          description: 'Stay organized with your daily tasks',
          action: 'Add Tasks Widget',
          icon: Target,
          reason: 'Work hours detected - task management recommended',
          timeContext: 'Work Hours',
          widgetType: 'tasks',
          confidence: 85
        });
      }

      if (!hasWidgetType('pomodoro')) {
        newSuggestions.push({
          id: 'work-pomodoro',
          type: 'widget',
          priority: 'medium',
          title: 'Add Pomodoro Timer',
          description: 'Boost productivity with focused work sessions',
          action: 'Add Pomodoro Widget',
          icon: Clock,
          reason: 'Focus technique for work hours',
          timeContext: 'Work Hours',
          widgetType: 'pomodoro',
          confidence: 70
        });
      }
    }

    if (hour >= 6 && hour <= 10) {
      // Morning hours
      if (!hasWidgetType('habits')) {
        newSuggestions.push({
          id: 'morning-habits',
          type: 'widget',
          priority: 'medium',
          title: 'Add Habit Tracker',
          description: 'Start your day by tracking good habits',
          action: 'Add Habits Widget',
          icon: Target,
          reason: 'Morning routine optimization',
          timeContext: 'Morning',
          widgetType: 'habits',
          confidence: 75
        });
      }

      if (!hasWidgetType('schedule')) {
        newSuggestions.push({
          id: 'morning-schedule',
          type: 'widget',
          priority: 'high',
          title: 'Add Schedule Widget',
          description: 'Plan your day with today\'s appointments',
          action: 'Add Schedule Widget',
          icon: Calendar,
          reason: 'Morning planning essential',
          timeContext: 'Morning',
          widgetType: 'schedule',
          confidence: 90
        });
      }
    }

    // Day-of-week suggestions
    if (dayOfWeek === 1) { // Monday
      newSuggestions.push({
        id: 'monday-stats',
        type: 'widget',
        priority: 'medium',
        title: 'Weekly Stats Review',
        description: 'Review last week\'s performance metrics',
        action: 'Add Stats Widget',
        icon: BarChart3,
        reason: 'Monday review recommended',
        timeContext: 'Weekly Planning',
        widgetType: 'stats',
        confidence: 65
      });
    }

    // Usage pattern suggestions
    const widgetCount = currentLayout.widgets.length;
    if (widgetCount < 4) {
      newSuggestions.push({
        id: 'more-widgets',
        type: 'workflow',
        priority: 'low',
        title: 'Add More Widgets',
        description: 'Maximize your dashboard\'s potential',
        action: 'Browse Widget Library',
        icon: Lightbulb,
        reason: 'Dashboard underutilized',
        confidence: 60
      });
    } else if (widgetCount > 10) {
      newSuggestions.push({
        id: 'simplify-dashboard',
        type: 'optimization',
        priority: 'medium',
        title: 'Simplify Dashboard',
        description: 'Too many widgets can reduce focus',
        action: 'Optimize Layout',
        icon: Target,
        reason: 'Complexity reduction needed',
        confidence: 80
      });
    }

    // Communication suggestions
    if (!hasWidgetType('messages') && hasWidgetType('schedule')) {
      newSuggestions.push({
        id: 'add-messages',
        type: 'widget',
        priority: 'medium',
        title: 'Add Messages Widget',
        description: 'Stay connected with your communications',
        action: 'Add Messages Widget',
        icon: MessageSquare,
        reason: 'Complement your schedule with communications',
        widgetType: 'messages',
        confidence: 70
      });
    }

    // Layout optimization suggestions
    const hasLargeWidgets = currentLayout.widgets.some(w => 
      ['3x3', '4x2', '2x4'].includes(w.widgetSize)
    );
    if (!hasLargeWidgets && widgetCount > 6) {
      newSuggestions.push({
        id: 'optimize-layout',
        type: 'layout',
        priority: 'low',
        title: 'Optimize Widget Sizes',
        description: 'Use larger widgets for better visual hierarchy',
        action: 'Auto-Optimize Layout',
        icon: BarChart3,
        reason: 'Visual balance improvement',
        confidence: 65
      });
    }

    // Filter out dismissed suggestions
    const filteredSuggestions = newSuggestions.filter(s => 
      !dismissedSuggestions.includes(s.id)
    );

    // Sort by priority and confidence
    filteredSuggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });

    setSuggestions(filteredSuggestions.slice(0, 5)); // Limit to 5 suggestions
    
    if (filteredSuggestions.length > 0 && !showSuggestions) {
      // Auto-show suggestions if there are high-priority ones
      const hasHighPriority = filteredSuggestions.some(s => s.priority === 'high');
      if (hasHighPriority) {
        setTimeout(() => setShowSuggestions(true), 3000);
      }
    }
  };

  const hasWidgetType = (type: DashboardWidget['type']): boolean => {
    return currentLayout.widgets.some(w => w.type === type);
  };

  const applySuggestion = (suggestion: Suggestion) => {
    onSuggestionApply(suggestion);
    dismissSuggestion(suggestion.id);
    toast.success(`Applied: ${suggestion.title}`);
  };

  const dismissSuggestion = (suggestionId: string) => {
    setDismissedSuggestions(prev => [...prev, suggestionId]);
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  };

  const getPriorityColor = (priority: Suggestion['priority']) => {
    switch (priority) {
      case 'high': return 'border-red-200 bg-red-50 text-red-800';
      case 'medium': return 'border-yellow-200 bg-yellow-50 text-yellow-800';
      case 'low': return 'border-blue-200 bg-blue-50 text-blue-800';
      default: return 'border-gray-200 bg-gray-50 text-gray-800';
    }
  };

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <>
      {/* Suggestion Trigger Button */}
      {!showSuggestions && suggestions.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSuggestions(true)}
          className="fixed bottom-32 right-6 z-40 bg-background/95 backdrop-blur border-primary/20"
        >
          <Lightbulb className="h-4 w-4 mr-2" />
          Smart Tips
          <Badge variant="secondary" className="ml-2">
            {suggestions.length}
          </Badge>
        </Button>
      )}

      {/* Suggestions Panel */}
      {showSuggestions && (
        <Card className="fixed bottom-20 right-6 w-80 max-h-[60vh] z-50 shadow-elegant border-primary/20 bg-background/95 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Smart Suggestions</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSuggestions(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {suggestions.map((suggestion) => {
                const Icon = suggestion.icon;
                return (
                  <div
                    key={suggestion.id}
                    className="p-3 border rounded-lg hover:border-primary/40 transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="p-1 bg-primary/10 rounded">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm">{suggestion.title}</h4>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${getPriorityColor(suggestion.priority)}`}
                            >
                              {suggestion.priority}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {suggestion.description}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{suggestion.reason}</span>
                            {suggestion.timeContext && (
                              <>
                                <span>•</span>
                                <span>{suggestion.timeContext}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => dismissSuggestion(suggestion.id)}
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-muted-foreground">
                          {suggestion.confidence}% confidence
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => applySuggestion(suggestion)}
                        className="h-7 text-xs"
                      >
                        {suggestion.action}
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {suggestions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No suggestions right now</p>
                <p className="text-xs">Check back later for personalized tips</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}