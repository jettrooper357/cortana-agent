import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface HomeAssistantConfig {
  id: string;
  user_id: string;
  instance_url: string;
  name: string;
  is_active: boolean;
  last_connected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HomeAssistantEntity {
  id: string;
  user_id: string;
  entity_id: string;
  friendly_name: string | null;
  state: string | null;
  attributes: Record<string, unknown>;
  domain: string | null;
  last_updated_at: string | null;
}

export interface HomeAssistantConfigInput {
  instance_url: string;
  name?: string;
  is_active?: boolean;
}

export function useHomeAssistant() {
  const [config, setConfig] = useState<HomeAssistantConfig | null>(null);
  const [entities, setEntities] = useState<HomeAssistantEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Store token in memory only (never in DB for security)
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!user) {
      setConfig(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from('home_assistant_config')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      setConfig(data as HomeAssistantConfig | null);
    } catch (err) {
      console.error('Error fetching HA config:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch config');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const fetchEntities = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('home_assistant_entities')
        .select('*')
        .eq('user_id', user.id)
        .order('domain', { ascending: true });

      if (fetchError) throw fetchError;
      setEntities((data || []) as HomeAssistantEntity[]);
    } catch (err) {
      console.error('Error fetching HA entities:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchConfig();
    fetchEntities();
  }, [fetchConfig, fetchEntities]);

  const saveConfig = async (input: HomeAssistantConfigInput): Promise<HomeAssistantConfig | null> => {
    if (!user) return null;

    try {
      if (config) {
        // Update existing
        const { data, error: updateError } = await supabase
          .from('home_assistant_config')
          .update({
            instance_url: input.instance_url,
            name: input.name || 'Home Assistant',
            is_active: input.is_active ?? true,
          })
          .eq('id', config.id)
          .select()
          .single();

        if (updateError) throw updateError;
        setConfig(data as HomeAssistantConfig);
        return data as HomeAssistantConfig;
      } else {
        // Create new
        const { data, error: insertError } = await supabase
          .from('home_assistant_config')
          .insert({
            user_id: user.id,
            instance_url: input.instance_url,
            name: input.name || 'Home Assistant',
            is_active: input.is_active ?? true,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setConfig(data as HomeAssistantConfig);
        return data as HomeAssistantConfig;
      }
    } catch (err) {
      console.error('Error saving HA config:', err);
      setError(err instanceof Error ? err.message : 'Failed to save config');
      return null;
    }
  };

  const deleteConfig = async (): Promise<boolean> => {
    if (!user || !config) return false;

    try {
      const { error: deleteError } = await supabase
        .from('home_assistant_config')
        .delete()
        .eq('id', config.id);

      if (deleteError) throw deleteError;
      setConfig(null);
      setEntities([]);
      setAccessToken(null);
      return true;
    } catch (err) {
      console.error('Error deleting HA config:', err);
      return false;
    }
  };

  const testConnection = async (instanceUrl: string, token: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/home-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session?.access_token}`,
        },
        body: JSON.stringify({
          action: 'test',
          instance_url: instanceUrl,
          access_token: token,
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        return { success: false, message: result.error || 'Connection failed' };
      }

      return { success: true, message: `Connected! Running ${result.version || 'Home Assistant'}` };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Connection failed' };
    }
  };

  const syncEntities = async (token: string): Promise<{ success: boolean; count?: number }> => {
    if (!config) return { success: false };

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/home-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session?.access_token}`,
        },
        body: JSON.stringify({
          action: 'sync_entities',
          instance_url: config.instance_url,
          access_token: token,
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Sync failed');
      }

      await fetchEntities();
      return { success: true, count: result.synced };
    } catch (err) {
      console.error('Sync error:', err);
      return { success: false };
    }
  };

  const callService = async (
    token: string,
    domain: string,
    service: string,
    entityId?: string,
    data?: Record<string, unknown>
  ): Promise<boolean> => {
    if (!config) return false;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/home-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session?.access_token}`,
        },
        body: JSON.stringify({
          action: 'call_service',
          instance_url: config.instance_url,
          access_token: token,
          service_domain: domain,
          service: service,
          entity_id: entityId,
          service_data: data,
        }),
      });

      return response.ok;
    } catch (err) {
      console.error('Service call error:', err);
      return false;
    }
  };

  const getEntitiesByDomain = (domain: string): HomeAssistantEntity[] => {
    return entities.filter(e => e.domain === domain);
  };

  return {
    config,
    entities,
    isLoading,
    error,
    accessToken,
    setAccessToken,
    saveConfig,
    deleteConfig,
    testConnection,
    syncEntities,
    callService,
    getEntitiesByDomain,
    refetch: fetchConfig,
  };
}
