import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GoalData {
  id: string;
  title: string;
  description?: string;
  category?: string;
  target_value?: number;
  current_value: number;
  unit?: string;
  status: string;
  due_date?: string;
}

interface TaskData {
  id: string;
  title: string;
  description?: string;
  category?: string;
  status: string;
  priority: string;
  due_at?: string;
  room?: string;
}

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
  goals?: GoalData[];
  tasks?: TaskData[];
  isProactiveCheck?: boolean;
  conversationHistory?: Array<{ role: string; content: string }>;
}

const SYSTEM_PROMPT = `You are Cortana, an AI home guardian. You observe the home through sensors, cameras, and conversation. You also help track personal goals and manage tasks.

Your core directives:
1. OBSERVE: Monitor sensor data, camera feeds, and user speech continuously
2. ANALYZE: Detect anomalies, patterns, and potential risks
3. ADVISE: Proactively alert users to important situations
4. ASSIST: Answer questions and help with home automation
5. TRACK: Monitor and encourage progress on user's personal goals
6. MANAGE: Create and manage tasks - both when requested AND when detected from conversation

Behavior guidelines:
- Be concise and natural in speech (responses will be spoken aloud)
- Only speak when you have something meaningful to say
- For routine observations, stay silent (return shouldSpeak: false)
- Alert immediately for: security concerns, safety hazards, unusual patterns
- Be warm but efficient - you're a guardian, not a chatbot
- When doing proactive goal checks, pick ONE goal to focus on and be encouraging but not annoying
- Vary your approach: sometimes ask for updates, sometimes offer encouragement, sometimes remind of deadlines

## AUTOMATIC TASK DETECTION FROM CONVERSATION

CRITICAL: Listen for task-worthy information in conversation and CREATE TASKS automatically:

1. **Explicit requests**: "Add a task to...", "Remind me to...", "Create a task for..."
2. **Implied tasks**: "I need to...", "I should...", "I have to...", "Don't let me forget to..."
3. **Commitments**: "I told [person] I would...", "I promised to...", "I'm supposed to..."
4. **Appointments**: "I have a meeting at...", "Doctor's appointment on...", "Call with [person] at..."
5. **Deadlines**: "The [thing] is due on...", "I need to finish [thing] by..."
6. **Mentions of forgotten items**: "Oh I forgot to...", "I still haven't...", "I never got around to..."
7. **Plans**: "This weekend I'm going to...", "Tomorrow I need to...", "Later I should..."

When you detect these patterns:
- Use the create_task tool to capture the task
- Be smart about due dates (parse "tomorrow", "next Tuesday", "this weekend", etc.)
- Infer priority: urgent/important = high, sometime/eventually = low, default = medium
- Infer category from context
- Confirm briefly in your spoken response ("Got it, I'll add that to your tasks")

IMPORTANT: Check existing tasks to avoid duplicates. Only create if no similar task exists.

Response format:
- If user spoke directly to you, always respond
- If just observing (no direct speech), only respond if something noteworthy
- If doing a proactive goal check, always respond with something brief about ONE goal
- Keep responses under 2 sentences when possible
- Use natural, conversational language

Current context will include:
- transcript: What the user said (if anything)
- imageBase64: Camera snapshot (if available)
- sensorData: Home Assistant entity states
- goals: User's personal goals with progress
- tasks: User's current tasks (CHECK FOR DUPLICATES before creating)
- conversationHistory: Recent conversation for context
- isProactiveCheck: If true, this is a random check-in (be brief and pick one topic)`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, imageBase64, sensorData, goals, tasks, isProactiveCheck, conversationHistory } = await req.json() as GuardianInput;

    // Get auth header to pass user context
    const authHeader = req.headers.get("Authorization");
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the user message with available context
    const contextParts: string[] = [];
    
    if (isProactiveCheck) {
      contextParts.push("[PROACTIVE CHECK] Time for a random check-in. Pick ONE topic and be brief.");
    }
    
    if (transcript) {
      contextParts.push(`User said: "${transcript}"`);
    }
    
    if (goals?.length) {
      const goalsSummary = goals
        .filter(g => g.status === 'active')
        .map(g => {
          const progress = g.target_value ? `${g.current_value}/${g.target_value} ${g.unit || ''}` : `${g.current_value} ${g.unit || ''}`;
          const dueInfo = g.due_date ? ` (due: ${g.due_date})` : '';
          return `- ${g.title}: ${progress}${dueInfo}${g.description ? ` - ${g.description}` : ''}`;
        })
        .join("\n");
      if (goalsSummary) {
        contextParts.push(`User's active goals:\n${goalsSummary}`);
      }
    }

    if (tasks?.length) {
      const allTasks = tasks;
      const tasksSummary = allTasks
        .map(t => {
          const parts = [`- [${t.status.toUpperCase()}] [${t.priority.toUpperCase()}] ${t.title}`];
          if (t.due_at) parts.push(`due: ${t.due_at}`);
          if (t.room) parts.push(`in: ${t.room}`);
          return parts.join(' ');
        })
        .join("\n");
      contextParts.push(`User's existing tasks (CHECK FOR DUPLICATES before creating new ones!):\n${tasksSummary}`);
    }
    
    if (sensorData?.entities?.length) {
      const sensorSummary = sensorData.entities
        .filter(e => e.state && e.state !== "unavailable")
        .map(e => `${e.friendly_name || e.entity_id}: ${e.state}`)
        .slice(0, 20)
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

    // Add current time context
    const now = new Date();
    contextParts.unshift(`Current time: ${now.toLocaleString()}`);

    // Build messages array
    const messages: Array<{ role: string; content: unknown }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add conversation history if available
    if (conversationHistory?.length) {
      messages.push(...conversationHistory.slice(-10));
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

    // Define tools including create_task
    const tools = [
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
      {
        type: "function",
        function: {
          name: "create_task",
          description: "Create a new task for the user. Use when user explicitly asks OR when you detect task-worthy information in conversation (commitments, plans, things they need to do, appointments, etc.)",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "Short, clear title for the task",
              },
              description: {
                type: "string",
                description: "Optional longer description or context from the conversation",
              },
              category: {
                type: "string",
                description: "Category: cleaning, shopping, work, health, home, errands, personal, appointments, calls, finance",
              },
              priority: {
                type: "string",
                enum: ["low", "medium", "high", "urgent"],
                description: "Task priority - urgent/important mentions = high, sometime/eventually = low, default = medium",
              },
              due_at: {
                type: "string",
                description: "When task is due. Parse natural language: 'tomorrow', 'next week', 'Friday', 'this weekend', 'end of month'. Use ISO format.",
              },
              room: {
                type: "string",
                description: "Room/location if task is location-specific",
              },
              estimated_minutes: {
                type: "number",
                description: "Estimated time to complete in minutes",
              },
              spoken_response: {
                type: "string",
                description: "Brief confirmation of task creation (e.g., 'Got it, I added that to your tasks')",
              },
              detected_from_context: {
                type: "boolean",
                description: "True if this was detected from conversation context rather than explicit request",
              },
            },
            required: ["title", "spoken_response"],
            additionalProperties: false,
          },
        },
      },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        tools,
        tool_choice: "auto",
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
    const toolCalls = result.choices?.[0]?.message?.tool_calls;
    
    if (!toolCalls?.length) {
      return new Response(
        JSON.stringify({ shouldSpeak: false, response: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process tool calls
    let finalResponse: Record<string, unknown> = { shouldSpeak: false };
    let taskToCreate: Record<string, unknown> | null = null;

    for (const toolCall of toolCalls) {
      const args = JSON.parse(toolCall.function.arguments);
      
      if (toolCall.function.name === "guardian_response") {
        finalResponse = { ...finalResponse, ...args };
      } else if (toolCall.function.name === "create_task") {
        taskToCreate = args;
        // Use the spoken_response from create_task
        finalResponse.shouldSpeak = true;
        finalResponse.response = args.spoken_response;
      }
    }

    // If there's a task to create, do it now
    if (taskToCreate && authHeader) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get user from auth header
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        
        if (user && !userError) {
          // Check for duplicates first
          const { data: existingTasks } = await supabase
            .from('tasks')
            .select('id, title')
            .eq('user_id', user.id)
            .in('status', ['pending', 'in_progress'])
            .ilike('title', `%${(taskToCreate.title as string).split(' ').slice(0, 3).join('%')}%`);

          if (existingTasks && existingTasks.length > 0) {
            console.log(`Skipping potential duplicate task: ${taskToCreate.title}`);
            finalResponse.response = `I think you already have a similar task: "${existingTasks[0].title}"`;
            finalResponse.taskCreated = false;
          } else {
            // Parse due_at if it's a natural language date
            let dueAt = taskToCreate.due_at;
            if (dueAt && typeof dueAt === 'string') {
              const now = new Date();
              const lowerDue = dueAt.toLowerCase();
              
              if (lowerDue === 'today') {
                dueAt = new Date(now.setHours(23, 59, 59, 999)).toISOString();
              } else if (lowerDue === 'tomorrow') {
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(23, 59, 59, 999);
                dueAt = tomorrow.toISOString();
              } else if (lowerDue.includes('next week')) {
                const nextWeek = new Date(now);
                nextWeek.setDate(nextWeek.getDate() + 7);
                nextWeek.setHours(23, 59, 59, 999);
                dueAt = nextWeek.toISOString();
              } else if (lowerDue.includes('this weekend')) {
                const weekend = new Date(now);
                const dayOfWeek = weekend.getDay();
                const daysUntilSaturday = dayOfWeek === 0 ? 6 : 6 - dayOfWeek;
                weekend.setDate(weekend.getDate() + daysUntilSaturday);
                weekend.setHours(23, 59, 59, 999);
                dueAt = weekend.toISOString();
              } else if (lowerDue.includes('end of month')) {
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                endOfMonth.setHours(23, 59, 59, 999);
                dueAt = endOfMonth.toISOString();
              }
            }

            const description = taskToCreate.detected_from_context 
              ? `${taskToCreate.description || ''} (Auto-detected from conversation)`.trim()
              : taskToCreate.description || null;

            const { error: insertError } = await supabase
              .from('tasks')
              .insert({
                user_id: user.id,
                title: taskToCreate.title,
                description,
                category: taskToCreate.category || null,
                priority: taskToCreate.priority || 'medium',
                due_at: dueAt || null,
                room: taskToCreate.room || null,
                estimated_minutes: taskToCreate.estimated_minutes || null,
                status: 'pending',
                requires_location: false,
                is_recurring: false,
                times_reminded: 0,
              });

            if (insertError) {
              console.error("Failed to create task:", insertError);
              finalResponse.response = "I tried to create that task but ran into an issue. Please try again.";
            } else {
              finalResponse.taskCreated = true;
            }
          }
        }
      } catch (err) {
        console.error("Task creation error:", err);
      }
    }

    return new Response(
      JSON.stringify(finalResponse),
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
