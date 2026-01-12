import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Goal {
  id: string;
  title: string;
  description?: string;
  category?: string;
  target_value?: number;
  current_value: number;
  unit?: string;
  monitoring_type: string[];
  camera_id?: string;
  n8n_workflow_id?: string;
  status: 'active' | 'completed' | 'paused';
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface GoalInput {
  title: string;
  description?: string;
  category?: string;
  target_value?: number;
  current_value?: number;
  unit?: string;
  monitoring_type?: string[];
  camera_id?: string;
  n8n_workflow_id?: string;
  status?: 'active' | 'completed' | 'paused';
  due_date?: string;
}

export interface GoalLog {
  id: string;
  goal_id: string;
  value?: number;
  notes?: string;
  source: 'manual' | 'camera' | 'email' | 'n8n';
  metadata?: Record<string, unknown>;
  logged_at: string;
}

export const useGoals = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch goals
  const fetchGoals = useCallback(async () => {
    if (!user) {
      setGoals([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setGoals((data || []).map(g => ({
        ...g,
        status: g.status as 'active' | 'completed' | 'paused'
      })));
    } catch (err) {
      console.error('Failed to fetch goals:', err);
      setError('Failed to load goals');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      fetchGoals();
    }
  }, [authLoading, fetchGoals]);

  // Add goal
  const addGoal = useCallback(async (goal: GoalInput): Promise<Goal | null> => {
    if (!user) {
      setError('You must be logged in to add goals');
      return null;
    }

    try {
      const { data, error: insertError } = await supabase
        .from('goals')
        .insert({
          ...goal,
          user_id: user.id,
          current_value: goal.current_value ?? 0,
          monitoring_type: goal.monitoring_type ?? [],
          status: goal.status ?? 'active'
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      const newGoal = {
        ...data,
        status: data.status as 'active' | 'completed' | 'paused'
      };
      setGoals(prev => [newGoal, ...prev]);
      return newGoal;
    } catch (err) {
      console.error('Failed to add goal:', err);
      setError('Failed to add goal');
      return null;
    }
  }, [user]);

  // Update goal
  const updateGoal = useCallback(async (id: string, updates: Partial<GoalInput>): Promise<Goal | null> => {
    if (!user) {
      setError('You must be logged in to update goals');
      return null;
    }

    try {
      const { data, error: updateError } = await supabase
        .from('goals')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      const updatedGoal = {
        ...data,
        status: data.status as 'active' | 'completed' | 'paused'
      };
      setGoals(prev => prev.map(g => g.id === id ? updatedGoal : g));
      return updatedGoal;
    } catch (err) {
      console.error('Failed to update goal:', err);
      setError('Failed to update goal');
      return null;
    }
  }, [user]);

  // Delete goal
  const deleteGoal = useCallback(async (id: string): Promise<boolean> => {
    if (!user) {
      setError('You must be logged in to delete goals');
      return false;
    }

    try {
      const { error: deleteError } = await supabase
        .from('goals')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (deleteError) {
        throw deleteError;
      }

      setGoals(prev => prev.filter(g => g.id !== id));
      return true;
    } catch (err) {
      console.error('Failed to delete goal:', err);
      setError('Failed to delete goal');
      return false;
    }
  }, [user]);

  // Log progress
  const logProgress = useCallback(async (
    goalId: string, 
    value: number, 
    notes?: string, 
    source: 'manual' | 'camera' | 'email' | 'n8n' = 'manual'
  ): Promise<GoalLog | null> => {
    if (!user) {
      setError('You must be logged in to log progress');
      return null;
    }

    try {
      const { data: logData, error: logError } = await supabase
        .from('goal_logs')
        .insert({
          goal_id: goalId,
          user_id: user.id,
          value,
          notes,
          source
        })
        .select()
        .single();

      if (logError) {
        throw logError;
      }

      // Update goal's current value
      const goal = goals.find(g => g.id === goalId);
      if (goal) {
        await updateGoal(goalId, {
          current_value: (goal.current_value || 0) + value
        });
      }

      return logData as GoalLog;
    } catch (err) {
      console.error('Failed to log progress:', err);
      setError('Failed to log progress');
      return null;
    }
  }, [user, goals, updateGoal]);

  // Get goal logs
  const getGoalLogs = useCallback(async (goalId: string): Promise<GoalLog[]> => {
    if (!user) return [];

    try {
      const { data, error: fetchError } = await supabase
        .from('goal_logs')
        .select('*')
        .eq('goal_id', goalId)
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      return (data || []) as GoalLog[];
    } catch (err) {
      console.error('Failed to fetch goal logs:', err);
      return [];
    }
  }, [user]);

  // Get goal by ID
  const getGoalById = useCallback((id: string): Goal | undefined => {
    return goals.find(g => g.id === id);
  }, [goals]);

  return {
    goals,
    isLoading: isLoading || authLoading,
    error,
    addGoal,
    updateGoal,
    deleteGoal,
    logProgress,
    getGoalLogs,
    getGoalById,
    refetch: fetchGoals
  };
};
