import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Task {
  id: string;
  title: string;
  description?: string;
  category?: string;
  status: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'skipped';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_at?: string;
  started_at?: string;
  completed_at?: string;
  estimated_minutes?: number;
  room?: string;
  requires_location: boolean;
  is_recurring: boolean;
  recurrence_rule?: string;
  times_reminded: number;
  last_reminded_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskInput {
  title: string;
  description?: string;
  category?: string;
  status?: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'skipped';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  due_at?: string;
  started_at?: string;
  completed_at?: string;
  estimated_minutes?: number;
  room?: string;
  requires_location?: boolean;
  is_recurring?: boolean;
  recurrence_rule?: string;
}

export function useTasks() {
  const { user, isLoading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!user) {
      setTasks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: false })
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setTasks((data || []).map(t => ({
        ...t,
        status: t.status as Task['status'],
        priority: t.priority as Task['priority'],
      })));
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setError('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      fetchTasks();
    }
  }, [authLoading, fetchTasks]);

  const addTask = useCallback(async (task: TaskInput): Promise<Task | null> => {
    if (!user) {
      setError('You must be logged in to add tasks');
      return null;
    }

    try {
      const { data, error: insertError } = await supabase
        .from('tasks')
        .insert({
          ...task,
          user_id: user.id,
          status: task.status ?? 'pending',
          priority: task.priority ?? 'medium',
          requires_location: task.requires_location ?? false,
          is_recurring: task.is_recurring ?? false,
          times_reminded: 0,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const newTask = {
        ...data,
        status: data.status as Task['status'],
        priority: data.priority as Task['priority'],
      };
      setTasks(prev => [newTask, ...prev]);
      return newTask;
    } catch (err) {
      console.error('Failed to add task:', err);
      setError('Failed to add task');
      return null;
    }
  }, [user]);

  const updateTask = useCallback(async (id: string, updates: Partial<TaskInput>): Promise<Task | null> => {
    if (!user) {
      setError('You must be logged in to update tasks');
      return null;
    }

    try {
      const { data, error: updateError } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      const updatedTask = {
        ...data,
        status: data.status as Task['status'],
        priority: data.priority as Task['priority'],
      };
      setTasks(prev => prev.map(t => t.id === id ? updatedTask : t));
      return updatedTask;
    } catch (err) {
      console.error('Failed to update task:', err);
      setError('Failed to update task');
      return null;
    }
  }, [user]);

  const deleteTask = useCallback(async (id: string): Promise<boolean> => {
    if (!user) {
      setError('You must be logged in to delete tasks');
      return false;
    }

    try {
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      setTasks(prev => prev.filter(t => t.id !== id));
      return true;
    } catch (err) {
      console.error('Failed to delete task:', err);
      setError('Failed to delete task');
      return false;
    }
  }, [user]);

  const startTask = useCallback(async (id: string): Promise<Task | null> => {
    return updateTask(id, { 
      status: 'in_progress',
      started_at: new Date().toISOString(),
    });
  }, [updateTask]);

  const completeTask = useCallback(async (id: string): Promise<Task | null> => {
    return updateTask(id, { 
      status: 'completed',
      completed_at: new Date().toISOString(),
    });
  }, [updateTask]);

  const skipTask = useCallback(async (id: string): Promise<Task | null> => {
    return updateTask(id, { status: 'skipped' });
  }, [updateTask]);

  const getPendingTasks = useCallback((): Task[] => {
    return tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
  }, [tasks]);

  const getOverdueTasks = useCallback((): Task[] => {
    const now = new Date();
    return tasks.filter(t => 
      (t.status === 'pending' || t.status === 'in_progress') && 
      t.due_at && 
      new Date(t.due_at) < now
    );
  }, [tasks]);

  const getTasksByRoom = useCallback((room: string): Task[] => {
    return tasks.filter(t => t.room?.toLowerCase() === room.toLowerCase());
  }, [tasks]);

  return {
    tasks,
    isLoading: isLoading || authLoading,
    error,
    addTask,
    updateTask,
    deleteTask,
    startTask,
    completeTask,
    skipTask,
    getPendingTasks,
    getOverdueTasks,
    getTasksByRoom,
    refetch: fetchTasks,
  };
}
