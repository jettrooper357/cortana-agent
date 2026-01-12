import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface UserContext {
  id: string;
  user_id: string;
  current_room?: string;
  room_entered_at?: string;
  current_activity?: string;
  activity_started_at?: string;
  active_task_id?: string;
  task_started_at?: string;
  last_movement_at?: string;
  idle_minutes: number;
  session_started_at?: string;
  last_intervention_at?: string;
  interventions_today: number;
  productive_minutes_today: number;
  idle_minutes_today: number;
  tasks_completed_today: number;
  updated_at: string;
}

export interface UserContextUpdate {
  current_room?: string;
  room_entered_at?: string;
  current_activity?: string;
  activity_started_at?: string;
  active_task_id?: string;
  task_started_at?: string;
  last_movement_at?: string;
  idle_minutes?: number;
  session_started_at?: string;
  last_intervention_at?: string;
  interventions_today?: number;
  productive_minutes_today?: number;
  idle_minutes_today?: number;
  tasks_completed_today?: number;
}

export function useUserContext() {
  const { user, isLoading: authLoading } = useAuth();
  const [context, setContext] = useState<UserContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContext = useCallback(async () => {
    if (!user) {
      setContext(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try to get existing context
      const { data, error: fetchError } = await supabase
        .from('user_context')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        setContext(data as UserContext);
      } else {
        // Create initial context
        const { data: newContext, error: insertError } = await supabase
          .from('user_context')
          .insert({
            user_id: user.id,
            idle_minutes: 0,
            interventions_today: 0,
            productive_minutes_today: 0,
            idle_minutes_today: 0,
            tasks_completed_today: 0,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setContext(newContext as UserContext);
      }
    } catch (err) {
      console.error('Failed to fetch user context:', err);
      setError('Failed to load context');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      fetchContext();
    }
  }, [authLoading, fetchContext]);

  const updateContext = useCallback(async (updates: UserContextUpdate): Promise<UserContext | null> => {
    if (!user || !context) {
      return null;
    }

    try {
      const { data, error: updateError } = await supabase
        .from('user_context')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setContext(data as UserContext);
      return data as UserContext;
    } catch (err) {
      console.error('Failed to update context:', err);
      return null;
    }
  }, [user, context]);

  const setRoom = useCallback(async (room: string): Promise<UserContext | null> => {
    return updateContext({
      current_room: room,
      room_entered_at: new Date().toISOString(),
    });
  }, [updateContext]);

  const setActivity = useCallback(async (activity: string): Promise<UserContext | null> => {
    return updateContext({
      current_activity: activity,
      activity_started_at: new Date().toISOString(),
    });
  }, [updateContext]);

  const recordMovement = useCallback(async (): Promise<UserContext | null> => {
    return updateContext({
      last_movement_at: new Date().toISOString(),
      idle_minutes: 0,
    });
  }, [updateContext]);

  const incrementIdle = useCallback(async (minutes: number = 1): Promise<UserContext | null> => {
    return updateContext({
      idle_minutes: (context?.idle_minutes || 0) + minutes,
      idle_minutes_today: (context?.idle_minutes_today || 0) + minutes,
    });
  }, [updateContext, context]);

  const recordTaskCompleted = useCallback(async (): Promise<UserContext | null> => {
    return updateContext({
      tasks_completed_today: (context?.tasks_completed_today || 0) + 1,
    });
  }, [updateContext, context]);

  const resetDailyStats = useCallback(async (): Promise<UserContext | null> => {
    return updateContext({
      interventions_today: 0,
      productive_minutes_today: 0,
      idle_minutes_today: 0,
      tasks_completed_today: 0,
    });
  }, [updateContext]);

  return {
    context,
    isLoading: isLoading || authLoading,
    error,
    updateContext,
    setRoom,
    setActivity,
    recordMovement,
    incrementIdle,
    recordTaskCompleted,
    resetDailyStats,
    refetch: fetchContext,
  };
}
