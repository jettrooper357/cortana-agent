import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, apiKey, exaggeration, cfg_weight } = await req.json();

    // Accept API key from request body or fall back to environment variable
    const FAL_API_KEY = apiKey || Deno.env.get("FAL_API_KEY");
    if (!FAL_API_KEY) {
      throw new Error("FAL_API_KEY is not configured. Please add your fal.ai API key in Settings → Webhooks → Chatterbox.");
    }

    if (!text || typeof text !== "string") {
      throw new Error("Text is required");
    }

    console.log("[Chatterbox TTS] Generating speech for:", text.substring(0, 100));

    // Call fal.ai Chatterbox Turbo API
    const response = await fetch("https://queue.fal.run/fal-ai/chatterbox/text-to-speech/turbo", {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        exaggeration: exaggeration ?? 0.5, // Controls expressiveness (0-1)
        cfg_weight: cfg_weight ?? 0.5, // Controls adherence to text (0-1)
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Chatterbox TTS] fal.ai error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`fal.ai API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("[Chatterbox TTS] Response received:", Object.keys(data));

    // fal.ai returns request_id for queue-based requests
    // We need to poll for completion
    if (data.request_id) {
      const requestId = data.request_id;
      let result = null;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await fetch(`https://queue.fal.run/fal-ai/chatterbox/text-to-speech/turbo/requests/${requestId}/status`, {
          headers: {
            "Authorization": `Key ${FAL_API_KEY}`,
          },
        });

        if (!statusResponse.ok) {
          attempts++;
          continue;
        }

        const statusData = await statusResponse.json();
        console.log("[Chatterbox TTS] Status:", statusData.status);

        if (statusData.status === "COMPLETED") {
          // Fetch the result
          const resultResponse = await fetch(`https://queue.fal.run/fal-ai/chatterbox/text-to-speech/turbo/requests/${requestId}`, {
            headers: {
              "Authorization": `Key ${FAL_API_KEY}`,
            },
          });

          if (resultResponse.ok) {
            result = await resultResponse.json();
            break;
          }
        } else if (statusData.status === "FAILED") {
          throw new Error("Chatterbox TTS generation failed");
        }

        attempts++;
      }

      if (!result) {
        throw new Error("Timeout waiting for Chatterbox TTS");
      }

      // The result should contain an audio URL
      if (result.audio?.url) {
        // Fetch the audio and convert to base64
        const audioResponse = await fetch(result.audio.url);
        if (!audioResponse.ok) {
          throw new Error("Failed to fetch generated audio");
        }

        const audioBuffer = await audioResponse.arrayBuffer();
        const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

        return new Response(
          JSON.stringify({ 
            audioContent: audioBase64,
            contentType: "audio/wav",
            duration: result.audio.duration,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Direct response (non-queued)
    if (data.audio?.url) {
      const audioResponse = await fetch(data.audio.url);
      if (!audioResponse.ok) {
        throw new Error("Failed to fetch generated audio");
      }

      const audioBuffer = await audioResponse.arrayBuffer();
      const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

      return new Response(
        JSON.stringify({ 
          audioContent: audioBase64,
          contentType: "audio/wav",
          duration: data.audio.duration,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("No audio returned from Chatterbox TTS");

  } catch (error) {
    console.error("[Chatterbox TTS] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
