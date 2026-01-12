import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HARequest {
  action: "test" | "get_states" | "get_services" | "call_service" | "sync_entities";
  instance_url?: string;
  access_token?: string;
  service_domain?: string;
  service?: string;
  entity_id?: string;
  service_data?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: HARequest = await req.json();
    const { action, instance_url, access_token, service_domain, service, entity_id, service_data } = body;

    // For most actions, we need the stored config or provided credentials
    let haUrl = instance_url;
    let haToken = access_token;

    if (!haUrl || !haToken) {
      // Fetch from stored config
      const { data: config } = await supabase
        .from("home_assistant_config")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!config) {
        return new Response(JSON.stringify({ error: "No Home Assistant configuration found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      haUrl = config.instance_url;
      // Token needs to be passed for each request since we don't store it in DB
      if (!haToken) {
        return new Response(JSON.stringify({ error: "Access token required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Ensure URL doesn't have trailing slash
    haUrl = haUrl.replace(/\/$/, "");

    const haHeaders = {
      Authorization: `Bearer ${haToken}`,
      "Content-Type": "application/json",
    };

    let result: unknown;

    switch (action) {
      case "test": {
        // Test connection by fetching API status
        const response = await fetch(`${haUrl}/api/`, { headers: haHeaders });
        if (!response.ok) {
          const text = await response.text();
          return new Response(JSON.stringify({ error: `Connection failed: ${text}` }), {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await response.json();
        
        // Update last_connected_at
        await supabase
          .from("home_assistant_config")
          .update({ last_connected_at: new Date().toISOString() })
          .eq("user_id", user.id);
        break;
      }

      case "get_states": {
        const response = await fetch(`${haUrl}/api/states`, { headers: haHeaders });
        if (!response.ok) {
          throw new Error(`Failed to get states: ${response.statusText}`);
        }
        result = await response.json();
        break;
      }

      case "get_services": {
        const response = await fetch(`${haUrl}/api/services`, { headers: haHeaders });
        if (!response.ok) {
          throw new Error(`Failed to get services: ${response.statusText}`);
        }
        result = await response.json();
        break;
      }

      case "call_service": {
        if (!service_domain || !service) {
          return new Response(JSON.stringify({ error: "service_domain and service are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const serviceBody = {
          ...(entity_id && { entity_id }),
          ...(service_data && service_data),
        };

        const response = await fetch(`${haUrl}/api/services/${service_domain}/${service}`, {
          method: "POST",
          headers: haHeaders,
          body: JSON.stringify(serviceBody),
        });

        if (!response.ok) {
          throw new Error(`Failed to call service: ${response.statusText}`);
        }
        result = await response.json();
        break;
      }

      case "sync_entities": {
        // Fetch all states and sync to our database
        const response = await fetch(`${haUrl}/api/states`, { headers: haHeaders });
        if (!response.ok) {
          throw new Error(`Failed to get states: ${response.statusText}`);
        }
        const states = await response.json() as Array<{
          entity_id: string;
          state: string;
          attributes: Record<string, unknown>;
          last_updated: string;
        }>;

        // Upsert entities
        const entities = states.map((s) => ({
          user_id: user.id,
          entity_id: s.entity_id,
          friendly_name: (s.attributes.friendly_name as string) || s.entity_id,
          state: s.state,
          attributes: s.attributes,
          domain: s.entity_id.split(".")[0],
          last_updated_at: s.last_updated,
        }));

        const { error: upsertError } = await supabase
          .from("home_assistant_entities")
          .upsert(entities, { onConflict: "user_id,entity_id" });

        if (upsertError) {
          throw new Error(`Failed to sync entities: ${upsertError.message}`);
        }

        result = { synced: entities.length };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Home Assistant error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
