import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoals, GoalInput } from '@/hooks/useGoals';
import { useCameras } from '@/hooks/useCameras';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, Target, Edit2, CheckCircle, Pause, Play } from 'lucide-react';
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

const CATEGORIES = [
  'Health',
  'Productivity',
  'Home',
  'Finance',
  'Learning',
  'Fitness',
  'Other'
];

export default function Goals() {
  const navigate = useNavigate();
  const { goals, isLoading, addGoal, updateGoal, deleteGoal, logProgress } = useGoals();
  const { cameras } = useCameras();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [progressValue, setProgressValue] = useState('');
  const [progressNotes, setProgressNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<GoalInput>({
    title: '',
    description: '',
    category: '',
    target_value: undefined,
    unit: '',
    monitoring_type: [],
    camera_id: undefined,
    due_date: undefined,
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: '',
      target_value: undefined,
      unit: '',
      monitoring_type: [],
      camera_id: undefined,
      due_date: undefined,
    });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Goal title is required',
        variant: 'destructive',
      });
      return;
    }

    if (editingId) {
      const result = await updateGoal(editingId, formData);
      if (result) {
        toast({
          title: 'Goal updated',
          description: `${formData.title} has been updated.`,
        });
      }
    } else {
      const result = await addGoal(formData);
      if (result) {
        toast({
          title: 'Goal created',
          description: `${formData.title} has been added.`,
        });
      }
    }

    resetForm();
    setIsDialogOpen(false);
  };

  const handleEdit = (goal: typeof goals[0]) => {
    setFormData({
      title: goal.title,
      description: goal.description || '',
      category: goal.category || '',
      target_value: goal.target_value || undefined,
      unit: goal.unit || '',
      monitoring_type: goal.monitoring_type || [],
      camera_id: goal.camera_id || undefined,
      due_date: goal.due_date || undefined,
    });
    setEditingId(goal.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string, title: string) => {
    const result = await deleteGoal(id);
    if (result) {
      toast({
        title: 'Goal deleted',
        description: `${title} has been removed.`,
      });
    }
  };

  const handleStatusChange = async (id: string, status: 'active' | 'completed' | 'paused') => {
    await updateGoal(id, { status });
    toast({
      title: 'Status updated',
      description: `Goal marked as ${status}.`,
    });
  };

  const handleLogProgress = async () => {
    if (!selectedGoalId || !progressValue) return;

    const value = parseFloat(progressValue);
    if (isNaN(value)) {
      toast({
        title: 'Invalid value',
        description: 'Please enter a valid number.',
        variant: 'destructive',
      });
      return;
    }

    await logProgress(selectedGoalId, value, progressNotes || undefined);
    toast({
      title: 'Progress logged',
      description: 'Your progress has been recorded.',
    });
    
    setProgressValue('');
    setProgressNotes('');
    setSelectedGoalId(null);
    setIsProgressDialogOpen(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-500/20 text-blue-500';
      case 'completed': return 'bg-green-500/20 text-green-500';
      case 'paused': return 'bg-yellow-500/20 text-yellow-500';
      default: return 'bg-gray-500/20 text-gray-500';
    }
  };

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
              <Target className="h-6 w-6 text-ai-glow" />
              <h1 className="text-3xl font-bold">Goals</h1>
            </div>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Goal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? 'Edit Goal' : 'Create New Goal'}
                  </DialogTitle>
                  <DialogDescription>
                    Define your goal and track your progress
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Exercise 3 times a week"
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Details about your goal..."
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat.toLowerCase()}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="target">Target Value</Label>
                      <Input
                        id="target"
                        type="number"
                        value={formData.target_value || ''}
                        onChange={(e) => setFormData({ ...formData, target_value: parseFloat(e.target.value) || undefined })}
                        placeholder="30"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="unit">Unit</Label>
                      <Input
                        id="unit"
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        placeholder="minutes"
                      />
                    </div>
                  </div>
                  
                  {cameras.length > 0 && (
                    <div className="grid gap-2">
                      <Label htmlFor="camera">Link to Camera (Optional)</Label>
                      <Select
                        value={formData.camera_id || ''}
                        onValueChange={(value) => setFormData({ ...formData, camera_id: value || undefined })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select camera" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {cameras.map((cam) => (
                            <SelectItem key={cam.id} value={cam.id}>
                              {cam.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  <div className="grid gap-2">
                    <Label htmlFor="due_date">Due Date</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date?.split('T')[0] || ''}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingId ? 'Update' : 'Create'} Goal
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Progress Dialog */}
        <Dialog open={isProgressDialogOpen} onOpenChange={setIsProgressDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Log Progress</DialogTitle>
              <DialogDescription>
                Record your progress towards this goal
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="progress_value">Progress Value</Label>
                <Input
                  id="progress_value"
                  type="number"
                  value={progressValue}
                  onChange={(e) => setProgressValue(e.target.value)}
                  placeholder="Enter value"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="progress_notes">Notes (Optional)</Label>
                <Textarea
                  id="progress_notes"
                  value={progressNotes}
                  onChange={(e) => setProgressNotes(e.target.value)}
                  placeholder="Add notes..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsProgressDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleLogProgress}>
                Log Progress
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Goals List */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading goals...</p>
          </div>
        ) : goals.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Target className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No goals yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first goal to start tracking your progress
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Goal
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {goals.map((goal) => {
              const progress = goal.target_value 
                ? Math.min((goal.current_value / goal.target_value) * 100, 100)
                : 0;
              
              return (
                <Card key={goal.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-lg">{goal.title}</CardTitle>
                          <Badge className={getStatusColor(goal.status)}>
                            {goal.status}
                          </Badge>
                          {goal.category && (
                            <Badge variant="outline">{goal.category}</Badge>
                          )}
                        </div>
                        {goal.description && (
                          <CardDescription>{goal.description}</CardDescription>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {goal.status === 'active' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleStatusChange(goal.id, 'paused')}
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleStatusChange(goal.id, 'completed')}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {goal.status === 'paused' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStatusChange(goal.id, 'active')}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(goal)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(goal.id, goal.title)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {goal.target_value && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>
                            {goal.current_value}{goal.unit ? ` ${goal.unit}` : ''} / {goal.target_value}{goal.unit ? ` ${goal.unit}` : ''}
                          </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    )}
                    {goal.status === 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => {
                          setSelectedGoalId(goal.id);
                          setIsProgressDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Log Progress
                      </Button>
                    )}
                    {goal.due_date && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Due: {new Date(goal.due_date).toLocaleDateString()}
                      </p>
                    )}
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
