import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Gemini Audio Chat - Real-time audio processing
 * 
 * This function handles audio input and generates audio output responses
 * using the Lovable AI gateway with Gemini models.
 * 
 * Flow:
 * 1. Client records audio and sends base64-encoded PCM data
 * 2. This function transcribes and processes with Gemini
 * 3. Returns text response (client uses browser TTS or ElevenLabs for audio output)
 * 
 * For true bidirectional audio streaming, Google's Gemini Live API requires
 * direct WebSocket access which isn't available through the Lovable gateway.
 * This implementation provides a near-real-time alternative.
 */

interface AudioChatRequest {
  audioBase64?: string;
  transcript?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  systemInstruction?: string;
  goals?: Array<{
    id: string;
    title: string;
    description?: string;
    category?: string;
    target_value?: number;
    current_value: number;
    unit?: string;
    status: string;
    due_date?: string;
  }>;
  tasks?: Array<{
    id: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
  }>;
}

const DEFAULT_SYSTEM_PROMPT = `You are Cortana, an AI home guardian and personal assistant.

Core behavior:
- Be concise and natural in speech (your responses will be spoken aloud)
- Keep responses to 1-2 sentences when possible
- Be warm but efficient - you're a guardian, not a chatbot
- Use conversational language

You help with:
- Monitoring the home through sensors and conversation
- Tracking personal goals and encouraging progress
- Managing tasks and reminders
- Answering questions and providing assistance

When creating tasks:
- Listen for commitments, plans, and things the user needs to do
- Be smart about due dates
- Confirm task creation briefly`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { 
      transcript, 
      conversationHistory = [], 
      systemInstruction,
      goals = [],
      tasks = []
    } = await req.json() as AudioChatRequest;

    if (!transcript?.trim()) {
      return new Response(
        JSON.stringify({ error: "No transcript provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context
    const contextParts: string[] = [];
    contextParts.push(`Current time: ${new Date().toLocaleString()}`);

    if (goals.length > 0) {
      const activeGoals = goals.filter(g => g.status === 'active');
      if (activeGoals.length > 0) {
        const goalsSummary = activeGoals
          .map(g => {
            const progress = g.target_value 
              ? `${g.current_value}/${g.target_value} ${g.unit || ''}`
              : `${g.current_value} ${g.unit || ''}`;
            return `- ${g.title}: ${progress}`;
          })
          .join("\n");
        contextParts.push(`Active goals:\n${goalsSummary}`);
      }
    }

    if (tasks.length > 0) {
      const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
      if (pendingTasks.length > 0) {
        const tasksSummary = pendingTasks
          .slice(0, 5)
          .map(t => `- [${t.priority.toUpperCase()}] ${t.title}`)
          .join("\n");
        contextParts.push(`Current tasks:\n${tasksSummary}`);
      }
    }

    // Build messages
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemInstruction || DEFAULT_SYSTEM_PROMPT },
    ];

    // Add context as a system message if we have it
    if (contextParts.length > 1) {
      messages.push({
        role: "system",
        content: `Context:\n${contextParts.join("\n\n")}`
      });
    }

    // Add conversation history (limit to last 10 messages)
    if (conversationHistory.length > 0) {
      messages.push(...conversationHistory.slice(-10));
    }

    // Add user's current input
    messages.push({
      role: "user",
      content: transcript.trim()
    });

    // Call Lovable AI gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        max_tokens: 200, // Keep responses short for voice
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    const assistantMessage = result.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({
        response: assistantMessage,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Gemini audio chat error:", error);
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
