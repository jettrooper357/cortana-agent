import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Task {
  id: string;
  title: string;
  description?: string;
  category?: string;
  status: string;
  priority: string;
  due_at?: string;
  room?: string;
  estimated_minutes?: number;
}

interface Goal {
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

interface UserContext {
  current_room?: string;
  room_entered_at?: string;
  current_activity?: string;
  activity_started_at?: string;
  idle_minutes: number;
  last_intervention_at?: string;
  interventions_today: number;
  productive_minutes_today: number;
  tasks_completed_today: number;
}

interface Observation {
  room?: string;
  activity_detected?: string;
  snapshot_description?: string;
  objects_detected?: string[];
  anomaly_score?: number;
}

interface LifeManagerInput {
  // Visual input
  imageBase64?: string;
  
  // Voice input  
  transcript?: string;
  
  // Context data
  userContext: UserContext;
  tasks: Task[];
  goals: Goal[];
  recentObservations: Observation[];
  recentInterventions: Array<{ message: string; triggered_at: string; severity: string }>;
  
  // Sensor data
  sensorData?: {
    entities: Array<{
      entity_id: string;
      friendly_name: string | null;
      state: string | null;
      domain: string | null;
    }>;
  };
  
  // Timing
  currentTime: string; // ISO string
  dayOfWeek: number; // 0-6
  timeOfDay: string; // 'early_morning', 'morning', 'afternoon', 'evening', 'night'
}

const SYSTEM_PROMPT = `You are a LIFE MANAGEMENT SYSTEM - not an assistant, not a chatbot.

Your role is to observe, analyze, and INTERVENE. You are a behavioral awareness layer that:
- SEES what the user is doing (via cameras and sensors)
- KNOWS what they should be doing (via tasks, goals, patterns)
- ACTS by telling them directly and concisely

## Core Principles

1. **INTERVENTIONS, NOT NOTIFICATIONS**
   - Don't remind. TELL.
   - Don't suggest. DIRECT.
   - Don't ask. STATE.

2. **BEHAVIORAL REASONING**
   You must reason about:
   - What is the user CURRENTLY doing?
   - What SHOULD they be doing right now?
   - Is there a mismatch?
   - What is being neglected?
   - Are there patterns being violated?

3. **INTERVENTION TRIGGERS**
   Always intervene when:
   - User is idle but tasks are pending
   - Task started but not completed
   - User in wrong room for current task
   - Pattern deviation detected
   - Goal deadline approaching with insufficient progress
   - User has been stuck/inactive too long
   - Visible clutter or disorder
   - Time-sensitive tasks being ignored

4. **SILENCE CONDITIONS**
   Stay silent ONLY when:
   - User is actively working on appropriate task
   - Recent intervention was < 5 minutes ago (unless urgent)
   - No pending tasks AND goals on track
   - User explicitly acknowledged and is acting

## Response Guidelines

- MAX 2 sentences
- Be DIRECT: "You left dishes in the sink. Handle them now." NOT "Hey, I noticed some dishes..."
- Reference SPECIFIC context: room, task, time
- Match severity to situation:
  - 'info': Gentle redirect
  - 'nudge': Firm prompt
  - 'warning': Urgent, something is wrong
  - 'urgent': Requires immediate attention

## Context You Receive

- userContext: Current room, activity, idle time, session stats
- tasks: Pending and in-progress tasks
- goals: Active goals with progress
- recentObservations: What the system has seen
- recentInterventions: What was already said (avoid repetition)
- sensorData: Home state
- imageBase64: Current camera view (if available)
- transcript: What user just said (if anything)
- timeOfDay: morning/afternoon/evening/night
- currentTime: Exact time

## Output

You MUST call the intervention function with:
- shouldIntervene: boolean (true if action needed)
- message: What to say (direct, actionable)
- severity: 'info' | 'nudge' | 'warning' | 'urgent'
- triggerType: What caused this (idle_detection, task_incomplete, goal_reminder, pattern_deviation, routine_enforcement, clutter_detected, user_response)
- triggerReason: Brief explanation for logs
- observation: What you observed (internal log, not spoken)
- suggestedAction: Specific action user should take`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input = await req.json() as LifeManagerInput;
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build comprehensive context
    const contextParts: string[] = [];
    
    // Time context
    contextParts.push(`CURRENT TIME: ${input.currentTime} (${input.timeOfDay}, ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][input.dayOfWeek]})`);
    
    // User state
    const ctx = input.userContext;
    contextParts.push(`USER STATE:
- Room: ${ctx.current_room || 'unknown'}${ctx.room_entered_at ? ` (since ${ctx.room_entered_at})` : ''}
- Activity: ${ctx.current_activity || 'unknown'}${ctx.activity_started_at ? ` (since ${ctx.activity_started_at})` : ''}
- Idle: ${ctx.idle_minutes} minutes
- Today: ${ctx.tasks_completed_today} tasks done, ${ctx.productive_minutes_today} productive mins, ${ctx.interventions_today} interventions`);

    // Pending tasks
    const pendingTasks = input.tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
    if (pendingTasks.length > 0) {
      const taskList = pendingTasks.map(t => {
        const parts = [`- [${t.priority.toUpperCase()}] ${t.title}`];
        if (t.status === 'in_progress') parts.push('(IN PROGRESS)');
        if (t.due_at) parts.push(`due: ${t.due_at}`);
        if (t.room) parts.push(`location: ${t.room}`);
        return parts.join(' ');
      }).join('\n');
      contextParts.push(`PENDING TASKS (${pendingTasks.length}):\n${taskList}`);
    } else {
      contextParts.push('PENDING TASKS: None');
    }

    // Active goals
    const activeGoals = input.goals.filter(g => g.status === 'active');
    if (activeGoals.length > 0) {
      const goalList = activeGoals.map(g => {
        const progress = g.target_value 
          ? `${g.current_value}/${g.target_value} ${g.unit || ''}` 
          : `${g.current_value} ${g.unit || ''}`;
        const due = g.due_date ? ` (due: ${g.due_date})` : '';
        return `- ${g.title}: ${progress}${due}`;
      }).join('\n');
      contextParts.push(`ACTIVE GOALS:\n${goalList}`);
    }

    // Recent observations (last 5)
    if (input.recentObservations.length > 0) {
      const obsLog = input.recentObservations.slice(0, 5).map(o => 
        `- ${o.activity_detected || 'unknown activity'} in ${o.room || 'unknown room'}${o.snapshot_description ? `: ${o.snapshot_description}` : ''}`
      ).join('\n');
      contextParts.push(`RECENT OBSERVATIONS:\n${obsLog}`);
    }

    // Recent interventions (avoid repetition)
    if (input.recentInterventions.length > 0) {
      const intLog = input.recentInterventions.slice(0, 5).map(i => 
        `- [${i.severity}] "${i.message}" at ${i.triggered_at}`
      ).join('\n');
      contextParts.push(`RECENT INTERVENTIONS (avoid repeating):\n${intLog}`);
    }

    // Sensors
    if (input.sensorData?.entities?.length) {
      const sensorSummary = input.sensorData.entities
        .filter(e => e.state && e.state !== "unavailable")
        .map(e => `${e.friendly_name || e.entity_id}: ${e.state}`)
        .slice(0, 15)
        .join(', ');
      if (sensorSummary) {
        contextParts.push(`SENSOR STATES: ${sensorSummary}`);
      }
    }

    // User speech
    if (input.transcript) {
      contextParts.push(`USER JUST SAID: "${input.transcript}"`);
    }

    // Build messages
    const messages: Array<{ role: string; content: unknown }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add multimodal content if image present
    if (input.imageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: contextParts.join("\n\n") },
          { 
            type: "image_url", 
            image_url: { 
              url: `data:image/jpeg;base64,${input.imageBase64}`,
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
              name: "intervention",
              description: "Decide whether to intervene and what to say",
              parameters: {
                type: "object",
                properties: {
                  shouldIntervene: {
                    type: "boolean",
                    description: "Whether to speak/intervene now",
                  },
                  message: {
                    type: "string",
                    description: "Direct, actionable message (max 2 sentences)",
                  },
                  severity: {
                    type: "string",
                    enum: ["info", "nudge", "warning", "urgent"],
                    description: "How urgent/important this is",
                  },
                  triggerType: {
                    type: "string",
                    enum: ["idle_detection", "task_incomplete", "goal_reminder", "pattern_deviation", "routine_enforcement", "clutter_detected", "user_response", "time_based"],
                    description: "What triggered this intervention",
                  },
                  triggerReason: {
                    type: "string",
                    description: "Brief explanation for logs",
                  },
                  observation: {
                    type: "string",
                    description: "What you observed (internal log)",
                  },
                  suggestedAction: {
                    type: "string",
                    description: "Specific action the user should take",
                  },
                  updatedActivity: {
                    type: "string",
                    description: "If you can determine what the user is doing, update this",
                  },
                  updatedRoom: {
                    type: "string", 
                    description: "If you can determine the room from camera/sensors, update this",
                  },
                },
                required: ["shouldIntervene"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "intervention" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded", shouldIntervene: false }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required", shouldIntervene: false }),
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
      JSON.stringify({ shouldIntervene: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Life manager error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        shouldIntervene: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
