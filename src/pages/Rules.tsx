import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRules, RuleInput, RuleAction, RuleCondition, Rule } from '@/hooks/useRules';
import { useGoals } from '@/hooks/useGoals';
import { useCameras } from '@/hooks/useCameras';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, Plus, Trash2, Zap, Play, Pause, Settings2, 
  Clock, Eye, Home, Target, Bell, Volume2, ListTodo, ChevronDown, ChevronUp
} from 'lucide-react';
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const TRIGGER_TYPES = [
  { value: 'schedule', label: 'Schedule', icon: Clock, description: 'Time-based trigger' },
  { value: 'task_state', label: 'Task State', icon: ListTodo, description: 'When task status changes' },
  { value: 'goal_state', label: 'Goal State', icon: Target, description: 'Goal progress trigger' },
  { value: 'home_assistant', label: 'Home Assistant', icon: Home, description: 'Sensor/device events' },
  { value: 'camera', label: 'Camera', icon: Eye, description: 'Visual detection' },
  { value: 'manual', label: 'Manual', icon: Play, description: 'User-triggered signal' },
];

const ACTION_TYPES = [
  { value: 'speak', label: 'Speak', icon: Volume2 },
  { value: 'notify', label: 'Notify', icon: Bell },
  { value: 'create_task', label: 'Create Task', icon: ListTodo },
  { value: 'home_assistant', label: 'Home Assistant', icon: Home },
  { value: 'n8n_webhook', label: 'n8n Workflow', icon: Zap },
];

const CATEGORIES = ['security', 'routine', 'chore', 'energy', 'health', 'custom'];
const SEVERITIES = ['info', 'nudge', 'warning', 'urgent'];

const RULE_TEMPLATES = [
  {
    name: 'Idle Detection',
    category: 'routine',
    trigger_type: 'schedule' as const,
    trigger_config: { cron: '*/5 * * * *' },
    conditions: [{ type: 'idle_minutes' as const, operator: 'greater_than' as const, value: 10 }],
    actions: [{ type: 'speak' as const, config: { message: "You've been idle. What should you be doing right now?" } }],
    explanation_template: "Because you've been idle for {idle_minutes} minutes.",
  },
  {
    name: 'Overdue Task Alert',
    category: 'routine',
    trigger_type: 'task_state' as const,
    trigger_config: { status: 'pending', overdue_minutes: 30 },
    conditions: [],
    actions: [{ type: 'speak' as const, config: { message: "You have an overdue task that needs attention." } }],
    explanation_template: "Because a task is overdue.",
  },
  {
    name: 'Evening Routine',
    category: 'routine',
    trigger_type: 'schedule' as const,
    trigger_config: { cron: '0 21 * * *' },
    conditions: [{ type: 'time_of_day' as const, operator: 'equals' as const, value: 'evening' }],
    actions: [
      { type: 'speak' as const, config: { message: "Time to wind down. Have you prepared for tomorrow?" } },
      { type: 'home_assistant' as const, config: { domain: 'light', service: 'turn_on', entity_id: 'light.bedroom', service_data: { brightness: 50 } } },
    ],
    explanation_template: "Because it's 9 PM - time for your evening routine.",
  },
];

export default function Rules() {
  const navigate = useNavigate();
  const { rules, isLoading, addRule, updateRule, deleteRule, toggleRule } = useRules();
  const { goals } = useGoals();
  const { cameras } = useCameras();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  
  // Form state
  const [formData, setFormData] = useState<RuleInput>({
    name: '',
    description: '',
    category: 'custom',
    severity: 'info',
    trigger_type: 'schedule',
    trigger_config: {},
    conditions: [],
    actions: [],
    cooldown_minutes: 30,
    explanation_template: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'custom',
      severity: 'info',
      trigger_type: 'schedule',
      trigger_config: {},
      conditions: [],
      actions: [],
      cooldown_minutes: 30,
      explanation_template: '',
    });
    setEditingRule(null);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'Rule name is required', variant: 'destructive' });
      return;
    }
    if (formData.actions.length === 0) {
      toast({ title: 'Error', description: 'At least one action is required', variant: 'destructive' });
      return;
    }

    if (editingRule) {
      const result = await updateRule(editingRule.id, formData);
      if (result) {
        toast({ title: 'Rule updated', description: formData.name });
      }
    } else {
      const result = await addRule(formData);
      if (result) {
        toast({ title: 'Rule created', description: formData.name });
      }
    }

    resetForm();
    setIsDialogOpen(false);
  };

  const handleEdit = (rule: Rule) => {
    setFormData({
      name: rule.name,
      description: rule.description,
      category: rule.category,
      severity: rule.severity,
      trigger_type: rule.trigger_type,
      trigger_config: rule.trigger_config,
      conditions: rule.conditions,
      actions: rule.actions,
      cooldown_minutes: rule.cooldown_minutes,
      max_fires_per_day: rule.max_fires_per_day,
      explanation_template: rule.explanation_template,
      excluded_rooms: rule.excluded_rooms,
    });
    setEditingRule(rule);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    await deleteRule(id);
    toast({ title: 'Rule deleted', description: name });
  };

  const handleToggle = async (id: string) => {
    await toggleRule(id);
  };

  const applyTemplate = (template: typeof RULE_TEMPLATES[0]) => {
    setFormData({
      ...formData,
      name: template.name,
      category: template.category,
      trigger_type: template.trigger_type,
      trigger_config: template.trigger_config,
      conditions: template.conditions,
      actions: template.actions,
      explanation_template: template.explanation_template,
    });
  };

  const addAction = () => {
    setFormData({
      ...formData,
      actions: [...formData.actions, { type: 'speak', config: { message: '' } }],
    });
  };

  const removeAction = (index: number) => {
    setFormData({
      ...formData,
      actions: formData.actions.filter((_, i) => i !== index),
    });
  };

  const updateAction = (index: number, updates: Partial<RuleAction>) => {
    const newActions = [...formData.actions];
    newActions[index] = { ...newActions[index], ...updates };
    setFormData({ ...formData, actions: newActions });
  };

  const addCondition = () => {
    setFormData({
      ...formData,
      conditions: [...(formData.conditions || []), { type: 'idle_minutes', operator: 'greater_than', value: 10 }],
    });
  };

  const removeCondition = (index: number) => {
    setFormData({
      ...formData,
      conditions: (formData.conditions || []).filter((_, i) => i !== index),
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'urgent': return 'bg-destructive/20 text-destructive';
      case 'warning': return 'bg-yellow-500/20 text-yellow-500';
      case 'nudge': return 'bg-blue-500/20 text-blue-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getTriggerIcon = (type: string) => {
    const trigger = TRIGGER_TYPES.find(t => t.value === type);
    return trigger?.icon || Zap;
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRules(newExpanded);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-ai-glow" />
              <h1 className="text-3xl font-bold">Rules Engine</h1>
            </div>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRule ? 'Edit Rule' : 'Create Rule'}</DialogTitle>
                <DialogDescription>
                  Define When / If / Then / Because
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Templates */}
                {!editingRule && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Quick Start Templates</Label>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {RULE_TEMPLATES.map((template, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          onClick={() => applyTemplate(template)}
                        >
                          {template.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Basic Info */}
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Rule Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Idle Detection"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Category</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(v) => setFormData({ ...formData, category: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Severity</Label>
                      <Select
                        value={formData.severity}
                        onValueChange={(v) => setFormData({ ...formData, severity: v as RuleInput['severity'] })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SEVERITIES.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* WHEN: Trigger */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      WHEN (Trigger)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Select
                      value={formData.trigger_type}
                      onValueChange={(v) => setFormData({ ...formData, trigger_type: v as RuleInput['trigger_type'], trigger_config: {} })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TRIGGER_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>
                            <div className="flex items-center gap-2">
                              <t.icon className="w-4 h-4" />
                              {t.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {formData.trigger_type === 'schedule' && (
                      <Input
                        placeholder="Cron expression (e.g., */5 * * * *)"
                        value={(formData.trigger_config as Record<string, string>).cron || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          trigger_config: { ...formData.trigger_config, cron: e.target.value }
                        })}
                      />
                    )}

                    {formData.trigger_type === 'task_state' && (
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={(formData.trigger_config as Record<string, string>).status || 'pending'}
                          onValueChange={(v) => setFormData({
                            ...formData,
                            trigger_config: { ...formData.trigger_config, status: v }
                          })}
                        >
                          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="blocked">Blocked</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          placeholder="Overdue minutes"
                          value={(formData.trigger_config as Record<string, number>).overdue_minutes || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            trigger_config: { ...formData.trigger_config, overdue_minutes: parseInt(e.target.value) }
                          })}
                        />
                      </div>
                    )}

                    {formData.trigger_type === 'manual' && (
                      <Input
                        placeholder="Signal name (e.g., 'leaving_home')"
                        value={(formData.trigger_config as Record<string, string>).signal_name || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          trigger_config: { ...formData.trigger_config, signal_name: e.target.value }
                        })}
                      />
                    )}
                  </CardContent>
                </Card>

                {/* IF: Conditions */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Settings2 className="w-4 h-4" />
                        IF (Conditions)
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={addCondition}>
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(formData.conditions || []).length === 0 && (
                      <p className="text-xs text-muted-foreground">No conditions (always fire)</p>
                    )}
                    {(formData.conditions || []).map((condition, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <Select
                          value={condition.type}
                          onValueChange={(v) => {
                            const newConditions = [...(formData.conditions || [])];
                            newConditions[i] = { ...condition, type: v as RuleCondition['type'] };
                            setFormData({ ...formData, conditions: newConditions });
                          }}
                        >
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="idle_minutes">Idle Minutes</SelectItem>
                            <SelectItem value="time_of_day">Time of Day</SelectItem>
                            <SelectItem value="day_of_week">Day of Week</SelectItem>
                            <SelectItem value="room">Room</SelectItem>
                            <SelectItem value="task_in_progress">Task Active</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={condition.operator}
                          onValueChange={(v) => {
                            const newConditions = [...(formData.conditions || [])];
                            newConditions[i] = { ...condition, operator: v as RuleCondition['operator'] };
                            setFormData({ ...formData, conditions: newConditions });
                          }}
                        >
                          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">=</SelectItem>
                            <SelectItem value="not_equals">≠</SelectItem>
                            <SelectItem value="greater_than">&gt;</SelectItem>
                            <SelectItem value="less_than">&lt;</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          className="flex-1"
                          placeholder="Value"
                          value={String(condition.value || '')}
                          onChange={(e) => {
                            const newConditions = [...(formData.conditions || [])];
                            const val = isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value);
                            newConditions[i] = { ...condition, value: val };
                            setFormData({ ...formData, conditions: newConditions });
                          }}
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeCondition(i)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* THEN: Actions */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        THEN (Actions) *
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={addAction}>
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {formData.actions.length === 0 && (
                      <p className="text-xs text-muted-foreground">Add at least one action</p>
                    )}
                    {formData.actions.map((action, i) => (
                      <div key={i} className="border rounded-lg p-3 space-y-2">
                        <div className="flex gap-2 items-center">
                          <Select
                            value={action.type}
                            onValueChange={(v) => updateAction(i, { type: v as RuleAction['type'], config: {} })}
                          >
                            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ACTION_TYPES.map(a => (
                                <SelectItem key={a.value} value={a.value}>
                                  <div className="flex items-center gap-2">
                                    <a.icon className="w-3 h-3" />
                                    {a.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" onClick={() => removeAction(i)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>

                        {(action.type === 'speak' || action.type === 'notify') && (
                          <Input
                            placeholder="Message to speak/notify"
                            value={action.config.message || ''}
                            onChange={(e) => updateAction(i, { config: { ...action.config, message: e.target.value } })}
                          />
                        )}

                        {action.type === 'create_task' && (
                          <div className="grid gap-2">
                            <Input
                              placeholder="Task title"
                              value={action.config.title || ''}
                              onChange={(e) => updateAction(i, { config: { ...action.config, title: e.target.value } })}
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <Select
                                value={action.config.priority || 'medium'}
                                onValueChange={(v) => updateAction(i, { config: { ...action.config, priority: v } })}
                              >
                                <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="urgent">Urgent</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                placeholder="Due in (min)"
                                value={action.config.due_in_minutes || ''}
                                onChange={(e) => updateAction(i, { config: { ...action.config, due_in_minutes: parseInt(e.target.value) } })}
                              />
                            </div>
                          </div>
                        )}

                        {action.type === 'home_assistant' && (
                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              placeholder="Domain (light)"
                              value={action.config.domain || ''}
                              onChange={(e) => updateAction(i, { config: { ...action.config, domain: e.target.value } })}
                            />
                            <Input
                              placeholder="Service (turn_on)"
                              value={action.config.service || ''}
                              onChange={(e) => updateAction(i, { config: { ...action.config, service: e.target.value } })}
                            />
                            <Input
                              placeholder="Entity ID"
                              value={action.config.entity_id || ''}
                              onChange={(e) => updateAction(i, { config: { ...action.config, entity_id: e.target.value } })}
                            />
                          </div>
                        )}

                        {action.type === 'n8n_webhook' && (
                          <Input
                            placeholder="Webhook URL"
                            value={action.config.webhook_url || ''}
                            onChange={(e) => updateAction(i, { config: { ...action.config, webhook_url: e.target.value } })}
                          />
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* BECAUSE: Explanation */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">BECAUSE (Explanation)</CardTitle>
                    <CardDescription className="text-xs">
                      Template shown to user. Use {'{idle_minutes}'}, {'{room}'}, etc.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Because you've been idle for {idle_minutes} minutes..."
                      value={formData.explanation_template || ''}
                      onChange={(e) => setFormData({ ...formData, explanation_template: e.target.value })}
                    />
                  </CardContent>
                </Card>

                {/* Rate Limiting */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Cooldown (minutes)</Label>
                    <Input
                      type="number"
                      value={formData.cooldown_minutes || 30}
                      onChange={(e) => setFormData({ ...formData, cooldown_minutes: parseInt(e.target.value) || 30 })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Max fires per day</Label>
                    <Input
                      type="number"
                      placeholder="Unlimited"
                      value={formData.max_fires_per_day || ''}
                      onChange={(e) => setFormData({ ...formData, max_fires_per_day: parseInt(e.target.value) || undefined })}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit}>{editingRule ? 'Update' : 'Create'} Rule</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Rules List */}
        {isLoading ? (
          <p className="text-muted-foreground">Loading rules...</p>
        ) : rules.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Zap className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No rules yet</h3>
              <p className="text-muted-foreground mb-4">Create rules to automate your life management</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Rule
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {rules.map(rule => {
              const TriggerIcon = getTriggerIcon(rule.trigger_type);
              const isExpanded = expandedRules.has(rule.id);
              
              return (
                <Card key={rule.id} className={!rule.is_enabled ? 'opacity-50' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <TriggerIcon className="w-4 h-4 text-ai-glow" />
                          <span className="font-medium">{rule.name}</span>
                          <Badge variant="outline">{rule.category}</Badge>
                          <Badge className={getSeverityColor(rule.severity)}>{rule.severity}</Badge>
                          {rule.times_fired > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Fired {rule.times_fired}x
                            </span>
                          )}
                        </div>
                        {rule.description && (
                          <p className="text-sm text-muted-foreground mb-2">{rule.description}</p>
                        )}
                        
                        {/* Collapsed summary */}
                        {!isExpanded && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">WHEN:</span> {rule.trigger_type} | 
                            <span className="font-medium ml-1">IF:</span> {rule.conditions.length} conditions | 
                            <span className="font-medium ml-1">THEN:</span> {rule.actions.length} actions
                          </div>
                        )}

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="mt-3 space-y-2 text-xs">
                            <div className="p-2 bg-muted/50 rounded">
                              <span className="font-medium">WHEN:</span> {rule.trigger_type}
                              {rule.trigger_config && Object.keys(rule.trigger_config).length > 0 && (
                                <span className="text-muted-foreground ml-1">
                                  ({Object.entries(rule.trigger_config).map(([k, v]) => `${k}: ${v}`).join(', ')})
                                </span>
                              )}
                            </div>
                            {rule.conditions.length > 0 && (
                              <div className="p-2 bg-muted/50 rounded">
                                <span className="font-medium">IF:</span>
                                {rule.conditions.map((c, i) => (
                                  <span key={i} className="ml-1">{c.type} {c.operator} {String(c.value)}{i < rule.conditions.length - 1 ? ' AND' : ''}</span>
                                ))}
                              </div>
                            )}
                            <div className="p-2 bg-muted/50 rounded">
                              <span className="font-medium">THEN:</span>
                              {rule.actions.map((a, i) => (
                                <span key={i} className="ml-1">{a.type}{a.config.message ? `: "${a.config.message}"` : ''}{i < rule.actions.length - 1 ? ',' : ''}</span>
                              ))}
                            </div>
                            {rule.explanation_template && (
                              <div className="p-2 bg-muted/50 rounded">
                                <span className="font-medium">BECAUSE:</span> {rule.explanation_template}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Button variant="ghost" size="icon" onClick={() => toggleExpand(rule.id)}>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <Switch
                          checked={rule.is_enabled}
                          onCheckedChange={() => handleToggle(rule.id)}
                        />
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)}>
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id, rule.name)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
