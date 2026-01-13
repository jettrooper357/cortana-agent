import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings, WebhookSettings } from '@/hooks/useSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, Settings as SettingsIcon, Volume2, Mic, ChevronDown } from 'lucide-react';
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

type WebhookFormData = z.infer<typeof webhookSchema>;

export default function Settings() {
  const navigate = useNavigate();
  const { settings, saveWebhook, deleteWebhook, clearAllSettings, updateVoiceSettings } = useSettings();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isWebhookFormOpen, setIsWebhookFormOpen] = useState(false);

  const form = useForm<WebhookFormData>({
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

  const handleSubmit = (data: WebhookFormData) => {
    try {
      // Enhanced validation
      if (data.type === 'elevenlabs' && !data.agentId?.trim()) {
        toast({
          title: "Validation Error",
          description: "Agent ID is required for ElevenLabs webhooks",
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
        id: isEditing || crypto.randomUUID(),
        name: data.name,
        type: data.type,
        agentId: data.agentId,
        apiKey: data.apiKey,
        webhookUrl: data.webhookUrl,
        isActive: data.isActive
      };
      
      console.log('Saving webhook:', webhook);
      saveWebhook(webhook);
      
      toast({
        title: isEditing ? 'Webhook updated' : 'Webhook added',
        description: `${data.name} has been ${isEditing ? 'updated' : 'added'} successfully.`
      });
      
      setIsEditing(null);
      form.reset();
    } catch (error) {
      console.error('Error saving webhook:', error);
      toast({
        title: 'Error',
        description: 'Failed to save webhook. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (webhook: WebhookSettings) => {
    setIsEditing(webhook.id);
    form.reset({
      name: webhook.name,
      type: webhook.type,
      agentId: webhook.agentId || '',
      apiKey: webhook.apiKey || '',
      webhookUrl: webhook.webhookUrl || '',
      isActive: webhook.isActive
    });
  };

  const handleDelete = (id: string) => {
    deleteWebhook(id);
    toast({
      title: 'Webhook deleted',
      description: 'The webhook has been removed successfully.'
    });
  };

  const handleClearAll = () => {
    clearAllSettings();
    toast({
      title: 'Settings cleared',
      description: 'All settings have been reset to defaults.'
    });
  };

  const watchedType = form.watch('type');

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

        {/* Voice Settings */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Voice Settings
            </CardTitle>
            <CardDescription>
              Select which service to use for text-to-speech and speech-to-text
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  Text-to-Speech
                </Label>
                <Select
                  value={settings.voice?.ttsWebhookId || 'browser'}
                  onValueChange={(value: string) => {
                    updateVoiceSettings({ ttsWebhookId: value });
                    const webhook = settings.webhooks.find(w => w.id === value);
                    const providerName = value === 'browser' ? 'Browser (free)' : value === 'gemini' ? 'Gemini 2.5' : webhook?.name || 'selected service';
                    toast({
                      title: 'TTS Updated',
                      description: `Now using ${providerName} for text-to-speech`,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select TTS provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="browser">
                      <div className="flex flex-col items-start">
                        <span>Browser (Free)</span>
                        <span className="text-xs text-muted-foreground">Built-in browser voices</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="gemini">
                      <div className="flex flex-col items-start">
                        <span>Gemini 2.5 (Built-in)</span>
                        <span className="text-xs text-muted-foreground">Real-time AI voice via Lovable AI</span>
                      </div>
                    </SelectItem>
                    {settings.webhooks.map((webhook) => (
                      <SelectItem key={webhook.id} value={webhook.id}>
                        <div className="flex flex-col items-start">
                          <span>{webhook.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {webhook.type.charAt(0).toUpperCase() + webhook.type.slice(1)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  Speech-to-Text
                </Label>
                <Select
                  value={settings.voice?.sttWebhookId || 'browser'}
                  onValueChange={(value: string) => {
                    updateVoiceSettings({ sttWebhookId: value });
                    const webhook = settings.webhooks.find(w => w.id === value);
                    const providerName = value === 'browser' ? 'Browser (free)' : value === 'gemini' ? 'Gemini 2.5' : webhook?.name || 'selected service';
                    toast({
                      title: 'STT Updated',
                      description: `Now using ${providerName} for speech recognition`,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select STT provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="browser">
                      <div className="flex flex-col items-start">
                        <span>Browser (Free)</span>
                        <span className="text-xs text-muted-foreground">Built-in browser speech recognition</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="gemini">
                      <div className="flex flex-col items-start">
                        <span>Gemini 2.5 (Built-in)</span>
                        <span className="text-xs text-muted-foreground">Real-time AI transcription via Lovable AI</span>
                      </div>
                    </SelectItem>
                    {settings.webhooks.filter(w => w.type === 'elevenlabs').map((webhook) => (
                      <SelectItem key={webhook.id} value={webhook.id}>
                        <div className="flex flex-col items-start">
                          <span>{webhook.name}</span>
                          <span className="text-xs text-muted-foreground">ElevenLabs Scribe</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {settings.webhooks.length === 0 && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>No webhooks configured.</strong> Add a webhook below to enable premium AI voices from ElevenLabs or other services.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Webhook Configuration */}
        <Collapsible open={isWebhookFormOpen || !!isEditing} onOpenChange={setIsWebhookFormOpen}>
          <Card className="mb-8">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      {isEditing ? 'Edit Webhook' : 'Add New Webhook'}
                    </CardTitle>
                    <CardDescription>
                      Configure your AI voice assistant connections
                    </CardDescription>
                  </div>
                  <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${isWebhookFormOpen || isEditing ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="My AI Assistant" {...field} />
                            </FormControl>
                            <FormDescription>
                              A friendly name for this webhook
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
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

                      {watchedType === 'elevenlabs' && (
                        <FormField
                          control={form.control}
                          name="agentId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Agent ID</FormLabel>
                              <FormControl>
                                <Input placeholder="agent_01jzp3zn2dek1vk4ztygtxzna6" {...field} />
                              </FormControl>
                              <FormDescription>
                                Your ElevenLabs agent ID
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {(watchedType === 'openai' || watchedType === 'elevenlabs') && (
                        <FormField
                          control={form.control}
                          name="apiKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>API Key</FormLabel>
                              <FormControl>
                                <Input 
                                  type="password" 
                                  placeholder="sk-..." 
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                Your API key for {watchedType === 'openai' ? 'OpenAI' : 'ElevenLabs'}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {watchedType === 'custom' && (
                        <FormField
                          control={form.control}
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
                        control={form.control}
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
                        {isEditing ? 'Update Webhook' : 'Add Webhook'}
                      </Button>
                      {isEditing && (
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => {
                            setIsEditing(null);
                            form.reset();
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
                      <h3 className="font-semibold">{webhook.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {webhook.type.charAt(0).toUpperCase() + webhook.type.slice(1)}
                        {webhook.isActive && (
                          <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-ai-glow/20 text-ai-glow">
                            Active
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(webhook)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(webhook.id)}
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
              Irreversible actions that will affect all your settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={handleClearAll}
              className="w-full"
            >
              Clear All Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
