-- Behavioral observations table - tracks what the system sees and infers
CREATE TABLE public.behavioral_observations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  observed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- What was observed
  room TEXT,
  activity_detected TEXT, -- e.g., 'sitting', 'moving', 'idle', 'working', 'eating'
  activity_confidence NUMERIC(3,2), -- 0.00 to 1.00
  
  -- Visual context
  camera_id UUID REFERENCES public.cameras(id) ON DELETE SET NULL,
  snapshot_description TEXT, -- AI description of what's in the frame
  objects_detected TEXT[], -- Array of detected objects
  
  -- Sensor context
  sensor_data JSONB,
  
  -- AI reasoning
  ai_interpretation TEXT, -- What the AI thinks is happening
  anomaly_score NUMERIC(3,2), -- 0.00 = normal, 1.00 = very unusual
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.behavioral_observations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own observations" 
  ON public.behavioral_observations FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own observations" 
  ON public.behavioral_observations FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Index for time-based queries
CREATE INDEX idx_observations_user_time ON public.behavioral_observations(user_id, observed_at DESC);

-- Interventions table - what the system said and why
CREATE TABLE public.interventions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- What triggered this intervention
  trigger_type TEXT NOT NULL, -- 'idle_detection', 'task_incomplete', 'pattern_deviation', 'goal_reminder', 'routine_enforcement'
  trigger_reason TEXT NOT NULL, -- Human readable reason
  
  -- The intervention itself
  message TEXT NOT NULL, -- What was said
  severity TEXT NOT NULL DEFAULT 'info', -- 'info', 'nudge', 'warning', 'urgent'
  
  -- Context at time of intervention
  room TEXT,
  related_goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  observation_id UUID REFERENCES public.behavioral_observations(id) ON DELETE SET NULL,
  context_snapshot JSONB, -- Full context at time of intervention
  
  -- Outcome tracking
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  action_taken TEXT,
  effectiveness_score NUMERIC(3,2), -- Did the user act on it? 0.00 to 1.00
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.interventions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own interventions" 
  ON public.interventions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interventions" 
  ON public.interventions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interventions" 
  ON public.interventions FOR UPDATE 
  USING (auth.uid() = user_id);

-- Index for recent interventions
CREATE INDEX idx_interventions_user_time ON public.interventions(user_id, triggered_at DESC);

-- Behavioral patterns table - learned routines and deviations
CREATE TABLE public.behavioral_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Pattern definition
  pattern_type TEXT NOT NULL, -- 'routine', 'habit', 'preference', 'avoidance'
  pattern_name TEXT NOT NULL,
  description TEXT,
  
  -- When this pattern applies
  time_of_day TEXT[], -- e.g., ['morning', 'evening']
  days_of_week INTEGER[], -- 0-6, Sunday = 0
  room TEXT,
  
  -- Pattern data
  expected_behavior TEXT,
  typical_duration_minutes INTEGER,
  frequency_per_week INTEGER,
  
  -- Tracking
  last_observed_at TIMESTAMP WITH TIME ZONE,
  times_observed INTEGER DEFAULT 0,
  confidence NUMERIC(3,2) DEFAULT 0.5, -- How confident we are this is a real pattern
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.behavioral_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own patterns" 
  ON public.behavioral_patterns FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own patterns" 
  ON public.behavioral_patterns FOR ALL 
  USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_patterns_user ON public.behavioral_patterns(user_id, is_active);

-- Tasks table - active tasks and responsibilities
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Task definition
  title TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'chore', 'work', 'health', 'errand', 'other'
  
  -- State
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'blocked', 'completed', 'skipped'
  priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  
  -- Timing
  due_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  estimated_minutes INTEGER,
  
  -- Location context
  room TEXT, -- Where this task should be done
  requires_location BOOLEAN DEFAULT false,
  
  -- Recurrence
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT, -- iCal RRULE format
  
  -- Tracking
  times_reminded INTEGER DEFAULT 0,
  last_reminded_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own tasks" 
  ON public.tasks FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own tasks" 
  ON public.tasks FOR ALL 
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_tasks_user_status ON public.tasks(user_id, status);
CREATE INDEX idx_tasks_user_due ON public.tasks(user_id, due_at);

-- User context table - current state tracking
CREATE TABLE public.user_context (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  
  -- Current location
  current_room TEXT,
  room_entered_at TIMESTAMP WITH TIME ZONE,
  
  -- Current activity
  current_activity TEXT,
  activity_started_at TIMESTAMP WITH TIME ZONE,
  
  -- Active task tracking
  active_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  task_started_at TIMESTAMP WITH TIME ZONE,
  
  -- Idle tracking
  last_movement_at TIMESTAMP WITH TIME ZONE,
  idle_minutes INTEGER DEFAULT 0,
  
  -- Session info
  session_started_at TIMESTAMP WITH TIME ZONE,
  last_intervention_at TIMESTAMP WITH TIME ZONE,
  interventions_today INTEGER DEFAULT 0,
  
  -- Daily stats
  productive_minutes_today INTEGER DEFAULT 0,
  idle_minutes_today INTEGER DEFAULT 0,
  tasks_completed_today INTEGER DEFAULT 0,
  
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_context ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own context" 
  ON public.user_context FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own context" 
  ON public.user_context FOR ALL 
  USING (auth.uid() = user_id);

-- Create updated_at trigger for tasks
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for patterns
CREATE TRIGGER update_patterns_updated_at
  BEFORE UPDATE ON public.behavioral_patterns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for user_context
CREATE TRIGGER update_user_context_updated_at
  BEFORE UPDATE ON public.user_context
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();