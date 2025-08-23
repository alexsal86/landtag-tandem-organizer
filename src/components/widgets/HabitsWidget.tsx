import React, { useState, useEffect } from 'react';
import { Plus, Check, Flame, Calendar, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Habit {
  id: string;
  name: string;
  description?: string;
  color: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  target_count: number;
  category: string;
  is_active: boolean;
  created_at: string;
}

interface HabitCompletion {
  id: string;
  habit_id: string;
  completion_date: string;
  count: number;
  notes?: string;
}

interface HabitWithStats extends Habit {
  todayCount: number;
  currentStreak: number;
  completionRate: number;
  isCompletedToday: boolean;
}

interface HabitsWidgetProps {
  className?: string;
  configuration?: {
    showStreak?: boolean;
    compact?: boolean;
    theme?: string;
  };
}

export const HabitsWidget: React.FC<HabitsWidgetProps> = ({ 
  className, 
  configuration = {} 
}) => {
  const { user } = useAuth();
  const [habits, setHabits] = useState<HabitWithStats[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');

  const { showStreak = true, compact = false } = configuration;

  useEffect(() => {
    if (user) {
      loadHabits();
      loadCompletions();
    }
  }, [user]);

  const loadHabits = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Initialize habits with empty stats - will be calculated after loading completions
      const habitsWithStats: HabitWithStats[] = (data || []).map(habit => ({
        ...habit,
        frequency: habit.frequency as 'daily' | 'weekly' | 'monthly',
        todayCount: 0,
        currentStreak: 0,
        completionRate: 0,
        isCompletedToday: false
      }));
      
      setHabits(habitsWithStats);
    } catch (error) {
      console.error('Error loading habits:', error);
      toast.error('Fehler beim Laden der Gewohnheiten');
    } finally {
      setLoading(false);
    }
  };

  const loadCompletions = async () => {
    if (!user) return;

    try {
      // Load last 30 days of completions for streak calculation
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('habit_completions')
        .select('*')
        .eq('user_id', user.id)
        .gte('completion_date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('completion_date', { ascending: false });

      if (error) throw error;
      
      setCompletions(data || []);
      calculateHabitStats(data || []);
    } catch (error) {
      console.error('Error loading completions:', error);
    }
  };

  const calculateHabitStats = (completionData: HabitCompletion[]) => {
    const today = new Date().toISOString().split('T')[0];
    
    setHabits(prevHabits => prevHabits.map(habit => {
      const habitCompletions = completionData.filter(c => c.habit_id === habit.id);
      
      // Today's count
      const todayCompletion = habitCompletions.find(c => c.completion_date === today);
      const todayCount = todayCompletion?.count || 0;
      const isCompletedToday = todayCount >= habit.target_count;
      
      // Calculate streak
      let currentStreak = 0;
      const sortedCompletions = habitCompletions
        .sort((a, b) => new Date(b.completion_date).getTime() - new Date(a.completion_date).getTime());
      
      for (let i = 0; i < 30; i++) {
        const checkDate = new Date();
        checkDate.setDate(checkDate.getDate() - i);
        const dateStr = checkDate.toISOString().split('T')[0];
        
        const dayCompletion = sortedCompletions.find(c => c.completion_date === dateStr);
        if (dayCompletion && dayCompletion.count >= habit.target_count) {
          currentStreak++;
        } else {
          break;
        }
      }
      
      // Calculate completion rate (last 7 days)
      let completedDays = 0;
      for (let i = 0; i < 7; i++) {
        const checkDate = new Date();
        checkDate.setDate(checkDate.getDate() - i);
        const dateStr = checkDate.toISOString().split('T')[0];
        
        const dayCompletion = habitCompletions.find(c => c.completion_date === dateStr);
        if (dayCompletion && dayCompletion.count >= habit.target_count) {
          completedDays++;
        }
      }
      const completionRate = (completedDays / 7) * 100;
      
      return {
        ...habit,
        todayCount,
        currentStreak,
        completionRate,
        isCompletedToday
      };
    }));
  };

  const createHabit = async () => {
    if (!user || !newHabitName.trim()) return;

    try {
      const { data, error } = await supabase
        .from('habits')
        .insert({
          user_id: user.id,
          name: newHabitName.trim(),
          color: '#10b981',
          frequency: 'daily',
          target_count: 1,
          category: 'personal'
        })
        .select()
        .single();

      if (error) throw error;

      const newHabitWithStats: HabitWithStats = {
        ...data,
        frequency: data.frequency as 'daily' | 'weekly' | 'monthly',
        todayCount: 0,
        currentStreak: 0,
        completionRate: 0,
        isCompletedToday: false
      };

      setHabits(prev => [newHabitWithStats, ...prev]);
      setNewHabitName('');
      setShowAddForm(false);
      toast.success('Gewohnheit erstellt');
    } catch (error) {
      console.error('Error creating habit:', error);
      toast.error('Fehler beim Erstellen der Gewohnheit');
    }
  };

  const completeHabit = async (habitId: string) => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    try {
      const existingCompletion = completions.find(
        c => c.habit_id === habitId && c.completion_date === today
      );

      if (existingCompletion) {
        // Update existing completion
        const newCount = Math.min(existingCompletion.count + 1, habit.target_count);
        const { error } = await supabase
          .from('habit_completions')
          .update({ count: newCount })
          .eq('id', existingCompletion.id);

        if (error) throw error;

        setCompletions(prev => prev.map(c => 
          c.id === existingCompletion.id ? { ...c, count: newCount } : c
        ));
      } else {
        // Create new completion
        const { data, error } = await supabase
          .from('habit_completions')
          .insert({
            user_id: user.id,
            habit_id: habitId,
            completion_date: today,
            count: 1
          })
          .select()
          .single();

        if (error) throw error;

        setCompletions(prev => [data, ...prev]);
      }

      // Recalculate stats
      loadCompletions();
      
      if (habit.todayCount + 1 >= habit.target_count) {
        toast.success(`${habit.name} für heute abgeschlossen! 🎉`);
      } else {
        toast.success(`${habit.name} markiert (${habit.todayCount + 1}/${habit.target_count})`);
      }
    } catch (error) {
      console.error('Error completing habit:', error);
      toast.error('Fehler beim Markieren der Gewohnheit');
    }
  };

  const getHabitColor = (habit: HabitWithStats) => {
    if (habit.isCompletedToday) return 'text-green-500';
    if (habit.todayCount > 0) return 'text-amber-500';
    return 'text-muted-foreground';
  };

  if (loading) {
    return (
      <Card className={`h-full flex flex-col ${className}`}>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-sm text-muted-foreground">Laden...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Habit Tracker
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className="h-7 w-7 p-0"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 overflow-auto">
        {/* Add Form */}
        {showAddForm && (
          <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
            <input
              type="text"
              placeholder="Neue Gewohnheit..."
              value={newHabitName}
              onChange={(e) => setNewHabitName(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md bg-background"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  createHabit();
                }
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <Button onClick={createHabit} size="sm" disabled={!newHabitName.trim()}>
                Erstellen
              </Button>
              <Button onClick={() => setShowAddForm(false)} variant="ghost" size="sm">
                Abbrechen
              </Button>
            </div>
          </div>
        )}

        {/* Habits List */}
        {habits.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-4">
            Noch keine Gewohnheiten vorhanden
          </div>
        ) : (
          <div className="space-y-2">
            {habits.map(habit => (
              <div
                key={habit.id}
                className={`p-3 border rounded-lg transition-colors ${
                  habit.isCompletedToday 
                    ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' 
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-medium text-sm ${getHabitColor(habit)}`}>
                        {habit.name}
                      </h4>
                      {habit.isCompletedToday && (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    
                    {!compact && (
                      <div className="mt-2 space-y-2">
                        {/* Progress */}
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={(habit.todayCount / habit.target_count) * 100} 
                            className="flex-1 h-2"
                          />
                          <span className="text-xs text-muted-foreground">
                            {habit.todayCount}/{habit.target_count}
                          </span>
                        </div>
                        
                        {/* Stats */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {showStreak && (
                            <div className="flex items-center gap-1">
                              <Flame className="h-3 w-3 text-orange-500" />
                              <span>{habit.currentStreak} Tage</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{Math.round(habit.completionRate)}% (7T)</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <Button
                    variant={habit.isCompletedToday ? "default" : "outline"}
                    size="sm"
                    onClick={() => completeHabit(habit.id)}
                    disabled={habit.isCompletedToday}
                    className="ml-2"
                  >
                    {habit.isCompletedToday ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};