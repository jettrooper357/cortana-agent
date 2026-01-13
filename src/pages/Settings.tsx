import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings, WebhookSettings, ConversationalAISettings, ConversationalAIType } from '@/hooks/useSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, Settings as SettingsIcon, Volume2, Mic, ChevronDown, Bot, Sparkles, Brain } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const webhookSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['elevenlabs', 'openai', 'custom']),
  agentId: z.string().optional(),
  apiKey: z.string().optional(),
  webhookUrl: z.string().optional(),
  isActive: z.boolean().default(false)
});

const conversationalAISchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['gemini', 'chatgpt', 'claude', 'custom']),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  ttsWebhookId: z.string().optional(),
  isActive: z.boolean().default(false)
});

type WebhookFormData = z.infer<typeof webhookSchema>;
type ConversationalAIFormData = z.infer<typeof conversationalAISchema>;

export default function Settings() {
  const navigate = useNavigate();
  const { 
    settings, 
    saveWebhook, 
    deleteWebhook, 
    saveConversationalAI, 
    deleteConversationalAI,
    clearAllSettings, 
    updateVoiceSettings 
  } = useSettings();
  const { toast } = useToast();
  
  const [isEditingWebhook, setIsEditingWebhook] = useState<string | null>(null);
  const [isEditingAI, setIsEditingAI] = useState<string | null>(null);
  const [isWebhookFormOpen, setIsWebhookFormOpen] = useState(false);
  const [isAIFormOpen, setIsAIFormOpen] = useState(false);

  const webhookForm = useForm<WebhookFormData>({
    resolver: zodResolver(webhookSchema),
    defaultValues: {
      name: '',
      type: 'elevenlabs',
      agentId: '',
      apiKey: '',
      webhookUrl: '',
      isActive: false
    }
  });

  const aiForm = useForm<ConversationalAIFormData>({
    resolver: zodResolver(conversationalAISchema),
    defaultValues: {
      name: '',
      type: 'gemini',
      apiKey: '',
      model: '',
      ttsWebhookId: '',
      isActive: false
    }
  });

  // Submit webhook
  const handleWebhookSubmit = (data: WebhookFormData) => {
    try {
      if (data.type === 'elevenlabs' && !data.agentId?.trim()) {
        toast({
          title: "Validation Error",
          description: "Voice ID is required for ElevenLabs webhooks",
          variant: "destructive",
        });
        return;
      }
      
      if (data.type === 'openai' && !data.agentId?.trim()) {
        toast({
          title: "Validation Error", 
          description: "Agent ID is required for OpenAI webhooks",
          variant: "destructive",
        });
        return;
      }
      
      if (data.type === 'custom' && !data.webhookUrl?.trim()) {
        toast({
          title: "Validation Error",
          description: "Webhook URL is required for custom webhooks", 
          variant: "destructive",
        });
        return;
      }
      
      const webhook: WebhookSettings = {
        id: isEditingWebhook || crypto.randomUUID(),
        name: data.name,
        type: data.type,
        agentId: data.agentId,
        apiKey: data.apiKey,
        webhookUrl: data.webhookUrl,
        isActive: data.isActive
      };
      
      saveWebhook(webhook);
      
      toast({
        title: isEditingWebhook ? 'Webhook updated' : 'Webhook added',
        description: `${data.name} has been ${isEditingWebhook ? 'updated' : 'added'} successfully.`
      });
      
      setIsEditingWebhook(null);
      webhookForm.reset();
    } catch (error) {
      console.error('Error saving webhook:', error);
      toast({
        title: 'Error',
        description: 'Failed to save webhook. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Submit conversational AI
  const handleAISubmit = (data: ConversationalAIFormData) => {
    try {
      // ChatGPT and Claude require API keys
      if ((data.type === 'chatgpt' || data.type === 'claude') && !data.apiKey?.trim()) {
        toast({
          title: "Validation Error",
          description: `API Key is required for ${data.type === 'chatgpt' ? 'ChatGPT' : 'Claude'}`,
          variant: "destructive",
        });
        return;
      }
      
      const ai: ConversationalAISettings = {
        id: isEditingAI || crypto.randomUUID(),
        name: data.name,
        type: data.type as ConversationalAIType,
        apiKey: data.apiKey,
        model: data.model,
        ttsWebhookId: data.ttsWebhookId || undefined,
        isActive: data.isActive
      };
      
      saveConversationalAI(ai);
      
      toast({
        title: isEditingAI ? 'AI updated' : 'AI added',
        description: `${data.name} has been ${isEditingAI ? 'updated' : 'added'} successfully.`
      });
      
      setIsEditingAI(null);
      aiForm.reset();
      setIsAIFormOpen(false);
    } catch (error) {
      console.error('Error saving AI:', error);
      toast({
        title: 'Error',
        description: 'Failed to save AI configuration. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleEditWebhook = (webhook: WebhookSettings) => {
    setIsEditingWebhook(webhook.id);
    webhookForm.reset({
      name: webhook.name,
      type: webhook.type,
      agentId: webhook.agentId || '',
      apiKey: webhook.apiKey || '',
      webhookUrl: webhook.webhookUrl || '',
      isActive: webhook.isActive
    });
    setIsWebhookFormOpen(true);
  };

  const handleEditAI = (ai: ConversationalAISettings) => {
    if (ai.id === 'gemini-default') {
      toast({
        title: "Cannot edit",
        description: "The default Gemini AI cannot be edited.",
        variant: "destructive",
      });
      return;
    }
    setIsEditingAI(ai.id);
    aiForm.reset({
      name: ai.name,
      type: ai.type,
      apiKey: ai.apiKey || '',
      model: ai.model || '',
      ttsWebhookId: ai.ttsWebhookId || '',
      isActive: ai.isActive
    });
    setIsAIFormOpen(true);
  };

  const handleDeleteWebhook = (id: string) => {
    deleteWebhook(id);
    toast({
      title: 'Webhook deleted',
      description: 'The webhook has been removed successfully.'
    });
  };

  const handleDeleteAI = (id: string) => {
    if (id === 'gemini-default') {
      toast({
        title: "Cannot delete",
        description: "The default Gemini AI cannot be deleted.",
        variant: "destructive",
      });
      return;
    }
    deleteConversationalAI(id);
    toast({
      title: 'AI removed',
      description: 'The conversational AI has been removed successfully.'
    });
  };

  const handleClearAll = () => {
    clearAllSettings();
    toast({
      title: 'Settings cleared',
      description: 'All settings have been reset to defaults.'
    });
  };

  const watchedWebhookType = webhookForm.watch('type');
  const watchedAIType = aiForm.watch('type');

  // Build unified voice provider options
  const voiceProviderOptions = [
    { id: 'browser', name: 'Browser (Free)', description: 'Built-in browser TTS/STT only', type: 'browser' },
    ...settings.conversationalAIs.map(ai => ({
      id: ai.id,
      name: ai.name,
      description: ai.type === 'gemini' ? 'Lovable AI (no API key needed)' : `${ai.type.toUpperCase()} AI`,
      type: 'ai'
    })),
    ...settings.webhooks.filter(w => w.type === 'elevenlabs').map(w => ({
      id: w.id,
      name: w.name,
      description: 'ElevenLabs Conversational Agent',
      type: 'webhook'
    })),
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-ai-glow" />
            <h1 className="text-3xl font-bold">Settings</h1>
          </div>
        </div>

        {/* Voice Provider Selection - SINGLE DROPDOWN */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Voice Provider
            </CardTitle>
            <CardDescription>
              Select how Cortana should speak and listen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                Active Provider
              </Label>
              <Select
                value={settings.voice?.provider || 'gemini-default'}
                onValueChange={(value: string) => {
                  updateVoiceSettings({ provider: value });
                  const option = voiceProviderOptions.find(o => o.id === value);
                  toast({
                    title: 'Voice Provider Updated',
                    description: `Now using ${option?.name || 'selected provider'}`,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select voice provider" />
                </SelectTrigger>
                <SelectContent>
                  {voiceProviderOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      <div className="flex flex-col items-start">
                        <span>{option.name}</span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                Add more options below in "Conversational AI" or "Webhooks" sections
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Conversational AI Setup */}
        <Collapsible open={isAIFormOpen || !!isEditingAI} onOpenChange={setIsAIFormOpen}>
          <Card className="mb-8">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      {isEditingAI ? 'Edit Conversational AI' : 'Add Conversational AI'}
                    </CardTitle>
                    <CardDescription>
                      Configure AI models like Gemini, ChatGPT, Claude
                    </CardDescription>
                  </div>
                  <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${isAIFormOpen || isEditingAI ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <Form {...aiForm}>
                  <form onSubmit={aiForm.handleSubmit(handleAISubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={aiForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="My ChatGPT" {...field} />
                            </FormControl>
                            <FormDescription>
                              A friendly name for this AI
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={aiForm.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>AI Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select AI type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="gemini">Gemini (Lovable AI - Free)</SelectItem>
                                <SelectItem value="chatgpt">ChatGPT (Requires API Key)</SelectItem>
                                <SelectItem value="claude">Claude (Requires API Key)</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Choose the AI provider
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={aiForm.control}
                        name="apiKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {watchedAIType === 'gemini' ? 'Google API Key (Optional)' : 'API Key'}
                            </FormLabel>
                            <FormControl>
                              <Input type="password" placeholder={watchedAIType === 'gemini' ? 'For Live Audio (optional)' : 'sk-...'} {...field} />
                            </FormControl>
                            <FormDescription>
                              {watchedAIType === 'gemini' 
                                ? 'Optional: Provide a Google API key for real-time bidirectional audio. Without it, browser STT + AI text + TTS will be used.'
                                : 'Your API key for this provider'
                              }
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={aiForm.control}
                        name="model"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Model (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="gpt-4, claude-3-opus, etc." {...field} />
                            </FormControl>
                            <FormDescription>
                              Override the default model
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* TTS Webhook Selection */}
                      <FormField
                        control={aiForm.control}
                        name="ttsWebhookId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>TTS Voice (Optional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Use browser TTS" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">Browser TTS (Default)</SelectItem>
                                {settings.webhooks.filter(w => w.type === 'elevenlabs').map((webhook) => (
                                  <SelectItem key={webhook.id} value={webhook.id}>
                                    {webhook.name} (ElevenLabs)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Choose a voice for AI responses. Add ElevenLabs webhooks below for more options.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={aiForm.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Active</FormLabel>
                              <FormDescription>
                                Set as the active AI
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex gap-4">
                      <Button type="submit">
                        {isEditingAI ? 'Update AI' : 'Add AI'}
                      </Button>
                      {isEditingAI && (
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => {
                            setIsEditingAI(null);
                            aiForm.reset();
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </form>
                </Form>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Configured Conversational AIs */}
        {settings.conversationalAIs.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Configured AI Models
              </CardTitle>
              <CardDescription>
                Manage your conversational AI configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {settings.conversationalAIs.map((ai) => (
                  <div key={ai.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{ai.name}</h3>
                        {ai.id === 'gemini-default' && (
                          <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                            Default
                          </span>
                        )}
                        {settings.voice?.provider === ai.id && (
                          <span className="px-2 py-0.5 text-xs bg-ai-glow/20 text-ai-glow rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {ai.type === 'gemini' && (ai.apiKey ? 'Gemini Live Audio' : 'Gemini AI (Browser STT)')}
                        {ai.type === 'chatgpt' && 'ChatGPT'}
                        {ai.type === 'claude' && 'Claude'}
                        {ai.type === 'custom' && 'Custom AI'}
                        {ai.model && ` • Model: ${ai.model}`}
                        {ai.ttsWebhookId && ` • TTS: ${settings.webhooks.find(w => w.id === ai.ttsWebhookId)?.name || 'Custom'}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {ai.id !== 'gemini-default' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditAI(ai)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => handleDeleteAI(ai.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Webhook Configuration */}
        <Collapsible open={isWebhookFormOpen || !!isEditingWebhook} onOpenChange={setIsWebhookFormOpen}>
          <Card className="mb-8">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      {isEditingWebhook ? 'Edit Webhook' : 'Add Webhook'}
                    </CardTitle>
                    <CardDescription>
                      Configure ElevenLabs agents and other voice webhooks
                    </CardDescription>
                  </div>
                  <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${isWebhookFormOpen || isEditingWebhook ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <Form {...webhookForm}>
                  <form onSubmit={webhookForm.handleSubmit(handleWebhookSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={webhookForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Cortana Voice" {...field} />
                            </FormControl>
                            <FormDescription>
                              A friendly name for this webhook
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={webhookForm.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select webhook type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                                <SelectItem value="openai">OpenAI</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Choose the AI service provider
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {watchedWebhookType === 'elevenlabs' && (
                        <FormField
                          control={webhookForm.control}
                          name="agentId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Voice ID / Agent ID</FormLabel>
                              <FormControl>
                                <Input placeholder="JBFqnCBsd6RMkjVDRZzb" {...field} />
                              </FormControl>
                              <FormDescription>
                                For TTS: Voice ID. For Agent: Agent ID
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {watchedWebhookType === 'openai' && (
                        <FormField
                          control={webhookForm.control}
                          name="agentId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Agent ID</FormLabel>
                              <FormControl>
                                <Input placeholder="asst_..." {...field} />
                              </FormControl>
                              <FormDescription>
                                Your OpenAI assistant ID
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {watchedWebhookType === 'custom' && (
                        <FormField
                          control={webhookForm.control}
                          name="webhookUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Webhook URL</FormLabel>
                              <FormControl>
                                <Input placeholder="https://api.example.com/webhook" {...field} />
                              </FormControl>
                              <FormDescription>
                                Your custom webhook endpoint URL
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={webhookForm.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Active</FormLabel>
                              <FormDescription>
                                Set this webhook as the active one
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex gap-4">
                      <Button type="submit">
                        {isEditingWebhook ? 'Update Webhook' : 'Add Webhook'}
                      </Button>
                      {isEditingWebhook && (
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => {
                            setIsEditingWebhook(null);
                            webhookForm.reset();
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </form>
                </Form>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Existing Webhooks */}
        {settings.webhooks.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Configured Webhooks</CardTitle>
              <CardDescription>
                Manage your existing webhook connections
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {settings.webhooks.map((webhook) => (
                  <div key={webhook.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{webhook.name}</h3>
                        {settings.voice?.provider === webhook.id && (
                          <span className="px-2 py-0.5 text-xs bg-ai-glow/20 text-ai-glow rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {webhook.type === 'elevenlabs' && 'ElevenLabs'}
                        {webhook.type === 'openai' && 'OpenAI'}
                        {webhook.type === 'custom' && 'Custom'}
                        {webhook.agentId && ` • ID: ${webhook.agentId.substring(0, 8)}...`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditWebhook(webhook)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteWebhook(webhook.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleClearAll}>
              Clear All Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
