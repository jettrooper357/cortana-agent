import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Rule {
  id: string;
  user_id: string;
  name: string;
  is_enabled: boolean;
  severity: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  conditions: Array<{
    type: string;
    operator: string;
    value: unknown;
    entity_id?: string;
    time_window_minutes?: number;
    negate?: boolean;
  }>;
  cooldown_minutes: number;
  max_fires_per_day?: number;
  actions: Array<{
    type: string;
    config: Record<string, unknown>;
  }>;
  explanation_template?: string;
  excluded_rooms?: string[];
  excluded_times?: Array<{ start: string; end: string }>;
  last_fired_at?: string;
  times_fired_today: number;
  last_reset_date?: string;
}

interface EvaluationContext {
  currentRoom?: string;
  currentActivity?: string;
  idleMinutes: number;
  timeOfDay: string;
  dayOfWeek: number;
  currentHour: number;
  currentMinute: number;
  entityStates: Record<string, string>;
  activeTaskId?: string;
  triggerData: Record<string, unknown>;
}

interface ExecuteRulesInput {
  userId: string;
  triggerType: string;
  triggerData: Record<string, unknown>;
  context: EvaluationContext;
}

// Evaluate a single condition
function evaluateCondition(
  condition: Rule['conditions'][0],
  context: EvaluationContext
): { result: boolean; actual_value: unknown } {
  let actualValue: unknown;
  let result = false;

  switch (condition.type) {
    case 'time_of_day':
      actualValue = context.timeOfDay;
      if (Array.isArray(condition.value)) {
        result = (condition.value as string[]).includes(context.timeOfDay);
      } else {
        result = context.timeOfDay === condition.value;
      }
      break;

    case 'day_of_week':
      actualValue = context.dayOfWeek;
      if (Array.isArray(condition.value)) {
        result = (condition.value as number[]).includes(context.dayOfWeek);
      } else {
        result = context.dayOfWeek === condition.value;
      }
      break;

    case 'entity_state':
      actualValue = condition.entity_id ? context.entityStates[condition.entity_id] : undefined;
      result = actualValue === condition.value;
      break;

    case 'room':
      actualValue = context.currentRoom;
      if (condition.operator === 'equals') {
        result = context.currentRoom === condition.value;
      } else if (condition.operator === 'not_equals') {
        result = context.currentRoom !== condition.value;
      }
      break;

    case 'idle_minutes':
      actualValue = context.idleMinutes;
      const threshold = typeof condition.value === 'number' ? condition.value : parseInt(condition.value as string);
      if (condition.operator === 'greater_than') {
        result = context.idleMinutes > threshold;
      } else if (condition.operator === 'less_than') {
        result = context.idleMinutes < threshold;
      } else {
        result = context.idleMinutes === threshold;
      }
      break;

    case 'task_in_progress':
      actualValue = !!context.activeTaskId;
      result = condition.value === true ? !!context.activeTaskId : !context.activeTaskId;
      break;

    case 'quiet_hours':
      const now = context.currentHour * 60 + context.currentMinute;
      actualValue = now;
      // Check if current time is within any quiet period
      if (Array.isArray(condition.value)) {
        for (const period of condition.value as Array<{ start: string; end: string }>) {
          const [startH, startM] = period.start.split(':').map(Number);
          const [endH, endM] = period.end.split(':').map(Number);
          const startMins = startH * 60 + startM;
          const endMins = endH * 60 + endM;
          
          if (startMins <= endMins) {
            if (now >= startMins && now <= endMins) {
              result = true;
              break;
            }
          } else {
            // Overnight period
            if (now >= startMins || now <= endMins) {
              result = true;
              break;
            }
          }
        }
      }
      break;

    default:
      actualValue = null;
      result = false;
  }

  if (condition.negate) {
    result = !result;
  }

  return { result, actual_value: actualValue };
}

// Check if rule is in cooldown
function isInCooldown(rule: Rule): boolean {
  if (!rule.last_fired_at) return false;
  
  const lastFired = new Date(rule.last_fired_at).getTime();
  const now = Date.now();
  const cooldownMs = rule.cooldown_minutes * 60 * 1000;
  
  return (now - lastFired) < cooldownMs;
}

// Check if rule hit daily cap
function hitDailyCap(rule: Rule): boolean {
  if (!rule.max_fires_per_day) return false;
  
  // Reset counter if new day
  const today = new Date().toISOString().split('T')[0];
  if (rule.last_reset_date !== today) {
    return false; // Will be reset when we update
  }
  
  return rule.times_fired_today >= rule.max_fires_per_day;
}

// Check excluded times
function isInExcludedTime(rule: Rule, hour: number, minute: number): boolean {
  if (!rule.excluded_times?.length) return false;
  
  const now = hour * 60 + minute;
  
  for (const period of rule.excluded_times) {
    const [startH, startM] = period.start.split(':').map(Number);
    const [endH, endM] = period.end.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    
    if (startMins <= endMins) {
      if (now >= startMins && now <= endMins) return true;
    } else {
      if (now >= startMins || now <= endMins) return true;
    }
  }
  
  return false;
}

// Render explanation template
function renderExplanation(template: string | undefined, context: EvaluationContext, triggerData: Record<string, unknown>): string {
  if (!template) return '';
  
  let result = template;
  
  // Replace context variables
  result = result.replace(/{idle_minutes}/g, String(context.idleMinutes));
  result = result.replace(/{room}/g, context.currentRoom || 'unknown');
  result = result.replace(/{activity}/g, context.currentActivity || 'unknown');
  result = result.replace(/{time_of_day}/g, context.timeOfDay);
  
  // Replace trigger data
  for (const [key, value] of Object.entries(triggerData)) {
    result = result.replace(new RegExp(`{${key}}`, 'g'), String(value));
  }
  
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, triggerType, triggerData, context } = await req.json() as ExecuteRulesInput;
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch enabled rules for this trigger type
    const { data: rules, error: rulesError } = await supabase
      .from('rules')
      .select('*')
      .eq('user_id', userId)
      .eq('is_enabled', true)
      .eq('trigger_type', triggerType);

    if (rulesError) throw rulesError;
    if (!rules?.length) {
      return new Response(
        JSON.stringify({ executed: 0, results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{
      ruleId: string;
      ruleName: string;
      status: string;
      explanation?: string;
      actions?: Array<{ type: string; success: boolean; error?: string }>;
    }> = [];

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    for (const ruleData of rules) {
      const rule = ruleData as unknown as Rule;
      
      // Check cooldown
      if (isInCooldown(rule)) {
        results.push({ ruleId: rule.id, ruleName: rule.name, status: 'skipped_cooldown' });
        continue;
      }

      // Check daily cap
      if (hitDailyCap(rule)) {
        results.push({ ruleId: rule.id, ruleName: rule.name, status: 'skipped_daily_cap' });
        continue;
      }

      // Check excluded times
      if (isInExcludedTime(rule, context.currentHour, context.currentMinute)) {
        results.push({ ruleId: rule.id, ruleName: rule.name, status: 'skipped_excluded_time' });
        continue;
      }

      // Check excluded rooms
      if (rule.excluded_rooms?.includes(context.currentRoom || '')) {
        results.push({ ruleId: rule.id, ruleName: rule.name, status: 'skipped_excluded_room' });
        continue;
      }

      // Evaluate conditions
      const conditionResults = rule.conditions.map(c => ({
        condition: c,
        ...evaluateCondition(c, context)
      }));
      
      const allConditionsMet = conditionResults.every(c => c.result);
      
      if (!allConditionsMet) {
        // Log the skipped execution
        await supabase.from('rule_executions').insert({
          user_id: userId,
          rule_id: rule.id,
          trigger_data: triggerData,
          conditions_evaluated: conditionResults,
          all_conditions_met: false,
          actions_executed: [],
          execution_status: 'skipped_conditions'
        });
        
        results.push({ ruleId: rule.id, ruleName: rule.name, status: 'skipped_conditions' });
        continue;
      }

      // Execute actions
      const actionResults: Array<{ type: string; success: boolean; result?: unknown; error?: string }> = [];
      
      for (const action of rule.actions) {
        try {
          switch (action.type) {
            case 'notify':
            case 'speak':
              // These will be handled by the caller
              actionResults.push({
                type: action.type,
                success: true,
                result: { message: action.config.message, severity: action.config.severity || rule.severity }
              });
              break;

            case 'create_task':
              const { error: taskError } = await supabase.from('tasks').insert({
                user_id: userId,
                title: action.config.title,
                description: action.config.description,
                priority: action.config.priority || 'medium',
                room: action.config.room,
                due_at: action.config.due_in_minutes 
                  ? new Date(Date.now() + (action.config.due_in_minutes as number) * 60000).toISOString()
                  : null,
                status: 'pending',
              });
              actionResults.push({ type: 'create_task', success: !taskError, error: taskError?.message });
              break;

            case 'update_task':
              const { error: updateTaskError } = await supabase
                .from('tasks')
                .update({ status: action.config.status })
                .eq('id', action.config.task_id)
                .eq('user_id', userId);
              actionResults.push({ type: 'update_task', success: !updateTaskError, error: updateTaskError?.message });
              break;

            case 'update_goal':
              // Increment goal progress
              const { data: goal } = await supabase
                .from('goals')
                .select('current_value')
                .eq('id', action.config.goal_id)
                .eq('user_id', userId)
                .single();
              
              if (goal) {
                const { error: goalError } = await supabase
                  .from('goals')
                  .update({ current_value: (goal.current_value || 0) + (action.config.increment_value || 1) })
                  .eq('id', action.config.goal_id);
                actionResults.push({ type: 'update_goal', success: !goalError, error: goalError?.message });
              }
              break;

            case 'set_context':
              const { error: ctxError } = await supabase
                .from('user_context')
                .update({
                  current_room: action.config.room || undefined,
                  current_activity: action.config.activity || undefined,
                })
                .eq('user_id', userId);
              actionResults.push({ type: 'set_context', success: !ctxError, error: ctxError?.message });
              break;

            case 'home_assistant':
            case 'n8n_webhook':
              // These need external calls - return them for the caller to handle
              actionResults.push({
                type: action.type,
                success: true,
                result: action.config
              });
              break;

            default:
              actionResults.push({ type: action.type, success: false, error: 'Unknown action type' });
          }
        } catch (err) {
          actionResults.push({ 
            type: action.type, 
            success: false, 
            error: err instanceof Error ? err.message : 'Unknown error' 
          });
        }
      }

      const explanation = renderExplanation(rule.explanation_template, context, triggerData);
      const allActionsSucceeded = actionResults.every(a => a.success);

      // Log execution
      await supabase.from('rule_executions').insert({
        user_id: userId,
        rule_id: rule.id,
        trigger_data: triggerData,
        conditions_evaluated: conditionResults,
        all_conditions_met: true,
        actions_executed: actionResults,
        explanation,
        execution_status: allActionsSucceeded ? 'success' : 'partial'
      });

      // Update rule tracking
      const updateData: Record<string, unknown> = {
        last_fired_at: now.toISOString(),
        times_fired: (rule.times_fired || 0) + 1,
      };
      
      if (rule.last_reset_date !== today) {
        updateData.times_fired_today = 1;
        updateData.last_reset_date = today;
      } else {
        updateData.times_fired_today = (rule.times_fired_today || 0) + 1;
      }
      
      await supabase.from('rules').update(updateData).eq('id', rule.id);

      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        status: allActionsSucceeded ? 'success' : 'partial',
        explanation,
        actions: actionResults.map(a => ({ type: a.type, success: a.success, error: a.error }))
      });
    }

    return new Response(
      JSON.stringify({ 
        executed: results.filter(r => r.status === 'success' || r.status === 'partial').length,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Rules engine error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
