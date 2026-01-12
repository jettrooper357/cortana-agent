import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useGoals } from '@/hooks/useGoals';
import { useCameras } from '@/hooks/useCameras';
import { useN8n } from '@/hooks/useN8n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Mic, 
  Camera, 
  Target, 
  Webhook, 
  Settings, 
  LogOut,
  Plus,
  Activity
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { goals, isLoading: goalsLoading } = useGoals();
  const { cameras, isLoading: camerasLoading } = useCameras();
  const { integrations, isLoading: n8nLoading } = useN8n();

  const activeGoals = goals.filter(g => g.status === 'active');
  const activeCameras = cameras.filter(c => c.is_active);
  const activeIntegrations = integrations.filter(i => i.is_active);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-gradient-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Cortana Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Welcome back, {user?.email}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate('/settings')}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Button
            variant="outline"
            className="h-24 flex flex-col gap-2"
            onClick={() => navigate('/')}
          >
            <Mic className="h-6 w-6 text-ai-glow" />
            <span>Voice Assistant</span>
          </Button>
          <Button
            variant="outline"
            className="h-24 flex flex-col gap-2"
            onClick={() => navigate('/cameras')}
          >
            <Camera className="h-6 w-6 text-ai-glow" />
            <span>Cameras</span>
          </Button>
          <Button
            variant="outline"
            className="h-24 flex flex-col gap-2"
            onClick={() => navigate('/goals')}
          >
            <Target className="h-6 w-6 text-ai-glow" />
            <span>Goals</span>
          </Button>
          <Button
            variant="outline"
            className="h-24 flex flex-col gap-2"
            onClick={() => navigate('/integrations')}
          >
            <Webhook className="h-6 w-6 text-ai-glow" />
            <span>Integrations</span>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Active Goals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{activeGoals.length}</div>
              <p className="text-xs text-muted-foreground">
                {goals.filter(g => g.status === 'completed').length} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Active Cameras
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{activeCameras.length}</div>
              <p className="text-xs text-muted-foreground">
                {cameras.length} total configured
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Webhook className="h-4 w-4" />
                n8n Integrations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{activeIntegrations.length}</div>
              <p className="text-xs text-muted-foreground">
                {integrations.filter(i => i.type === 'email').length} email, {integrations.filter(i => i.type === 'calendar').length} calendar
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Goals Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Goal Progress
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/goals')}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Goal
                </Button>
              </div>
              <CardDescription>
                Track your active goals
              </CardDescription>
            </CardHeader>
            <CardContent>
              {goalsLoading ? (
                <p className="text-muted-foreground">Loading goals...</p>
              ) : activeGoals.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No active goals</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => navigate('/goals')}
                  >
                    Create your first goal
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeGoals.slice(0, 5).map((goal) => {
                    const progress = goal.target_value 
                      ? Math.min((goal.current_value / goal.target_value) * 100, 100)
                      : 0;
                    
                    return (
                      <div key={goal.id} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{goal.title}</span>
                          <span className="text-muted-foreground">
                            {goal.current_value}{goal.unit ? ` ${goal.unit}` : ''} 
                            {goal.target_value && ` / ${goal.target_value}${goal.unit ? ` ${goal.unit}` : ''}`}
                          </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Camera Status
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/cameras')}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Camera
                </Button>
              </div>
              <CardDescription>
                Your connected cameras
              </CardDescription>
            </CardHeader>
            <CardContent>
              {camerasLoading ? (
                <p className="text-muted-foreground">Loading cameras...</p>
              ) : cameras.length === 0 ? (
                <div className="text-center py-8">
                  <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No cameras configured</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => navigate('/cameras')}
                  >
                    Add your first camera
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {cameras.slice(0, 5).map((camera) => (
                    <div 
                      key={camera.id} 
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${camera.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <div>
                          <p className="font-medium">{camera.name}</p>
                          <p className="text-xs text-muted-foreground">{camera.room || 'No room assigned'}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/cameras')}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
