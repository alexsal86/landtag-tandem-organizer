import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Undo2, Redo2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '@/hooks/useDashboardLayout';

interface UndoRedoAction {
  id: string;
  type: 'widget_move' | 'widget_resize' | 'widget_add' | 'widget_remove' | 'widget_config';
  timestamp: number;
  layout: DashboardLayout;
  description: string;
}

export function UndoRedoSystem() {
  const [history, setHistory] = useState<UndoRedoAction[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isVisible, setIsVisible] = useState(false);

  // Auto-hide after no activity
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => setIsVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, currentIndex]);

  // Show/hide based on keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey)) {
        if (event.key === 'z' && !event.shiftKey) {
          event.preventDefault();
          handleUndo();
          setIsVisible(true);
        } else if ((event.key === 'z' && event.shiftKey) || event.key === 'y') {
          event.preventDefault();
          handleRedo();
          setIsVisible(true);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, history]);

  const addAction = (action: Omit<UndoRedoAction, 'id' | 'timestamp'>) => {
    const newAction: UndoRedoAction = {
      ...action,
      id: Date.now().toString(),
      timestamp: Date.now()
    };

    // Remove any actions after current index (when adding new action after undo)
    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push(newAction);

    // Limit history to 50 actions
    if (newHistory.length > 50) {
      newHistory.shift();
    }

    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
    setIsVisible(true);
  };

  const handleUndo = () => {
    if (currentIndex > 0) {
      const previousAction = history[currentIndex - 1];
      setCurrentIndex(currentIndex - 1);
      
      // Apply the layout from the previous action
      applyLayout(previousAction.layout);
      
      toast.success(`Rückgängig: ${previousAction.description}`);
    } else {
      toast.error('Keine Aktionen zum Rückgängigmachen');
    }
  };

  const handleRedo = () => {
    if (currentIndex < history.length - 1) {
      const nextAction = history[currentIndex + 1];
      setCurrentIndex(currentIndex + 1);
      
      // Apply the layout from the next action
      applyLayout(nextAction.layout);
      
      toast.success(`Wiederherstellen: ${nextAction.description}`);
    } else {
      toast.error('Keine Aktionen zum Wiederherstellen');
    }
  };

  const applyLayout = (layout: DashboardLayout) => {
    // This would typically call a function from the dashboard hook
    // For now, just log the action
    console.log('Applying layout:', layout);
  };

  const handleReset = () => {
    setHistory([]);
    setCurrentIndex(-1);
    setIsVisible(false);
    toast.success('Verlauf zurückgesetzt');
  };

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  if (!isVisible && history.length === 0) {
    return null;
  }

  return (
    <Card 
      className={`
        fixed bottom-6 left-6 z-50 transition-all duration-300
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}
        bg-background/95 backdrop-blur border-primary/20 shadow-elegant
      `}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            disabled={!canUndo}
            className="h-8 w-8 p-0"
            title="Rückgängig (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRedo}
            disabled={!canRedo}
            className="h-8 w-8 p-0"
            title="Wiederherstellen (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>

          <div className="h-4 w-px bg-border mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-8 w-8 p-0"
            title="Verlauf zurücksetzen"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          <div className="text-xs text-muted-foreground ml-2">
            {history.length > 0 ? `${currentIndex + 1}/${history.length}` : '0/0'}
          </div>
        </div>

        {history.length > 0 && (
          <div className="mt-2 text-xs text-muted-foreground max-w-48 truncate">
            {currentIndex >= 0 ? history[currentIndex].description : 'Startpunkt'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Custom hook for using the undo/redo system
export function useUndoRedo() {
  const [undoRedoRef, setUndoRedoRef] = useState<{
    addAction: (action: Omit<UndoRedoAction, 'id' | 'timestamp'>) => void;
  } | null>(null);

  const addAction = (
    type: UndoRedoAction['type'],
    layout: DashboardLayout,
    description: string
  ) => {
    if (undoRedoRef) {
      undoRedoRef.addAction({ type, layout, description });
    }
  };

  return {
    addAction,
    setUndoRedoRef
  };
}