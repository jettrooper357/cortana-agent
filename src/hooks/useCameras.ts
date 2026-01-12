import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Camera {
  id: string;
  name: string;
  description?: string;
  rtsp_url?: string;
  http_url?: string;
  ip_address?: string;
  port?: number;
  username?: string;
  password?: string;
  room?: string;
  is_active: boolean;
  last_seen?: string;
  created_at: string;
  updated_at: string;
}

export interface CameraInput {
  name: string;
  description?: string;
  rtsp_url?: string;
  http_url?: string;
  ip_address?: string;
  port?: number;
  username?: string;
  password?: string;
  room?: string;
  is_active?: boolean;
}

export const useCameras = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch cameras
  const fetchCameras = useCallback(async () => {
    if (!user) {
      setCameras([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('cameras')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setCameras(data || []);
    } catch (err) {
      console.error('Failed to fetch cameras:', err);
      setError('Failed to load cameras');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      fetchCameras();
    }
  }, [authLoading, fetchCameras]);

  // Add camera
  const addCamera = useCallback(async (camera: CameraInput): Promise<Camera | null> => {
    if (!user) {
      setError('You must be logged in to add cameras');
      return null;
    }

    try {
      const { data, error: insertError } = await supabase
        .from('cameras')
        .insert({
          ...camera,
          user_id: user.id,
          is_active: camera.is_active ?? true
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      setCameras(prev => [data, ...prev]);
      return data;
    } catch (err) {
      console.error('Failed to add camera:', err);
      setError('Failed to add camera');
      return null;
    }
  }, [user]);

  // Update camera
  const updateCamera = useCallback(async (id: string, updates: Partial<CameraInput>): Promise<Camera | null> => {
    if (!user) {
      setError('You must be logged in to update cameras');
      return null;
    }

    try {
      const { data, error: updateError } = await supabase
        .from('cameras')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setCameras(prev => prev.map(c => c.id === id ? data : c));
      return data;
    } catch (err) {
      console.error('Failed to update camera:', err);
      setError('Failed to update camera');
      return null;
    }
  }, [user]);

  // Delete camera
  const deleteCamera = useCallback(async (id: string): Promise<boolean> => {
    if (!user) {
      setError('You must be logged in to delete cameras');
      return false;
    }

    try {
      const { error: deleteError } = await supabase
        .from('cameras')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (deleteError) {
        throw deleteError;
      }

      setCameras(prev => prev.filter(c => c.id !== id));
      return true;
    } catch (err) {
      console.error('Failed to delete camera:', err);
      setError('Failed to delete camera');
      return false;
    }
  }, [user]);

  // Get camera by ID
  const getCameraById = useCallback((id: string): Camera | undefined => {
    return cameras.find(c => c.id === id);
  }, [cameras]);

  return {
    cameras,
    isLoading: isLoading || authLoading,
    error,
    addCamera,
    updateCamera,
    deleteCamera,
    getCameraById,
    refetch: fetchCameras
  };
};
