-- Rules table - the atomic unit of app behavior
CREATE TABLE public.rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'security', 'routine', 'chore', 'energy', 'health', 'custom'
  is_enabled BOOLEAN DEFAULT true,
  severity TEXT DEFAULT 'info', -- 'info', 'nudge', 'warning', 'urgent'
  
  -- WHEN: Trigger definition
  trigger_type TEXT NOT NULL, -- 'home_assistant', 'camera', 'schedule', 'task_state', 'goal_state', 'manual'
  trigger_config JSONB NOT NULL DEFAULT '{}',
  -- For HA: { entity_id, from_state, to_state, attribute, attribute_value }
  -- For camera: { camera_id, activity_tag, object_detected, room }
  -- For schedule: { cron, timezone }
  -- For task_state: { status, priority, overdue_minutes }
  -- For goal_state: { goal_id, progress_below, days_until_due }
  -- For manual: { signal_name }
  
  -- IF: Conditions (all must be true)
  conditions JSONB DEFAULT '[]',
  -- Array of: { type, operator, value, entity_id?, time_window_minutes?, negate? }
  -- Types: 'time_of_day', 'day_of_week', 'entity_state', 'room', 'idle_minutes', 'task_in_progress', 'quiet_hours'
  
  -- Rate limiting
  cooldown_minutes INTEGER DEFAULT 30, -- Minimum time between firings
  max_fires_per_day INTEGER, -- Optional daily cap
  
  -- THEN: Actions (executed in order)
  actions JSONB NOT NULL DEFAULT '[]',
  -- Array of: { type, config }
  -- Types: 
  --   'notify': { message, severity }
  --   'speak': { message }
  --   'create_task': { title, description, priority, room, due_in_minutes }
  --   'update_task': { task_id, status }
  --   'home_assistant': { domain, service, entity_id, service_data }
  --   'n8n_webhook': { webhook_url, payload_template }
  --   'update_goal': { goal_id, increment_value }
  --   'set_context': { room?, activity? }
  
  -- BECAUSE: Explanation
  explanation_template TEXT, -- "Because you've been idle for {idle_minutes} minutes and {task_title} is still pending."
  
  -- Escalation
  escalation_enabled BOOLEAN DEFAULT false,
  escalation_after_minutes INTEGER,
  escalation_action JSONB, -- Same format as actions
  
  -- Privacy
  excluded_rooms TEXT[], -- Rooms where this rule won't fire
  excluded_times JSONB, -- Time ranges to skip, e.g., [{ start: "22:00", end: "07:00" }]
  
  -- Tracking
  last_fired_at TIMESTAMP WITH TIME ZONE,
  times_fired INTEGER DEFAULT 0,
  times_fired_today INTEGER DEFAULT 0,
  last_reset_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own rules" 
  ON public.rules FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own rules" 
  ON public.rules FOR ALL 
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_rules_user_enabled ON public.rules(user_id, is_enabled);
CREATE INDEX idx_rules_trigger ON public.rules(user_id, trigger_type);

-- Rule executions log - audit trail
CREATE TABLE public.rule_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  rule_id UUID NOT NULL REFERENCES public.rules(id) ON DELETE CASCADE,
  
  -- What happened
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  trigger_data JSONB, -- The event/data that triggered evaluation
  
  -- Evaluation
  conditions_evaluated JSONB, -- Array of { condition, result, actual_value }
  all_conditions_met BOOLEAN NOT NULL,
  
  -- Execution
  actions_executed JSONB, -- Array of { action, success, result?, error? }
  explanation TEXT, -- Rendered explanation
  
  -- Outcome
  execution_status TEXT NOT NULL DEFAULT 'success', -- 'success', 'partial', 'failed', 'skipped_cooldown', 'skipped_conditions'
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rule_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own rule executions" 
  ON public.rule_executions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rule executions" 
  ON public.rule_executions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Index for recent executions
CREATE INDEX idx_rule_executions_user_time ON public.rule_executions(user_id, triggered_at DESC);
CREATE INDEX idx_rule_executions_rule ON public.rule_executions(rule_id, triggered_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_rules_updated_at
  BEFORE UPDATE ON public.rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();