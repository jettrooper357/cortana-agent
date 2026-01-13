import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Json } from '@/integrations/supabase/types';

export type WebhookType = 'elevenlabs' | 'openai' | 'custom';

// Voice provider types - these are the main options users can select
export type VoiceProvider = 'browser' | 'gemini' | string; // string for webhook IDs

export interface WebhookSettings {
  id: string;
  name: string;
  type: WebhookType;
  agentId?: string;
  apiKey?: string;
  webhookUrl?: string;
  isActive: boolean;
}

// Voice settings now reference providers
// 'browser' = use browser APIs
// 'gemini' = use Gemini AI for conversation + browser/elevenlabs for TTS
// webhook ID = use that specific webhook (e.g., ElevenLabs conversational agent)
export interface VoiceSettings {
  ttsProvider: VoiceProvider; // 'browser', 'gemini', or webhook ID for TTS
  sttProvider: VoiceProvider; // 'browser', 'gemini', or webhook ID for STT
  conversationProvider: VoiceProvider; // 'gemini' or webhook ID for conversation AI
}

export interface AppSettings {
  webhooks: WebhookSettings[];
  defaultWebhook?: string;
  voice: VoiceSettings;
}

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  ttsProvider: 'browser',
  sttProvider: 'browser',
  conversationProvider: 'gemini',
};

const DEFAULT_SETTINGS: AppSettings = {
  webhooks: [],
  defaultWebhook: undefined,
  voice: DEFAULT_VOICE_SETTINGS,
};

const SETTINGS_KEY = 'cortana-app-settings';

// Helper to migrate old settings format to new format
function migrateVoiceSettings(oldVoice: any): VoiceSettings {
  if (!oldVoice) return DEFAULT_VOICE_SETTINGS;
  
  // Check if already in new format
  if ('ttsProvider' in oldVoice) {
    return {
      ttsProvider: oldVoice.ttsProvider || 'browser',
      sttProvider: oldVoice.sttProvider || 'browser',
      conversationProvider: oldVoice.conversationProvider || 'gemini',
    };
  }
  
  // Migrate from old format (ttsWebhookId/sttWebhookId)
  return {
    ttsProvider: oldVoice.ttsWebhookId || 'browser',
    sttProvider: oldVoice.sttWebhookId || 'browser',
    conversationProvider: 'gemini', // Default to gemini for conversation
  };
}

export const useSettings = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from database or localStorage
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      
      if (user) {
        // Try to load from database
        try {
          const { data, error } = await supabase
            .from('user_settings')
            .select('settings')
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (error) {
            console.error('Failed to load settings from database:', error);
            // Fallback to localStorage
            loadFromLocalStorage();
          } else if (data) {
            const dbSettings = data.settings as unknown as AppSettings;
            // Migrate voice settings if needed
            const migratedVoice = migrateVoiceSettings(dbSettings.voice);
            const mergedSettings: AppSettings = {
              ...DEFAULT_SETTINGS,
              ...dbSettings,
              voice: migratedVoice,
            };
            setSettings(mergedSettings);
            console.log('Settings loaded from database (merged):', mergedSettings);
          } else {
            // No settings in database, check localStorage for migration
            const localSettings = loadFromLocalStorage();
            if (localSettings && localSettings.webhooks.length > 0) {
              // Migrate localStorage to database
              await saveToDatabase(localSettings);
              console.log('Migrated settings from localStorage to database');
            }
          }
        } catch (error) {
          console.error('Error loading settings:', error);
          loadFromLocalStorage();
        }
      } else {
        // Not logged in, use localStorage
        loadFromLocalStorage();
      }
      
      setIsLoading(false);
    };

    const loadFromLocalStorage = (): AppSettings | null => {
      try {
        const savedSettings = localStorage.getItem(SETTINGS_KEY);
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings);
          // Migrate voice settings if needed
          parsedSettings.voice = migrateVoiceSettings(parsedSettings.voice);
          setSettings(parsedSettings);
          return parsedSettings;
        }
      } catch (error) {
        console.error('Failed to load settings from localStorage:', error);
      }
      return null;
    };

    if (!authLoading) {
      loadSettings();
    }
  }, [user, authLoading]);

  // Save to database
  const saveToDatabase = async (newSettings: AppSettings): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { data: existing } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (existing) {
        const { error } = await supabase
          .from('user_settings')
          .update({ settings: JSON.parse(JSON.stringify(newSettings)) as Json })
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_settings')
          .insert([{ user_id: user.id, settings: JSON.parse(JSON.stringify(newSettings)) as Json }]);
        if (error) throw error;
      }
      return true;
    } catch (error) {
      console.error('Error saving settings to database:', error);
      return false;
    }
  };

  // Save settings
  const saveSettings = useCallback(async (newSettings: AppSettings) => {
    setSettings(newSettings);
    
    // Always save to localStorage as backup
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
    }
    
    // Save to database if logged in
    if (user) {
      await saveToDatabase(newSettings);
    }
  }, [user]);

  // Add or update webhook
  const saveWebhook = useCallback(async (webhook: WebhookSettings) => {
    const newSettings = { ...settings };
    const existingIndex = newSettings.webhooks.findIndex(w => w.id === webhook.id);
    
    if (existingIndex >= 0) {
      newSettings.webhooks[existingIndex] = webhook;
    } else {
      newSettings.webhooks.push(webhook);
    }
    
    // If this is the first webhook or it's set as active, make it default
    if (webhook.isActive || newSettings.webhooks.length === 1) {
      newSettings.defaultWebhook = webhook.id;
      // Deactivate other webhooks if this one is active
      if (webhook.isActive) {
        newSettings.webhooks = newSettings.webhooks.map(w => 
          w.id === webhook.id ? w : { ...w, isActive: false }
        );
      }
    }
    
    await saveSettings(newSettings);
  }, [settings, saveSettings]);

  // Delete webhook
  const deleteWebhook = useCallback(async (id: string) => {
    const newSettings = { ...settings };
    newSettings.webhooks = newSettings.webhooks.filter(w => w.id !== id);
    
    // If deleted webhook was default, set first remaining as default
    if (newSettings.defaultWebhook === id) {
      newSettings.defaultWebhook = newSettings.webhooks.length > 0 ? newSettings.webhooks[0].id : undefined;
      if (newSettings.webhooks.length > 0) {
        newSettings.webhooks[0].isActive = true;
      }
    }
    
    // Reset voice settings if they referenced this webhook
    if (newSettings.voice.ttsProvider === id) {
      newSettings.voice.ttsProvider = 'browser';
    }
    if (newSettings.voice.sttProvider === id) {
      newSettings.voice.sttProvider = 'browser';
    }
    if (newSettings.voice.conversationProvider === id) {
      newSettings.voice.conversationProvider = 'gemini';
    }
    
    await saveSettings(newSettings);
  }, [settings, saveSettings]);

  // Get active webhook
  const getActiveWebhook = useCallback((): WebhookSettings | undefined => {
    console.log('getActiveWebhook called - current webhooks:', settings.webhooks);
    const active = settings.webhooks.find(w => w.isActive);
    console.log('Found active webhook:', active);
    return active;
  }, [settings.webhooks]);

  // Get webhook by ID
  const getWebhookById = useCallback((id: string): WebhookSettings | undefined => {
    return settings.webhooks.find(w => w.id === id);
  }, [settings.webhooks]);

  // Set default webhook
  const setDefaultWebhook = useCallback(async (id: string) => {
    const newSettings = { ...settings };
    newSettings.defaultWebhook = id;
    newSettings.webhooks = newSettings.webhooks.map(w => ({
      ...w,
      isActive: w.id === id
    }));
    
    await saveSettings(newSettings);
  }, [settings, saveSettings]);

  // Clear all settings
  const clearAllSettings = useCallback(async () => {
    localStorage.removeItem(SETTINGS_KEY);
    setSettings(DEFAULT_SETTINGS);
    
    if (user) {
      await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', user.id);
    }
  }, [user]);

  // Update voice settings
  const updateVoiceSettings = useCallback(async (voice: Partial<VoiceSettings>) => {
    console.log('updateVoiceSettings called with:', voice);
    
    setSettings(prev => {
      const newSettings: AppSettings = {
        ...prev,
        voice: { ...DEFAULT_VOICE_SETTINGS, ...prev.voice, ...voice },
      };
      console.log('Saving new voice settings:', newSettings.voice);
      
      // Save asynchronously to both localStorage and database
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      if (user) {
        saveToDatabase(newSettings);
      }
      
      return newSettings;
    });
  }, [user]);

  // Helper to check if a provider is a webhook
  const isWebhookProvider = useCallback((provider: VoiceProvider): boolean => {
    return provider !== 'browser' && provider !== 'gemini';
  }, []);

  // Get the TTS configuration based on current settings
  const getTTSConfig = useCallback(() => {
    const provider = settings.voice.ttsProvider;
    if (provider === 'browser') {
      return { type: 'browser' as const };
    }
    if (provider === 'gemini') {
      // Gemini doesn't have its own TTS, fall back to browser
      return { type: 'browser' as const };
    }
    const webhook = settings.webhooks.find(w => w.id === provider);
    if (webhook) {
      return { type: 'webhook' as const, webhook };
    }
    return { type: 'browser' as const };
  }, [settings]);

  // Get the STT configuration based on current settings
  const getSTTConfig = useCallback(() => {
    const provider = settings.voice.sttProvider;
    if (provider === 'browser' || provider === 'gemini') {
      // Both browser and gemini use browser STT
      return { type: 'browser' as const };
    }
    const webhook = settings.webhooks.find(w => w.id === provider);
    if (webhook) {
      return { type: 'webhook' as const, webhook };
    }
    return { type: 'browser' as const };
  }, [settings]);

  // Get the conversation AI configuration
  const getConversationConfig = useCallback(() => {
    const provider = settings.voice.conversationProvider;
    if (provider === 'gemini') {
      return { type: 'gemini' as const };
    }
    const webhook = settings.webhooks.find(w => w.id === provider);
    if (webhook) {
      return { type: 'webhook' as const, webhook };
    }
    return { type: 'gemini' as const };
  }, [settings]);

  return {
    settings,
    isLoading: isLoading || authLoading,
    saveWebhook,
    deleteWebhook,
    getActiveWebhook,
    getWebhookById,
    setDefaultWebhook,
    clearAllSettings,
    saveSettings,
    updateVoiceSettings,
    isWebhookProvider,
    getTTSConfig,
    getSTTConfig,
    getConversationConfig,
  };
};
