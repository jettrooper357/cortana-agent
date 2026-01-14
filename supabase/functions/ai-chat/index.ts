import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Unified AI Chat - Supports multiple AI providers
 * 
 * Supports:
 * - Gemini (via Lovable AI gateway - no API key needed)
 * - ChatGPT (requires OpenAI API key)
 * - Claude (requires Anthropic API key)
 */

interface ChatRequest {
  transcript: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  systemInstruction?: string;
  provider?: 'gemini' | 'chatgpt' | 'claude';
  apiKey?: string; // For ChatGPT/Claude
  model?: string; // Optional model override
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
- Answering questions and providing assistance`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      transcript, 
      conversationHistory = [], 
      systemInstruction,
      provider = 'gemini',
      apiKey,
      model
    } = await req.json() as ChatRequest;

    if (!transcript?.trim()) {
      return new Response(
        JSON.stringify({ error: "No transcript provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = systemInstruction || DEFAULT_SYSTEM_PROMPT;
    
    // Build messages
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history (limit to last 10 messages)
    if (conversationHistory.length > 0) {
      messages.push(...conversationHistory.slice(-10));
    }

    // Add user's current input
    messages.push({
      role: "user",
      content: transcript.trim()
    });

    let response: Response;
    let assistantMessage: string;

    if (provider === 'chatgpt') {
      // Use OpenAI API
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "OpenAI API key required for ChatGPT" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model || "gpt-4",
          messages,
          max_tokens: 200,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI API error:", response.status, errorText);
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "OpenAI rate limit exceeded" }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const result = await response.json();
      assistantMessage = result.choices?.[0]?.message?.content || "";

    } else if (provider === 'claude') {
      // Use Anthropic API
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "Anthropic API key required for Claude" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Claude uses a different message format
      const claudeMessages = messages.slice(1).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model || "claude-3-opus-20240229",
          max_tokens: 200,
          system: systemPrompt,
          messages: claudeMessages,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Anthropic API error:", response.status, errorText);
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Claude rate limit exceeded" }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      const result = await response.json();
      assistantMessage = result.content?.[0]?.text || "";

    } else {
      // Default: Gemini via Lovable AI gateway
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        throw new Error("LOVABLE_API_KEY is not configured");
      }

      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model || "google/gemini-3-flash-preview",
          messages,
          max_tokens: 200,
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
      assistantMessage = result.choices?.[0]?.message?.content || "";
    }

    return new Response(
      JSON.stringify({
        response: assistantMessage,
        provider,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI chat error:", error);
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
