import { useState, useEffect } from 'react';

export interface WebhookSettings {
  id: string;
  name: string;
  type: 'elevenlabs' | 'openai' | 'custom';
  agentId?: string;
  apiKey?: string;
  webhookUrl?: string;
  isActive: boolean;
}

export interface AppSettings {
  webhooks: WebhookSettings[];
  defaultWebhook?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  webhooks: [],
  defaultWebhook: undefined
};

const SETTINGS_KEY = 'cortana-app-settings';

export const useSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = (newSettings: AppSettings) => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  };

  // Add or update webhook
  const saveWebhook = (webhook: WebhookSettings) => {
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
    
    saveSettings(newSettings);
  };

  // Delete webhook
  const deleteWebhook = (id: string) => {
    const newSettings = { ...settings };
    newSettings.webhooks = newSettings.webhooks.filter(w => w.id !== id);
    
    // If deleted webhook was default, set first remaining as default
    if (newSettings.defaultWebhook === id) {
      newSettings.defaultWebhook = newSettings.webhooks.length > 0 ? newSettings.webhooks[0].id : undefined;
      if (newSettings.webhooks.length > 0) {
        newSettings.webhooks[0].isActive = true;
      }
    }
    
    saveSettings(newSettings);
  };

  // Get active webhook
  const getActiveWebhook = (): WebhookSettings | undefined => {
    return settings.webhooks.find(w => w.isActive);
  };

  // Get webhook by ID
  const getWebhookById = (id: string): WebhookSettings | undefined => {
    return settings.webhooks.find(w => w.id === id);
  };

  // Set default webhook
  const setDefaultWebhook = (id: string) => {
    const newSettings = { ...settings };
    newSettings.defaultWebhook = id;
    newSettings.webhooks = newSettings.webhooks.map(w => ({
      ...w,
      isActive: w.id === id
    }));
    
    saveSettings(newSettings);
  };

  // Clear all settings
  const clearAllSettings = () => {
    localStorage.removeItem(SETTINGS_KEY);
    setSettings(DEFAULT_SETTINGS);
  };

  return {
    settings,
    isLoading,
    saveWebhook,
    deleteWebhook,
    getActiveWebhook,
    getWebhookById,
    setDefaultWebhook,
    clearAllSettings,
    saveSettings
  };
};