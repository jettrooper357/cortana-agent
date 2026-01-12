import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCameras, CameraInput } from '@/hooks/useCameras';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, Camera, Edit2, X, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function Cameras() {
  const navigate = useNavigate();
  const { cameras, isLoading, addCamera, updateCamera, deleteCamera } = useCameras();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CameraInput>({
    name: '',
    description: '',
    ip_address: '',
    port: 80,
    http_url: '',
    rtsp_url: '',
    username: '',
    password: '',
    room: '',
    is_active: true,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      ip_address: '',
      port: 80,
      http_url: '',
      rtsp_url: '',
      username: '',
      password: '',
      room: '',
      is_active: true,
    });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Camera name is required',
        variant: 'destructive',
      });
      return;
    }

    if (editingId) {
      const result = await updateCamera(editingId, formData);
      if (result) {
        toast({
          title: 'Camera updated',
          description: `${formData.name} has been updated.`,
        });
      }
    } else {
      const result = await addCamera(formData);
      if (result) {
        toast({
          title: 'Camera added',
          description: `${formData.name} has been added.`,
        });
      }
    }

    resetForm();
    setIsDialogOpen(false);
  };

  const handleEdit = (camera: typeof cameras[0]) => {
    setFormData({
      name: camera.name,
      description: camera.description || '',
      ip_address: camera.ip_address || '',
      port: camera.port || 80,
      http_url: camera.http_url || '',
      rtsp_url: camera.rtsp_url || '',
      username: camera.username || '',
      password: camera.password || '',
      room: camera.room || '',
      is_active: camera.is_active,
    });
    setEditingId(camera.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    const result = await deleteCamera(id);
    if (result) {
      toast({
        title: 'Camera deleted',
        description: `${name} has been removed.`,
      });
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await updateCamera(id, { is_active: isActive });
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
              <Camera className="h-6 w-6 text-ai-glow" />
              <h1 className="text-3xl font-bold">Cameras</h1>
            </div>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Camera
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? 'Edit Camera' : 'Add New Camera'}
                  </DialogTitle>
                  <DialogDescription>
                    Configure your camera connection settings
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Living Room Camera"
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="room">Room</Label>
                    <Input
                      id="room"
                      value={formData.room}
                      onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                      placeholder="Living Room"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="ip">IP Address</Label>
                      <Input
                        id="ip"
                        value={formData.ip_address}
                        onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                        placeholder="192.168.1.100"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="port">Port</Label>
                      <Input
                        id="port"
                        type="number"
                        value={formData.port}
                        onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 80 })}
                        placeholder="80"
                      />
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="http_url">HTTP URL (Snapshot)</Label>
                    <Input
                      id="http_url"
                      value={formData.http_url}
                      onChange={(e) => setFormData({ ...formData, http_url: e.target.value })}
                      placeholder="http://192.168.1.100/snapshot.jpg"
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="rtsp_url">RTSP URL (Stream)</Label>
                    <Input
                      id="rtsp_url"
                      value={formData.rtsp_url}
                      onChange={(e) => setFormData({ ...formData, rtsp_url: e.target.value })}
                      placeholder="rtsp://192.168.1.100:554/stream"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        placeholder="admin"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="••••••••"
                      />
                    </div>
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
                    {editingId ? 'Update' : 'Add'} Camera
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Camera Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading cameras...</p>
          </div>
        ) : cameras.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Camera className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No cameras configured</h3>
              <p className="text-muted-foreground mb-4">
                Add your first camera to start monitoring your home
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Camera
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cameras.map((camera) => (
              <Card key={camera.id} className="relative overflow-hidden">
                <div className="aspect-video bg-muted flex items-center justify-center">
                  {camera.http_url ? (
                    <img 
                      src={camera.http_url}
                      alt={camera.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Camera className="h-12 w-12 text-muted-foreground" />
                  )}
                  <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${camera.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                </div>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{camera.name}</CardTitle>
                    <Switch
                      checked={camera.is_active}
                      onCheckedChange={(checked) => handleToggleActive(camera.id, checked)}
                    />
                  </div>
                  <CardDescription>
                    {camera.room || 'No room assigned'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEdit(camera)}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(camera.id, camera.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
