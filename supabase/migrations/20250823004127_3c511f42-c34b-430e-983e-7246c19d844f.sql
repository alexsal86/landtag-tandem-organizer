-- Create quick_notes table for Quick Notes Widget
CREATE TABLE public.quick_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  color TEXT DEFAULT '#3b82f6',
  is_pinned BOOLEAN DEFAULT false,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for quick_notes
ALTER TABLE public.quick_notes ENABLE ROW LEVEL SECURITY;

-- Create policies for quick_notes
CREATE POLICY "Users can manage their own quick notes"
ON public.quick_notes
FOR ALL
USING (auth.uid() = user_id);

-- Create habits table for Habit Tracker
CREATE TABLE public.habits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#10b981',
  frequency TEXT DEFAULT 'daily', -- daily, weekly, monthly
  target_count INTEGER DEFAULT 1,
  category TEXT DEFAULT 'personal',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for habits
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

-- Create policies for habits
CREATE POLICY "Users can manage their own habits"
ON public.habits
FOR ALL
USING (auth.uid() = user_id);

-- Create habit_completions table
CREATE TABLE public.habit_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  habit_id UUID NOT NULL,
  user_id UUID NOT NULL,
  completion_date DATE NOT NULL,
  count INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for habit_completions
ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;

-- Create policies for habit_completions
CREATE POLICY "Users can manage their own habit completions"
ON public.habit_completions
FOR ALL
USING (auth.uid() = user_id);

-- Create call_logs table for Call Log and Follow-up System
CREATE TABLE public.call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_id UUID,
  call_type TEXT DEFAULT 'outgoing', -- outgoing, incoming, missed
  duration_minutes INTEGER,
  call_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_date TIMESTAMP WITH TIME ZONE,
  follow_up_completed BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for call_logs
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for call_logs
CREATE POLICY "Users can manage their own call logs"
ON public.call_logs
FOR ALL
USING (auth.uid() = user_id);

-- Create pomodoro_sessions table for Pomodoro Timer Widget
CREATE TABLE public.pomodoro_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  task_id UUID,
  session_type TEXT DEFAULT 'work', -- work, short_break, long_break
  duration_minutes INTEGER NOT NULL DEFAULT 25,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  is_completed BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for pomodoro_sessions
ALTER TABLE public.pomodoro_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for pomodoro_sessions
CREATE POLICY "Users can manage their own pomodoro sessions"
ON public.pomodoro_sessions
FOR ALL
USING (auth.uid() = user_id);

-- Create team_dashboards table for Team-Dashboard Functionality
CREATE TABLE public.team_dashboards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL,
  layout_data JSONB NOT NULL DEFAULT '[]',
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for team_dashboards
ALTER TABLE public.team_dashboards ENABLE ROW LEVEL SECURITY;

-- Create team_dashboard_members table
CREATE TABLE public.team_dashboard_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_dashboard_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'viewer', -- viewer, editor, admin
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for team_dashboard_members
ALTER TABLE public.team_dashboard_members ENABLE ROW LEVEL SECURITY;

-- Create policies for team_dashboards
CREATE POLICY "Users can view dashboards they have access to"
ON public.team_dashboards
FOR SELECT
USING (
  owner_id = auth.uid() OR 
  is_public = true OR 
  EXISTS (
    SELECT 1 FROM team_dashboard_members 
    WHERE team_dashboard_id = team_dashboards.id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage their own dashboards"
ON public.team_dashboards
FOR ALL
USING (owner_id = auth.uid());

-- Create policies for team_dashboard_members
CREATE POLICY "Dashboard owners and members can view members"
ON public.team_dashboard_members
FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM team_dashboards 
    WHERE id = team_dashboard_members.team_dashboard_id 
    AND owner_id = auth.uid()
  )
);

CREATE POLICY "Dashboard owners can manage members"
ON public.team_dashboard_members
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM team_dashboards 
    WHERE id = team_dashboard_members.team_dashboard_id 
    AND owner_id = auth.uid()
  )
);

-- Add widget_configurations table for individual widget settings
CREATE TABLE public.widget_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  widget_id TEXT NOT NULL,
  widget_type TEXT NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, widget_id)
);

-- Enable RLS for widget_configurations
ALTER TABLE public.widget_configurations ENABLE ROW LEVEL SECURITY;

-- Create policies for widget_configurations
CREATE POLICY "Users can manage their own widget configurations"
ON public.widget_configurations
FOR ALL
USING (auth.uid() = user_id);

-- Create triggers for updated_at columns
CREATE TRIGGER update_quick_notes_updated_at
BEFORE UPDATE ON public.quick_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_habits_updated_at
BEFORE UPDATE ON public.habits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_call_logs_updated_at
BEFORE UPDATE ON public.call_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_dashboards_updated_at
BEFORE UPDATE ON public.team_dashboards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_widget_configurations_updated_at
BEFORE UPDATE ON public.widget_configurations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();