import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks, TaskInput } from '@/hooks/useTasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, Play, CheckCircle, Clock, AlertTriangle, MapPin } from 'lucide-react';
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

const CATEGORIES = ['chore', 'work', 'health', 'errand', 'other'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const ROOMS = ['Kitchen', 'Living Room', 'Bedroom', 'Bathroom', 'Office', 'Garage', 'Yard', 'Other'];

export default function Tasks() {
  const navigate = useNavigate();
  const { tasks, isLoading, addTask, updateTask, deleteTask, startTask, completeTask, skipTask } = useTasks();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<TaskInput>({
    title: '',
    description: '',
    category: 'other',
    priority: 'medium',
    room: '',
    estimated_minutes: undefined,
    due_at: undefined,
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'other',
      priority: 'medium',
      room: '',
      estimated_minutes: undefined,
      due_at: undefined,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({ title: 'Error', description: 'Task title is required', variant: 'destructive' });
      return;
    }

    const result = await addTask(formData);
    if (result) {
      toast({ title: 'Task created', description: formData.title });
      resetForm();
      setIsDialogOpen(false);
    }
  };

  const handleStart = async (id: string, title: string) => {
    await startTask(id);
    toast({ title: 'Task started', description: title });
  };

  const handleComplete = async (id: string, title: string) => {
    await completeTask(id);
    toast({ title: 'Task completed', description: title });
  };

  const handleDelete = async (id: string, title: string) => {
    await deleteTask(id);
    toast({ title: 'Task deleted', description: title });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-destructive/20 text-destructive border-destructive';
      case 'high': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500';
      case 'medium': return 'bg-blue-500/20 text-blue-500 border-blue-500';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress': return 'bg-ai-glow/20 text-ai-glow';
      case 'completed': return 'bg-green-500/20 text-green-500';
      case 'blocked': return 'bg-red-500/20 text-red-500';
      case 'skipped': return 'bg-gray-500/20 text-gray-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  const isOverdue = (task: typeof tasks[0]) => {
    return task.due_at && new Date(task.due_at) < new Date() && task.status !== 'completed';
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
              <CheckCircle className="h-6 w-6 text-ai-glow" />
              <h1 className="text-3xl font-bold">Tasks</h1>
            </div>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Create Task</DialogTitle>
                  <DialogDescription>Add a task for the life manager to track</DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Do the dishes"
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Details..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Category</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) => setFormData({ ...formData, category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Priority</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value) => setFormData({ ...formData, priority: value as TaskInput['priority'] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Room/Location</Label>
                      <Select
                        value={formData.room || ''}
                        onValueChange={(value) => setFormData({ ...formData, room: value || undefined })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select room" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {ROOMS.map(r => (
                            <SelectItem key={r} value={r.toLowerCase()}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Estimated (min)</Label>
                      <Input
                        type="number"
                        value={formData.estimated_minutes || ''}
                        onChange={(e) => setFormData({ ...formData, estimated_minutes: parseInt(e.target.value) || undefined })}
                        placeholder="15"
                      />
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label>Due</Label>
                    <Input
                      type="datetime-local"
                      value={formData.due_at?.slice(0, 16) || ''}
                      onChange={(e) => setFormData({ ...formData, due_at: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit">Create</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-4">
              <div className="text-3xl font-bold text-ai-glow">{inProgressTasks.length}</div>
              <div className="text-sm text-muted-foreground">In Progress</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-3xl font-bold">{pendingTasks.length}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-3xl font-bold text-green-500">{completedTasks.length}</div>
              <div className="text-sm text-muted-foreground">Completed Today</div>
            </CardContent>
          </Card>
        </div>

        {/* Task Lists */}
        {isLoading ? (
          <p className="text-muted-foreground">Loading tasks...</p>
        ) : tasks.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <CheckCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No tasks yet</h3>
              <p className="text-muted-foreground mb-4">Add tasks for the life manager to track</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Task
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* In Progress */}
            {inProgressTasks.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Play className="w-4 h-4 text-ai-glow" />
                  In Progress
                </h2>
                <div className="grid gap-3">
                  {inProgressTasks.map(task => (
                    <TaskCard 
                      key={task.id} 
                      task={task} 
                      isOverdue={isOverdue(task)}
                      onComplete={() => handleComplete(task.id, task.title)}
                      onDelete={() => handleDelete(task.id, task.title)}
                      getPriorityColor={getPriorityColor}
                      getStatusColor={getStatusColor}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Pending */}
            {pendingTasks.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Pending
                </h2>
                <div className="grid gap-3">
                  {pendingTasks.map(task => (
                    <TaskCard 
                      key={task.id} 
                      task={task} 
                      isOverdue={isOverdue(task)}
                      onStart={() => handleStart(task.id, task.title)}
                      onComplete={() => handleComplete(task.id, task.title)}
                      onDelete={() => handleDelete(task.id, task.title)}
                      getPriorityColor={getPriorityColor}
                      getStatusColor={getStatusColor}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Completed */}
            {completedTasks.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Completed
                </h2>
                <div className="grid gap-3 opacity-60">
                  {completedTasks.slice(0, 5).map(task => (
                    <TaskCard 
                      key={task.id} 
                      task={task} 
                      isOverdue={false}
                      onDelete={() => handleDelete(task.id, task.title)}
                      getPriorityColor={getPriorityColor}
                      getStatusColor={getStatusColor}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface TaskCardProps {
  task: ReturnType<typeof useTasks>['tasks'][0];
  isOverdue: boolean;
  onStart?: () => void;
  onComplete?: () => void;
  onDelete?: () => void;
  getPriorityColor: (priority: string) => string;
  getStatusColor: (status: string) => string;
}

function TaskCard({ task, isOverdue, onStart, onComplete, onDelete, getPriorityColor, getStatusColor }: TaskCardProps) {
  return (
    <Card className={isOverdue ? 'border-destructive' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium">{task.title}</span>
              <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
              <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
              {isOverdue && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Overdue
                </Badge>
              )}
            </div>
            {task.description && (
              <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {task.room && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {task.room}
                </span>
              )}
              {task.estimated_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {task.estimated_minutes} min
                </span>
              )}
              {task.due_at && (
                <span>Due: {new Date(task.due_at).toLocaleString()}</span>
              )}
            </div>
          </div>
          <div className="flex gap-1 ml-4">
            {onStart && task.status === 'pending' && (
              <Button variant="ghost" size="icon" onClick={onStart}>
                <Play className="h-4 w-4" />
              </Button>
            )}
            {onComplete && task.status !== 'completed' && (
              <Button variant="ghost" size="icon" onClick={onComplete}>
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" size="icon" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
