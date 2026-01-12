import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Json } from '@/integrations/supabase/types';

export interface N8nIntegration {
  id: string;
  name: string;
  webhook_url: string;
  type: 'email' | 'calendar' | 'custom';
  is_active: boolean;
  last_sync?: string | null;
  config?: Json;
  created_at: string;
  updated_at: string;
}

export interface N8nIntegrationInput {
  name: string;
  webhook_url: string;
  type?: 'email' | 'calendar' | 'custom';
  is_active?: boolean;
  config?: Json;
}

export const useN8n = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [integrations, setIntegrations] = useState<N8nIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    if (!user) {
      setIntegrations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('n8n_integrations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setIntegrations((data || []).map(i => ({
        ...i,
        type: i.type as 'email' | 'calendar' | 'custom'
      })));
    } catch (err) {
      console.error('Failed to fetch n8n integrations:', err);
      setError('Failed to load integrations');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) fetchIntegrations();
  }, [authLoading, fetchIntegrations]);

  const addIntegration = useCallback(async (integration: N8nIntegrationInput): Promise<N8nIntegration | null> => {
    if (!user) {
      setError('You must be logged in');
      return null;
    }

    try {
      const { data, error: insertError } = await supabase
        .from('n8n_integrations')
        .insert({
          name: integration.name,
          webhook_url: integration.webhook_url,
          type: integration.type ?? 'custom',
          is_active: integration.is_active ?? true,
          user_id: user.id
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const newIntegration = { ...data, type: data.type as 'email' | 'calendar' | 'custom' };
      setIntegrations(prev => [newIntegration, ...prev]);
      return newIntegration;
    } catch (err) {
      console.error('Failed to add integration:', err);
      setError('Failed to add integration');
      return null;
    }
  }, [user]);

  const updateIntegration = useCallback(async (id: string, updates: Partial<N8nIntegrationInput>): Promise<N8nIntegration | null> => {
    if (!user) {
      setError('You must be logged in');
      return null;
    }

    try {
      const { data, error: updateError } = await supabase
        .from('n8n_integrations')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      const updatedIntegration = { ...data, type: data.type as 'email' | 'calendar' | 'custom' };
      setIntegrations(prev => prev.map(i => i.id === id ? updatedIntegration : i));
      return updatedIntegration;
    } catch (err) {
      console.error('Failed to update integration:', err);
      setError('Failed to update integration');
      return null;
    }
  }, [user]);

  const deleteIntegration = useCallback(async (id: string): Promise<boolean> => {
    if (!user) {
      setError('You must be logged in');
      return false;
    }

    try {
      const { error: deleteError } = await supabase
        .from('n8n_integrations')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      setIntegrations(prev => prev.filter(i => i.id !== id));
      return true;
    } catch (err) {
      console.error('Failed to delete integration:', err);
      setError('Failed to delete integration');
      return false;
    }
  }, [user]);

  const triggerWebhook = useCallback(async (id: string, payload?: Record<string, unknown>): Promise<unknown> => {
    const integration = integrations.find(i => i.id === id);
    if (!integration) {
      setError('Integration not found');
      return null;
    }

    try {
      const response = await fetch(integration.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
      });

      if (!response.ok) throw new Error(`Webhook failed: ${response.statusText}`);

      await updateIntegration(id, { last_sync: new Date().toISOString() } as unknown as Partial<N8nIntegrationInput>);
      return await response.json();
    } catch (err) {
      console.error('Failed to trigger webhook:', err);
      setError('Failed to trigger webhook');
      return null;
    }
  }, [integrations, updateIntegration]);

  const getIntegrationByType = useCallback((type: 'email' | 'calendar' | 'custom'): N8nIntegration | undefined => {
    return integrations.find(i => i.type === type && i.is_active);
  }, [integrations]);

  return {
    integrations,
    isLoading: isLoading || authLoading,
    error,
    addIntegration,
    updateIntegration,
    deleteIntegration,
    triggerWebhook,
    getIntegrationByType,
    refetch: fetchIntegrations
  };
};
