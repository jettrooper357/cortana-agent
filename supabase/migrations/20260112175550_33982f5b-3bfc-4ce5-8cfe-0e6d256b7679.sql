-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table for role-based access
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create has_role function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- User settings table (webhooks, preferences)
CREATE TABLE public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    settings JSONB NOT NULL DEFAULT '{"webhooks": [], "defaultWebhook": null}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- User settings policies
CREATE POLICY "Users can view their own settings"
ON public.user_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
ON public.user_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
ON public.user_settings FOR UPDATE
USING (auth.uid() = user_id);

-- Cameras table
CREATE TABLE public.cameras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    rtsp_url TEXT,
    http_url TEXT,
    ip_address TEXT,
    port INTEGER,
    username TEXT,
    password TEXT,
    room TEXT,
    is_active BOOLEAN DEFAULT true,
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on cameras
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;

-- Cameras policies
CREATE POLICY "Users can view their own cameras"
ON public.cameras FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cameras"
ON public.cameras FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cameras"
ON public.cameras FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cameras"
ON public.cameras FOR DELETE
USING (auth.uid() = user_id);

-- Goals table
CREATE TABLE public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    target_value NUMERIC,
    current_value NUMERIC DEFAULT 0,
    unit TEXT,
    monitoring_type TEXT[] DEFAULT '{}',
    camera_id UUID REFERENCES public.cameras(id) ON DELETE SET NULL,
    n8n_workflow_id TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on goals
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- Goals policies
CREATE POLICY "Users can view their own goals"
ON public.goals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals"
ON public.goals FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
ON public.goals FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals"
ON public.goals FOR DELETE
USING (auth.uid() = user_id);

-- Goal logs/progress table
CREATE TABLE public.goal_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    value NUMERIC,
    notes TEXT,
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'camera', 'email', 'n8n')),
    metadata JSONB DEFAULT '{}',
    logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on goal_logs
ALTER TABLE public.goal_logs ENABLE ROW LEVEL SECURITY;

-- Goal logs policies
CREATE POLICY "Users can view their own goal logs"
ON public.goal_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goal logs"
ON public.goal_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goal logs"
ON public.goal_logs FOR DELETE
USING (auth.uid() = user_id);

-- n8n integrations table
CREATE TABLE public.n8n_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    webhook_url TEXT NOT NULL,
    type TEXT DEFAULT 'custom' CHECK (type IN ('email', 'calendar', 'custom')),
    is_active BOOLEAN DEFAULT true,
    last_sync TIMESTAMPTZ,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on n8n_integrations
ALTER TABLE public.n8n_integrations ENABLE ROW LEVEL SECURITY;

-- n8n integrations policies
CREATE POLICY "Users can view their own n8n integrations"
ON public.n8n_integrations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own n8n integrations"
ON public.n8n_integrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own n8n integrations"
ON public.n8n_integrations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own n8n integrations"
ON public.n8n_integrations FOR DELETE
USING (auth.uid() = user_id);

-- Create update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cameras_updated_at
    BEFORE UPDATE ON public.cameras
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_goals_updated_at
    BEFORE UPDATE ON public.goals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_n8n_integrations_updated_at
    BEFORE UPDATE ON public.n8n_integrations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();