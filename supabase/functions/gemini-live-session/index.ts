import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Gemini Live Session Edge Function
 * 
 * This function creates an ephemeral session for the Gemini Live API.
 * The client will use this session info to establish a WebSocket connection
 * directly to Google's Gemini Live API for real-time audio streaming.
 * 
 * Since Lovable AI doesn't currently expose a Live/WebSocket endpoint,
 * we use the LOVABLE_API_KEY to authenticate requests to the Lovable AI
 * gateway for non-streaming completions when needed.
 */

interface SessionConfig {
  systemInstruction?: string;
  voice?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { systemInstruction, voice } = await req.json() as SessionConfig;

    // For now, we return session configuration that the client can use
    // The actual WebSocket connection will be handled client-side
    // using the Lovable AI gateway for audio processing
    
    const sessionConfig = {
      model: "google/gemini-2.5-flash",
      systemInstruction: systemInstruction || `You are Cortana, an AI home guardian and personal assistant. 
You observe the home through sensors and conversation.
Be concise, warm, and helpful.
Keep responses under 2 sentences when possible.
Use natural, conversational language suitable for voice output.`,
      voice: voice || "Puck",
      responseModality: "AUDIO",
      // This is a session identifier for tracking
      sessionId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      // The client will use the Lovable AI gateway endpoint
      gatewayUrl: "https://ai.gateway.lovable.dev/v1/chat/completions",
    };

    return new Response(
      JSON.stringify(sessionConfig),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Session creation error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
