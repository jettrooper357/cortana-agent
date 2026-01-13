import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Json } from '@/integrations/supabase/types';

export type WebhookType = 'elevenlabs' | 'openai' | 'custom';
export type ConversationalAIType = 'gemini' | 'chatgpt' | 'claude' | 'custom';

export interface WebhookSettings {
  id: string;
  name: string;
  type: WebhookType;
  agentId?: string; // For ElevenLabs conversational agents
  voiceId?: string; // For ElevenLabs TTS voices (different from agentId!)
  apiKey?: string;
  webhookUrl?: string;
  isActive: boolean;
}

// Conversational AI configuration (like webhooks but for AI models)
export interface ConversationalAISettings {
  id: string;
  name: string;
  type: ConversationalAIType;
  apiKey?: string; // Optional - some don't need it (e.g., Gemini via Lovable)
  model?: string; // Optional model override
  ttsWebhookId?: string; // Optional - use a specific TTS webhook instead of browser
  isActive: boolean;
}

// Voice settings - single provider selection
// Provider can be: 'browser', conversational AI ID, or webhook ID
export interface VoiceSettings {
  provider: string; // 'browser' or an ID from conversationalAIs or webhooks
}

export interface AppSettings {
  webhooks: WebhookSettings[];
  conversationalAIs: ConversationalAISettings[];
  defaultWebhook?: string;
  voice: VoiceSettings;
}

const DEFAULT_GEMINI_AI: ConversationalAISettings = {
  id: 'gemini-default',
  name: 'Gemini AI',
  type: 'gemini',
  isActive: true,
};

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  provider: 'gemini-default', // Default to built-in Gemini
};

const DEFAULT_SETTINGS: AppSettings = {
  webhooks: [],
  conversationalAIs: [DEFAULT_GEMINI_AI],
  defaultWebhook: undefined,
  voice: DEFAULT_VOICE_SETTINGS,
};

const SETTINGS_KEY = 'cortana-app-settings';

// Helper to migrate old settings format to new format
function migrateVoiceSettings(oldVoice: any): VoiceSettings {
  if (!oldVoice) return DEFAULT_VOICE_SETTINGS;
  
  // Check if already in new format with 'provider'
  if ('provider' in oldVoice) {
    return { provider: oldVoice.provider || 'gemini-default' };
  }
  
  // Migrate from old format (ttsProvider/conversationProvider)
  if ('conversationProvider' in oldVoice) {
    return { provider: oldVoice.conversationProvider || 'gemini-default' };
  }
  
  // Very old format
  return DEFAULT_VOICE_SETTINGS;
}

// Helper to migrate conversational AIs
function migrateConversationalAIs(settings: any): ConversationalAISettings[] {
  if (settings.conversationalAIs && settings.conversationalAIs.length > 0) {
    return settings.conversationalAIs;
  }
  // Add default Gemini if not present
  return [DEFAULT_GEMINI_AI];
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
    
    // Reset voice settings if they referenced this webhook or conversational AI
    if (newSettings.voice.provider === id) {
      newSettings.voice.provider = 'gemini-default';
    }
    
    // Also remove from conversationalAIs if it's there
    newSettings.conversationalAIs = newSettings.conversationalAIs.filter(ai => ai.id !== id);
    
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

  // Get conversational AI by ID
  const getConversationalAIById = useCallback((id: string): ConversationalAISettings | undefined => {
    return settings.conversationalAIs.find(ai => ai.id === id);
  }, [settings.conversationalAIs]);

  // Save conversational AI
  const saveConversationalAI = useCallback(async (ai: ConversationalAISettings) => {
    const newSettings = { ...settings };
    const existingIndex = newSettings.conversationalAIs.findIndex(a => a.id === ai.id);
    
    if (existingIndex >= 0) {
      newSettings.conversationalAIs[existingIndex] = ai;
    } else {
      newSettings.conversationalAIs.push(ai);
    }
    
    await saveSettings(newSettings);
  }, [settings, saveSettings]);

  // Delete conversational AI
  const deleteConversationalAI = useCallback(async (id: string) => {
    // Don't allow deleting the default Gemini
    if (id === 'gemini-default') return;
    
    const newSettings = { ...settings };
    newSettings.conversationalAIs = newSettings.conversationalAIs.filter(ai => ai.id !== id);
    
    // Reset voice provider if it referenced this AI
    if (newSettings.voice.provider === id) {
      newSettings.voice.provider = 'gemini-default';
    }
    
    await saveSettings(newSettings);
  }, [settings, saveSettings]);

  // Get the voice provider configuration (unified - determines what mode to use)
  const getVoiceProviderConfig = useCallback(() => {
    const providerId = settings.voice.provider;
    
    // Check if it's 'browser'
    if (providerId === 'browser') {
      return { type: 'browser' as const, ttsWebhook: undefined };
    }
    
    // Check if it's a conversational AI
    const conversationalAI = settings.conversationalAIs.find(ai => ai.id === providerId);
    if (conversationalAI) {
      // If the conversational AI has a TTS webhook configured, include it
      const ttsWebhook = conversationalAI.ttsWebhookId 
        ? settings.webhooks.find(w => w.id === conversationalAI.ttsWebhookId && w.type === 'elevenlabs')
        : undefined;
      return { type: 'conversational-ai' as const, ai: conversationalAI, ttsWebhook };
    }
    
    // Check if it's a webhook (ElevenLabs agent, etc.)
    const webhook = settings.webhooks.find(w => w.id === providerId);
    if (webhook) {
      return { type: 'webhook' as const, webhook, ttsWebhook: webhook.type === 'elevenlabs' ? webhook : undefined };
    }
    
    // Default to first conversational AI (Gemini)
    return { type: 'conversational-ai' as const, ai: settings.conversationalAIs[0] || DEFAULT_GEMINI_AI, ttsWebhook: undefined };
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
    // Conversational AI management
    getConversationalAIById,
    saveConversationalAI,
    deleteConversationalAI,
    // Voice provider config
    getVoiceProviderConfig,
  };
};
