import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Settings, Coffee, BookOpen, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PomodoroSession {
  id: string;
  session_type: 'work' | 'short_break' | 'long_break';
  duration_minutes: number;
  started_at: string;
  completed_at?: string;
  is_completed: boolean;
  task_id?: string;
}

interface PomodoroWidgetProps {
  className?: string;
  configuration?: {
    notifications?: boolean;
    theme?: string;
    workDuration?: number;
    shortBreakDuration?: number;
    longBreakDuration?: number;
  };
}

export const PomodoroWidget: React.FC<PomodoroWidgetProps> = ({ 
  className, 
  configuration = {} 
}) => {
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes default
  const [sessionType, setSessionType] = useState<'work' | 'short_break' | 'long_break'>('work');
  const [currentSession, setCurrentSession] = useState<PomodoroSession | null>(null);
  const [todaySessions, setTodaySessions] = useState<PomodoroSession[]>([]);
  const [workSessionsCompleted, setWorkSessionsCompleted] = useState(0);
  
  const intervalRef = useRef<NodeJS.Timeout>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const {
    notifications = true,
    workDuration = 25,
    shortBreakDuration = 5,
    longBreakDuration = 15
  } = configuration;

  const getSessionDuration = (type: 'work' | 'short_break' | 'long_break') => {
    switch (type) {
      case 'work': return workDuration * 60;
      case 'short_break': return shortBreakDuration * 60;
      case 'long_break': return longBreakDuration * 60;
    }
  };

  useEffect(() => {
    if (user) {
      loadTodaySessions();
    }
  }, [user]);

  useEffect(() => {
    // Reset timer when session type changes
    setTimeLeft(getSessionDuration(sessionType));
    setIsRunning(false);
  }, [sessionType, workDuration, shortBreakDuration, longBreakDuration]);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleSessionComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, timeLeft]);

  const loadTodaySessions = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('pomodoro_sessions')
        .select('*')
        .eq('user_id', user.id)
        .gte('started_at', today)
        .order('started_at', { ascending: false });

      if (error) throw error;

      setTodaySessions((data || []) as PomodoroSession[]);
      const completedWorkSessions = data?.filter(s => 
        s.session_type === 'work' && s.is_completed
      ).length || 0;
      setWorkSessionsCompleted(completedWorkSessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const startSession = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('pomodoro_sessions')
        .insert({
          user_id: user.id,
          session_type: sessionType,
          duration_minutes: getSessionDuration(sessionType) / 60
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentSession(data as PomodoroSession);
      setIsRunning(true);
      
      if (notifications) {
        toast.success(`${getSessionTypeName(sessionType)} gestartet!`);
      }
    } catch (error) {
      console.error('Error starting session:', error);
      toast.error('Fehler beim Starten der Session');
    }
  };

  const pauseSession = () => {
    setIsRunning(false);
  };

  const resetSession = () => {
    setIsRunning(false);
    setTimeLeft(getSessionDuration(sessionType));
    setCurrentSession(null);
  };

  const handleSessionComplete = async () => {
    setIsRunning(false);
    
    if (currentSession) {
      try {
        const { error } = await supabase
          .from('pomodoro_sessions')
          .update({
            completed_at: new Date().toISOString(),
            is_completed: true
          })
          .eq('id', currentSession.id);

        if (error) throw error;

        if (sessionType === 'work') {
          setWorkSessionsCompleted(prev => prev + 1);
        }

        // Auto-switch to break after work session
        if (sessionType === 'work') {
          const nextType = (workSessionsCompleted + 1) % 4 === 0 ? 'long_break' : 'short_break';
          setSessionType(nextType);
        } else {
          setSessionType('work');
        }

        loadTodaySessions();

        if (notifications) {
          toast.success(`${getSessionTypeName(sessionType)} abgeschlossen!`);
          
          // Browser notification if permission granted
          if (Notification.permission === 'granted') {
            new Notification(`Pomodoro Timer`, {
              body: `${getSessionTypeName(sessionType)} abgeschlossen!`,
              icon: '/favicon.ico'
            });
          }
        }
        
        // Play completion sound
        if (audioRef.current) {
          audioRef.current.play().catch(console.error);
        }

      } catch (error) {
        console.error('Error completing session:', error);
      }
    }

    setCurrentSession(null);
  };

  const getSessionTypeName = (type: 'work' | 'short_break' | 'long_break') => {
    switch (type) {
      case 'work': return 'Arbeitszeit';
      case 'short_break': return 'Kurze Pause';
      case 'long_break': return 'Lange Pause';
    }
  };

  const getSessionTypeIcon = (type: 'work' | 'short_break' | 'long_break') => {
    switch (type) {
      case 'work': return <BookOpen className="h-4 w-4" />;
      case 'short_break': return <Coffee className="h-4 w-4" />;
      case 'long_break': return <Coffee className="h-4 w-4" />;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgress = () => {
    const totalTime = getSessionDuration(sessionType);
    return ((totalTime - timeLeft) / totalTime) * 100;
  };

  const getSessionTypeColor = (type: 'work' | 'short_break' | 'long_break') => {
    switch (type) {
      case 'work': return 'text-red-500';
      case 'short_break': return 'text-blue-500';
      case 'long_break': return 'text-green-500';
    }
  };

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <audio ref={audioRef} preload="auto">
        <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUYrTp66hVFApGn+DyvmUSBzuO0u7AciMFl" type="audio/wav" />
      </audio>

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            {getSessionTypeIcon(sessionType)}
            Pomodoro Timer
          </CardTitle>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">
              {workSessionsCompleted}/4
            </Badge>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <BarChart3 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-center items-center space-y-4">
        {/* Session Type Selector */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {(['work', 'short_break', 'long_break'] as const).map(type => (
            <Button
              key={type}
              variant={sessionType === type ? 'default' : 'ghost'}
              size="sm"
              onClick={() => !isRunning && setSessionType(type)}
              disabled={isRunning}
              className={`h-7 px-2 text-xs ${getSessionTypeColor(type)}`}
            >
              {getSessionTypeIcon(type)}
              <span className="ml-1 hidden sm:inline">
                {type === 'work' ? 'Arbeit' : 
                 type === 'short_break' ? 'Kurz' : 'Lang'}
              </span>
            </Button>
          ))}
        </div>

        {/* Timer Display */}
        <div className="text-center space-y-3">
          <div className={`text-4xl font-bold font-mono ${getSessionTypeColor(sessionType)}`}>
            {formatTime(timeLeft)}
          </div>
          
          <Progress 
            value={getProgress()} 
            className="w-48 h-2" 
          />
          
          <p className="text-sm text-muted-foreground">
            {getSessionTypeName(sessionType)}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {!isRunning ? (
            <Button
              onClick={currentSession ? () => setIsRunning(true) : startSession}
              size="sm"
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              {currentSession ? 'Fortsetzen' : 'Starten'}
            </Button>
          ) : (
            <Button
              onClick={pauseSession}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2"
            >
              <Pause className="h-4 w-4" />
              Pausieren
            </Button>
          )}
          
          <Button
            onClick={resetSession}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>

        {/* Today's Stats */}
        <div className="w-full pt-2 border-t">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Heute abgeschlossen:</span>
            <span>{todaySessions.filter(s => s.is_completed).length} Sessions</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Arbeitszeiten:</span>
            <span>{workSessionsCompleted} Sessions</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};