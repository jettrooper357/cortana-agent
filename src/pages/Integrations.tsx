import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useN8n, N8nIntegrationInput } from '@/hooks/useN8n';
import { useHomeAssistant, HomeAssistantConfigInput } from '@/hooks/useHomeAssistant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, Webhook, Edit2, Play, Mail, Calendar, Zap, Home, RefreshCw, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

export default function Integrations() {
  const navigate = useNavigate();
  const { integrations, isLoading, addIntegration, updateIntegration, deleteIntegration, triggerWebhook } = useN8n();
  const { 
    config: haConfig, 
    entities: haEntities, 
    isLoading: haLoading, 
    saveConfig: saveHAConfig, 
    deleteConfig: deleteHAConfig,
    testConnection,
    syncEntities,
  } = useHomeAssistant();
  const { toast } = useToast();
  
  // n8n state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<N8nIntegrationInput>({
    name: '',
    webhook_url: '',
    type: 'custom',
    is_active: true,
  });

  // Home Assistant state
  const [isHADialogOpen, setIsHADialogOpen] = useState(false);
  const [haFormData, setHAFormData] = useState<HomeAssistantConfigInput>({
    instance_url: '',
    name: 'Home Assistant',
  });
  const [haToken, setHAToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isSyncing, setIsSyncing] = useState(false);

  const resetForm = () => {
    setFormData({
      name: '',
      webhook_url: '',
      type: 'custom',
      is_active: true,
    });
    setEditingId(null);
  };

  const resetHAForm = () => {
    setHAFormData({
      instance_url: haConfig?.instance_url || '',
      name: haConfig?.name || 'Home Assistant',
    });
    setHAToken('');
    setConnectionStatus('idle');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Integration name is required',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.webhook_url.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Webhook URL is required',
        variant: 'destructive',
      });
      return;
    }

    if (editingId) {
      const result = await updateIntegration(editingId, formData);
      if (result) {
        toast({
          title: 'Integration updated',
          description: `${formData.name} has been updated.`,
        });
      }
    } else {
      const result = await addIntegration(formData);
      if (result) {
        toast({
          title: 'Integration added',
          description: `${formData.name} has been added.`,
        });
      }
    }

    resetForm();
    setIsDialogOpen(false);
  };

  const handleEdit = (integration: typeof integrations[0]) => {
    setFormData({
      name: integration.name,
      webhook_url: integration.webhook_url,
      type: integration.type,
      is_active: integration.is_active,
    });
    setEditingId(integration.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    const result = await deleteIntegration(id);
    if (result) {
      toast({
        title: 'Integration deleted',
        description: `${name} has been removed.`,
      });
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await updateIntegration(id, { is_active: isActive });
  };

  const handleTrigger = async (id: string, name: string) => {
    toast({
      title: 'Triggering webhook...',
      description: `Sending request to ${name}`,
    });
    
    const result = await triggerWebhook(id);
    if (result) {
      toast({
        title: 'Webhook triggered',
        description: 'Request sent successfully.',
      });
    } else {
      toast({
        title: 'Webhook failed',
        description: 'Failed to trigger the webhook.',
        variant: 'destructive',
      });
    }
  };

  // Home Assistant handlers
  const handleTestHAConnection = async () => {
    if (!haFormData.instance_url || !haToken) {
      toast({
        title: 'Missing fields',
        description: 'Please enter both URL and access token',
        variant: 'destructive',
      });
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus('idle');

    const result = await testConnection(haFormData.instance_url, haToken);
    
    setConnectionStatus(result.success ? 'success' : 'error');
    setIsTestingConnection(false);

    toast({
      title: result.success ? 'Connection successful' : 'Connection failed',
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    });
  };

  const handleSaveHAConfig = async () => {
    if (!haFormData.instance_url) {
      toast({
        title: 'Missing URL',
        description: 'Please enter your Home Assistant URL',
        variant: 'destructive',
      });
      return;
    }

    const result = await saveHAConfig(haFormData);
    if (result) {
      toast({
        title: 'Configuration saved',
        description: 'Home Assistant connection saved.',
      });
      setIsHADialogOpen(false);
    }
  };

  const handleDeleteHAConfig = async () => {
    const result = await deleteHAConfig();
    if (result) {
      toast({
        title: 'Configuration deleted',
        description: 'Home Assistant connection removed.',
      });
    }
  };

  const handleSyncEntities = async () => {
    if (!haToken) {
      toast({
        title: 'Token required',
        description: 'Please enter your access token to sync',
        variant: 'destructive',
      });
      setIsHADialogOpen(true);
      return;
    }

    setIsSyncing(true);
    const result = await syncEntities(haToken);
    setIsSyncing(false);

    if (result.success) {
      toast({
        title: 'Sync complete',
        description: `Synced ${result.count} entities from Home Assistant.`,
      });
    } else {
      toast({
        title: 'Sync failed',
        description: 'Failed to sync entities.',
        variant: 'destructive',
      });
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'calendar': return <Calendar className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'email': return 'bg-blue-500/20 text-blue-500';
      case 'calendar': return 'bg-purple-500/20 text-purple-500';
      default: return 'bg-orange-500/20 text-orange-500';
    }
  };

  const domainCounts = haEntities.reduce((acc, entity) => {
    const domain = entity.domain || 'unknown';
    acc[domain] = (acc[domain] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Webhook className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-bold">Integrations</h1>
            </div>
          </div>
        </div>

        <Tabs defaultValue="home-assistant" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="home-assistant" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Home Assistant
            </TabsTrigger>
            <TabsTrigger value="n8n" className="flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              n8n Workflows
            </TabsTrigger>
          </TabsList>

          {/* Home Assistant Tab */}
          <TabsContent value="home-assistant" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5 text-cyan-500" />
                  Home Assistant Integration
                </CardTitle>
                <CardDescription>
                  Connect to your Home Assistant instance to monitor sensors, devices, and automate your home.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {haLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : haConfig ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-cyan-500/20">
                          <Home className="h-5 w-5 text-cyan-500" />
                        </div>
                        <div>
                          <p className="font-medium">{haConfig.name}</p>
                          <p className="text-sm text-muted-foreground">{haConfig.instance_url}</p>
                          {haConfig.last_connected_at && (
                            <p className="text-xs text-muted-foreground">
                              Last connected: {new Date(haConfig.last_connected_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSyncEntities}
                          disabled={isSyncing}
                        >
                          <RefreshCw className={`h-4 w-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                          Sync
                        </Button>
                        <Dialog open={isHADialogOpen} onOpenChange={(open) => {
                          setIsHADialogOpen(open);
                          if (open) resetHAForm();
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Edit2 className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Home Assistant</DialogTitle>
                              <DialogDescription>
                                Update your Home Assistant connection settings.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid gap-2">
                                <Label htmlFor="ha-name">Name</Label>
                                <Input
                                  id="ha-name"
                                  value={haFormData.name}
                                  onChange={(e) => setHAFormData({ ...haFormData, name: e.target.value })}
                                  placeholder="Home Assistant"
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="ha-url">Instance URL *</Label>
                                <Input
                                  id="ha-url"
                                  value={haFormData.instance_url}
                                  onChange={(e) => setHAFormData({ ...haFormData, instance_url: e.target.value })}
                                  placeholder="http://homeassistant.local:8123"
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="ha-token">
                                  Long-Lived Access Token *
                                  <span className="text-xs text-muted-foreground ml-2">(not stored)</span>
                                </Label>
                                <div className="relative">
                                  <Input
                                    id="ha-token"
                                    type={showToken ? 'text' : 'password'}
                                    value={haToken}
                                    onChange={(e) => setHAToken(e.target.value)}
                                    placeholder="eyJ0..."
                                    className="pr-10"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3"
                                    onClick={() => setShowToken(!showToken)}
                                  >
                                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Get this from Profile → Long-Lived Access Tokens in Home Assistant
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleTestHAConnection}
                                disabled={isTestingConnection}
                                className="w-full"
                              >
                                {isTestingConnection ? (
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                ) : connectionStatus === 'success' ? (
                                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                                ) : connectionStatus === 'error' ? (
                                  <XCircle className="h-4 w-4 mr-2 text-red-500" />
                                ) : null}
                                Test Connection
                              </Button>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setIsHADialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button onClick={handleSaveHAConfig}>
                                Save
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDeleteHAConfig}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Entity Summary */}
                    {haEntities.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Synced Entities ({haEntities.length})</h4>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(domainCounts).map(([domain, count]) => (
                            <Badge key={domain} variant="secondary">
                              {domain}: {count}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Home className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Home Assistant connected</h3>
                    <p className="text-muted-foreground mb-4">
                      Connect your Home Assistant instance to enable home monitoring.
                    </p>
                    <Dialog open={isHADialogOpen} onOpenChange={(open) => {
                      setIsHADialogOpen(open);
                      if (open) resetHAForm();
                    }}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Connect Home Assistant
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Connect Home Assistant</DialogTitle>
                          <DialogDescription>
                            Enter your Home Assistant URL and a long-lived access token.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label htmlFor="ha-name">Name</Label>
                            <Input
                              id="ha-name"
                              value={haFormData.name}
                              onChange={(e) => setHAFormData({ ...haFormData, name: e.target.value })}
                              placeholder="Home Assistant"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="ha-url">Instance URL *</Label>
                            <Input
                              id="ha-url"
                              value={haFormData.instance_url}
                              onChange={(e) => setHAFormData({ ...haFormData, instance_url: e.target.value })}
                              placeholder="http://homeassistant.local:8123"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="ha-token">
                              Long-Lived Access Token *
                              <span className="text-xs text-muted-foreground ml-2">(not stored)</span>
                            </Label>
                            <div className="relative">
                              <Input
                                id="ha-token"
                                type={showToken ? 'text' : 'password'}
                                value={haToken}
                                onChange={(e) => setHAToken(e.target.value)}
                                placeholder="eyJ0..."
                                className="pr-10"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowToken(!showToken)}
                              >
                                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Get this from Profile → Long-Lived Access Tokens in Home Assistant
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleTestHAConnection}
                            disabled={isTestingConnection}
                            className="w-full"
                          >
                            {isTestingConnection ? (
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : connectionStatus === 'success' ? (
                              <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                            ) : connectionStatus === 'error' ? (
                              <XCircle className="h-4 w-4 mr-2 text-red-500" />
                            ) : null}
                            Test Connection
                          </Button>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsHADialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleSaveHAConfig}>
                            Connect
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* n8n Tab */}
          <TabsContent value="n8n" className="space-y-6">
            <div className="flex justify-end">
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Integration
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <form onSubmit={handleSubmit}>
                    <DialogHeader>
                      <DialogTitle>
                        {editingId ? 'Edit Integration' : 'Add n8n Integration'}
                      </DialogTitle>
                      <DialogDescription>
                        Connect to your n8n workflows for email, calendar, and more
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Email Sync"
                        />
                      </div>
                      
                      <div className="grid gap-2">
                        <Label htmlFor="type">Type</Label>
                        <Select
                          value={formData.type}
                          onValueChange={(value) => setFormData({ ...formData, type: value as 'email' | 'calendar' | 'custom' })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="calendar">Calendar</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="grid gap-2">
                        <Label htmlFor="webhook_url">Webhook URL *</Label>
                        <Input
                          id="webhook_url"
                          value={formData.webhook_url}
                          onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                          placeholder="https://your-n8n-instance.com/webhook/..."
                        />
                      </div>
                      
                      <div className="flex items-center justify-between rounded-lg border p-4">
                        <Label htmlFor="is_active">Active</Label>
                        <Switch
                          id="is_active"
                          checked={formData.is_active}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                        />
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        {editingId ? 'Update' : 'Add'} Integration
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">About n8n Integrations</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="mb-2">
                  n8n is a workflow automation tool that can connect to your email, calendar, and other services.
                </p>
                <p>
                  Create workflows in n8n and add the webhook URLs here to enable Cortana to access your data.
                </p>
              </CardContent>
            </Card>

            {/* Integrations List */}
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading integrations...</p>
              </div>
            ) : integrations.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Webhook className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No integrations configured</h3>
                  <p className="text-muted-foreground mb-4">
                    Add your first n8n integration to connect to external services
                  </p>
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Integration
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {integrations.map((integration) => (
                  <Card key={integration.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${getTypeColor(integration.type)}`}>
                            {getTypeIcon(integration.type)}
                          </div>
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              {integration.name}
                              <Badge className={getTypeColor(integration.type)}>
                                {integration.type}
                              </Badge>
                            </CardTitle>
                            <CardDescription className="truncate max-w-md">
                              {integration.webhook_url}
                            </CardDescription>
                          </div>
                        </div>
                        <Switch
                          checked={integration.is_active}
                          onCheckedChange={(checked) => handleToggleActive(integration.id, checked)}
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          {integration.last_sync && (
                            <span>Last synced: {new Date(integration.last_sync).toLocaleString()}</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTrigger(integration.id, integration.name)}
                            disabled={!integration.is_active}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Test
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(integration)}
                          >
                            <Edit2 className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(integration.id, integration.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
