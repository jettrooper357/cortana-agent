import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GuardianInput {
  transcript?: string;
  imageBase64?: string;
  sensorData?: {
    entities: Array<{
      entity_id: string;
      friendly_name: string | null;
      state: string | null;
      domain: string | null;
    }>;
  };
  conversationHistory?: Array<{ role: string; content: string }>;
}

const SYSTEM_PROMPT = `You are Cortana, an AI home guardian. You observe the home through sensors, cameras, and conversation.

Your core directives:
1. OBSERVE: Monitor sensor data, camera feeds, and user speech continuously
2. ANALYZE: Detect anomalies, patterns, and potential risks
3. ADVISE: Proactively alert users to important situations
4. ASSIST: Answer questions and help with home automation

Behavior guidelines:
- Be concise and natural in speech (responses will be spoken aloud)
- Only speak when you have something meaningful to say
- For routine observations, stay silent (return shouldSpeak: false)
- Alert immediately for: security concerns, safety hazards, unusual patterns
- Be warm but efficient - you're a guardian, not a chatbot

Response format:
- If user spoke directly to you, always respond
- If just observing (no direct speech), only respond if something noteworthy
- Keep responses under 2 sentences when possible
- Use natural, conversational language

Current context will include:
- transcript: What the user said (if anything)
- imageBase64: Camera snapshot (if available)
- sensorData: Home Assistant entity states`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, imageBase64, sensorData, conversationHistory } = await req.json() as GuardianInput;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the user message with available context
    const contextParts: string[] = [];
    
    if (transcript) {
      contextParts.push(`User said: "${transcript}"`);
    }
    
    if (sensorData?.entities?.length) {
      const sensorSummary = sensorData.entities
        .filter(e => e.state && e.state !== "unavailable")
        .map(e => `${e.friendly_name || e.entity_id}: ${e.state}`)
        .slice(0, 20) // Limit to 20 most relevant
        .join("\n");
      if (sensorSummary) {
        contextParts.push(`Current sensor states:\n${sensorSummary}`);
      }
    }

    if (!contextParts.length && !imageBase64) {
      return new Response(
        JSON.stringify({ shouldSpeak: false, response: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build messages array
    const messages: Array<{ role: string; content: unknown }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add conversation history if available
    if (conversationHistory?.length) {
      messages.push(...conversationHistory.slice(-10)); // Last 10 exchanges
    }

    // Build current message with multimodal content if image present
    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: contextParts.join("\n\n") || "Observe this camera feed." },
          { 
            type: "image_url", 
            image_url: { 
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: "low" 
            } 
          },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: contextParts.join("\n\n"),
      });
    }

    // Use tool calling for structured output
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        tools: [
          {
            type: "function",
            function: {
              name: "guardian_response",
              description: "Respond to the current observation context",
              parameters: {
                type: "object",
                properties: {
                  shouldSpeak: {
                    type: "boolean",
                    description: "Whether Cortana should speak aloud. True if responding to user speech or alerting to something important.",
                  },
                  response: {
                    type: "string",
                    description: "What Cortana should say. Keep it natural and concise.",
                  },
                  alertLevel: {
                    type: "string",
                    enum: ["none", "info", "warning", "critical"],
                    description: "Severity level if this is an alert",
                  },
                  observation: {
                    type: "string",
                    description: "Internal observation log (not spoken)",
                  },
                },
                required: ["shouldSpeak"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "guardian_response" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded", shouldSpeak: false }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required", shouldSpeak: false }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(
        JSON.stringify(parsed),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ shouldSpeak: false, response: null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI guardian error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        shouldSpeak: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
