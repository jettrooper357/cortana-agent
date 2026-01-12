-- Create table for Home Assistant configuration
CREATE TABLE public.home_assistant_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  instance_url TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Home Assistant',
  is_active BOOLEAN DEFAULT true,
  last_connected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id) -- One HA instance per user
);

-- Create table for cached entity states
CREATE TABLE public.home_assistant_entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_id TEXT NOT NULL,
  friendly_name TEXT,
  state TEXT,
  attributes JSONB DEFAULT '{}',
  domain TEXT, -- light, switch, sensor, binary_sensor, etc.
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, entity_id)
);

-- Create table for sensor history/events
CREATE TABLE public.home_assistant_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_id TEXT NOT NULL,
  old_state TEXT,
  new_state TEXT,
  event_type TEXT DEFAULT 'state_changed',
  metadata JSONB DEFAULT '{}',
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_ha_entities_user_domain ON public.home_assistant_entities(user_id, domain);
CREATE INDEX idx_ha_events_user_entity ON public.home_assistant_events(user_id, entity_id, occurred_at DESC);

-- Enable RLS
ALTER TABLE public.home_assistant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_assistant_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_assistant_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for home_assistant_config
CREATE POLICY "Users can view their own HA config" 
ON public.home_assistant_config FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own HA config" 
ON public.home_assistant_config FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own HA config" 
ON public.home_assistant_config FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own HA config" 
ON public.home_assistant_config FOR DELETE 
USING (auth.uid() = user_id);

-- RLS policies for home_assistant_entities
CREATE POLICY "Users can view their own HA entities" 
ON public.home_assistant_entities FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own HA entities" 
ON public.home_assistant_entities FOR ALL 
USING (auth.uid() = user_id);

-- RLS policies for home_assistant_events
CREATE POLICY "Users can view their own HA events" 
ON public.home_assistant_events FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own HA events" 
ON public.home_assistant_events FOR ALL 
USING (auth.uid() = user_id);

-- Add trigger for updated_at on config
CREATE TRIGGER update_home_assistant_config_updated_at
BEFORE UPDATE ON public.home_assistant_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();