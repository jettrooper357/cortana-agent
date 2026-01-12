import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Json } from '@/integrations/supabase/types';

export interface RuleTriggerConfig {
  // Home Assistant
  entity_id?: string;
  from_state?: string;
  to_state?: string;
  attribute?: string;
  attribute_value?: string;
  // Camera
  camera_id?: string;
  activity_tag?: string;
  object_detected?: string;
  room?: string;
  // Schedule
  cron?: string;
  timezone?: string;
  // Task state
  status?: string;
  priority?: string;
  overdue_minutes?: number;
  // Goal state
  goal_id?: string;
  progress_below?: number;
  days_until_due?: number;
  // Manual
  signal_name?: string;
}

export interface RuleCondition {
  type: 'time_of_day' | 'day_of_week' | 'entity_state' | 'room' | 'idle_minutes' | 'task_in_progress' | 'quiet_hours';
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in_range';
  value: string | number | string[];
  entity_id?: string;
  time_window_minutes?: number;
  negate?: boolean;
}

export interface RuleAction {
  type: 'notify' | 'speak' | 'create_task' | 'update_task' | 'home_assistant' | 'n8n_webhook' | 'update_goal' | 'set_context';
  config: {
    // Notify/Speak
    message?: string;
    severity?: string;
    // Create task
    title?: string;
    description?: string;
    priority?: string;
    room?: string;
    due_in_minutes?: number;
    // Update task
    task_id?: string;
    status?: string;
    // Home Assistant
    domain?: string;
    service?: string;
    entity_id?: string;
    service_data?: Record<string, unknown>;
    // n8n webhook
    webhook_url?: string;
    payload_template?: Record<string, unknown>;
    // Update goal
    goal_id?: string;
    increment_value?: number;
    // Set context
    activity?: string;
  };
}

export interface Rule {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  category?: string;
  is_enabled: boolean;
  severity: 'info' | 'nudge' | 'warning' | 'urgent';
  trigger_type: 'home_assistant' | 'camera' | 'schedule' | 'task_state' | 'goal_state' | 'manual';
  trigger_config: RuleTriggerConfig;
  conditions: RuleCondition[];
  cooldown_minutes: number;
  max_fires_per_day?: number;
  actions: RuleAction[];
  explanation_template?: string;
  escalation_enabled: boolean;
  escalation_after_minutes?: number;
  escalation_action?: RuleAction;
  excluded_rooms?: string[];
  excluded_times?: Array<{ start: string; end: string }>;
  last_fired_at?: string;
  times_fired: number;
  times_fired_today: number;
  created_at: string;
  updated_at: string;
}

export interface RuleInput {
  name: string;
  description?: string;
  category?: string;
  is_enabled?: boolean;
  severity?: 'info' | 'nudge' | 'warning' | 'urgent';
  trigger_type: 'home_assistant' | 'camera' | 'schedule' | 'task_state' | 'goal_state' | 'manual';
  trigger_config: RuleTriggerConfig;
  conditions?: RuleCondition[];
  cooldown_minutes?: number;
  max_fires_per_day?: number;
  actions: RuleAction[];
  explanation_template?: string;
  escalation_enabled?: boolean;
  escalation_after_minutes?: number;
  escalation_action?: RuleAction;
  excluded_rooms?: string[];
  excluded_times?: Array<{ start: string; end: string }>;
}

export interface RuleExecution {
  id: string;
  rule_id: string;
  triggered_at: string;
  trigger_data?: Record<string, unknown>;
  conditions_evaluated?: Array<{ condition: RuleCondition; result: boolean; actual_value: unknown }>;
  all_conditions_met: boolean;
  actions_executed?: Array<{ action: RuleAction; success: boolean; result?: unknown; error?: string }>;
  explanation?: string;
  execution_status: 'success' | 'partial' | 'failed' | 'skipped_cooldown' | 'skipped_conditions';
  error_message?: string;
  created_at: string;
}

// Type helpers for JSON conversion
function toJson(obj: unknown): Json {
  return JSON.parse(JSON.stringify(obj)) as Json;
}

function fromJson<T>(json: Json | null, defaultValue: T): T {
  if (json === null) return defaultValue;
  return json as unknown as T;
}

export function useRules() {
  const { user, isLoading: authLoading } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    if (!user) {
      setRules([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('rules')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setRules((data || []).map(r => ({
        ...r,
        severity: r.severity as Rule['severity'],
        trigger_type: r.trigger_type as Rule['trigger_type'],
        trigger_config: fromJson<RuleTriggerConfig>(r.trigger_config, {}),
        conditions: fromJson<RuleCondition[]>(r.conditions, []),
        actions: fromJson<RuleAction[]>(r.actions, []),
        escalation_action: r.escalation_action ? fromJson<RuleAction>(r.escalation_action, {} as RuleAction) : undefined,
        excluded_times: r.excluded_times ? fromJson<Array<{ start: string; end: string }>>(r.excluded_times, []) : undefined,
      })));
    } catch (err) {
      console.error('Failed to fetch rules:', err);
      setError('Failed to load rules');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      fetchRules();
    }
  }, [authLoading, fetchRules]);

  const addRule = useCallback(async (rule: RuleInput): Promise<Rule | null> => {
    if (!user) {
      setError('You must be logged in to add rules');
      return null;
    }

    try {
      const { data, error: insertError } = await supabase
        .from('rules')
        .insert({
          user_id: user.id,
          name: rule.name,
          description: rule.description,
          category: rule.category,
          is_enabled: rule.is_enabled ?? true,
          severity: rule.severity ?? 'info',
          trigger_type: rule.trigger_type,
          trigger_config: toJson(rule.trigger_config),
          conditions: toJson(rule.conditions ?? []),
          cooldown_minutes: rule.cooldown_minutes ?? 30,
          max_fires_per_day: rule.max_fires_per_day,
          actions: toJson(rule.actions),
          explanation_template: rule.explanation_template,
          escalation_enabled: rule.escalation_enabled ?? false,
          escalation_after_minutes: rule.escalation_after_minutes,
          escalation_action: rule.escalation_action ? toJson(rule.escalation_action) : null,
          excluded_rooms: rule.excluded_rooms,
          excluded_times: rule.excluded_times ? toJson(rule.excluded_times) : null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const newRule: Rule = {
        ...data,
        severity: data.severity as Rule['severity'],
        trigger_type: data.trigger_type as Rule['trigger_type'],
        trigger_config: fromJson<RuleTriggerConfig>(data.trigger_config, {}),
        conditions: fromJson<RuleCondition[]>(data.conditions, []),
        actions: fromJson<RuleAction[]>(data.actions, []),
        escalation_action: data.escalation_action ? fromJson<RuleAction>(data.escalation_action, {} as RuleAction) : undefined,
        excluded_times: data.excluded_times ? fromJson<Array<{ start: string; end: string }>>(data.excluded_times, []) : undefined,
      };
      setRules(prev => [newRule, ...prev]);
      return newRule;
    } catch (err) {
      console.error('Failed to add rule:', err);
      setError('Failed to add rule');
      return null;
    }
  }, [user]);

  const updateRule = useCallback(async (id: string, updates: Partial<RuleInput>): Promise<Rule | null> => {
    if (!user) {
      setError('You must be logged in to update rules');
      return null;
    }

    try {
      const updateData: Record<string, unknown> = {};
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.is_enabled !== undefined) updateData.is_enabled = updates.is_enabled;
      if (updates.severity !== undefined) updateData.severity = updates.severity;
      if (updates.trigger_type !== undefined) updateData.trigger_type = updates.trigger_type;
      if (updates.trigger_config !== undefined) updateData.trigger_config = toJson(updates.trigger_config);
      if (updates.conditions !== undefined) updateData.conditions = toJson(updates.conditions);
      if (updates.cooldown_minutes !== undefined) updateData.cooldown_minutes = updates.cooldown_minutes;
      if (updates.max_fires_per_day !== undefined) updateData.max_fires_per_day = updates.max_fires_per_day;
      if (updates.actions !== undefined) updateData.actions = toJson(updates.actions);
      if (updates.explanation_template !== undefined) updateData.explanation_template = updates.explanation_template;
      if (updates.escalation_enabled !== undefined) updateData.escalation_enabled = updates.escalation_enabled;
      if (updates.escalation_after_minutes !== undefined) updateData.escalation_after_minutes = updates.escalation_after_minutes;
      if (updates.escalation_action !== undefined) updateData.escalation_action = toJson(updates.escalation_action);
      if (updates.excluded_rooms !== undefined) updateData.excluded_rooms = updates.excluded_rooms;
      if (updates.excluded_times !== undefined) updateData.excluded_times = toJson(updates.excluded_times);

      const { data, error: updateError } = await supabase
        .from('rules')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      const updatedRule: Rule = {
        ...data,
        severity: data.severity as Rule['severity'],
        trigger_type: data.trigger_type as Rule['trigger_type'],
        trigger_config: fromJson<RuleTriggerConfig>(data.trigger_config, {}),
        conditions: fromJson<RuleCondition[]>(data.conditions, []),
        actions: fromJson<RuleAction[]>(data.actions, []),
        escalation_action: data.escalation_action ? fromJson<RuleAction>(data.escalation_action, {} as RuleAction) : undefined,
        excluded_times: data.excluded_times ? fromJson<Array<{ start: string; end: string }>>(data.excluded_times, []) : undefined,
      };
      setRules(prev => prev.map(r => r.id === id ? updatedRule : r));
      return updatedRule;
    } catch (err) {
      console.error('Failed to update rule:', err);
      setError('Failed to update rule');
      return null;
    }
  }, [user]);

  const deleteRule = useCallback(async (id: string): Promise<boolean> => {
    if (!user) {
      setError('You must be logged in to delete rules');
      return false;
    }

    try {
      const { error: deleteError } = await supabase
        .from('rules')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      setRules(prev => prev.filter(r => r.id !== id));
      return true;
    } catch (err) {
      console.error('Failed to delete rule:', err);
      setError('Failed to delete rule');
      return false;
    }
  }, [user]);

  const toggleRule = useCallback(async (id: string): Promise<Rule | null> => {
    const rule = rules.find(r => r.id === id);
    if (!rule) return null;
    return updateRule(id, { is_enabled: !rule.is_enabled });
  }, [rules, updateRule]);

  const getRecentExecutions = useCallback(async (ruleId: string, limit: number = 10): Promise<RuleExecution[]> => {
    if (!user) return [];

    try {
      const { data, error: fetchError } = await supabase
        .from('rule_executions')
        .select('*')
        .eq('rule_id', ruleId)
        .eq('user_id', user.id)
        .order('triggered_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;

      return (data || []).map(e => ({
        ...e,
        execution_status: e.execution_status as RuleExecution['execution_status'],
        trigger_data: fromJson<Record<string, unknown>>(e.trigger_data, {}),
        conditions_evaluated: fromJson<RuleExecution['conditions_evaluated']>(e.conditions_evaluated, []),
        actions_executed: fromJson<RuleExecution['actions_executed']>(e.actions_executed, []),
      }));
    } catch (err) {
      console.error('Failed to fetch rule executions:', err);
      return [];
    }
  }, [user]);

  const getEnabledRules = useCallback((): Rule[] => {
    return rules.filter(r => r.is_enabled);
  }, [rules]);

  const getRulesByTrigger = useCallback((triggerType: Rule['trigger_type']): Rule[] => {
    return rules.filter(r => r.is_enabled && r.trigger_type === triggerType);
  }, [rules]);

  const getRulesByCategory = useCallback((category: string): Rule[] => {
    return rules.filter(r => r.category === category);
  }, [rules]);

  return {
    rules,
    isLoading: isLoading || authLoading,
    error,
    addRule,
    updateRule,
    deleteRule,
    toggleRule,
    getRecentExecutions,
    getEnabledRules,
    getRulesByTrigger,
    getRulesByCategory,
    refetch: fetchRules,
  };
}
