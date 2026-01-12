import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  imageBase64?: string;
  transcript?: string;
  userContext: UserContext;
  tasks: Task[];
  goals: Goal[];
  recentObservations: Observation[];
  recentInterventions: Array<{ message: string; triggered_at: string; severity: string }>;
  sensorData?: {
    entities: Array<{
      entity_id: string;
      friendly_name: string | null;
      state: string | null;
      domain: string | null;
    }>;
  };
  currentTime: string;
  dayOfWeek: number;
  timeOfDay: string;
}

const SYSTEM_PROMPT = `You are a LIFE MANAGEMENT SYSTEM - not an assistant, not a chatbot.

Your role is to observe, analyze, INTERVENE, and CREATE TASKS. You are a behavioral awareness layer that:
- SEES what the user is doing (via cameras and sensors)
- KNOWS what they should be doing (via tasks, goals, patterns)
- ACTS by telling them directly and concisely
- CREATES TASKS when you observe things that need to be done

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

3. **AUTOMATIC TASK CREATION**
   When you observe via camera that something needs attention, CREATE A TASK:
   - Dishes in sink → Create "Wash dishes" task
   - Trash overflowing → Create "Take out trash" task
   - Laundry on floor/pile → Create "Do laundry" task
   - Messy desk/room → Create "Clean [room]" task
   - Dirty bathroom → Create "Clean bathroom" task
   - Empty fridge/pantry → Create "Grocery shopping" task
   - Plants looking dry → Create "Water plants" task
   - Pet bowl empty → Create "Feed pet" task
   
   IMPORTANT: Before creating a task, check existing tasks to avoid duplicates!
   Only create if no similar task exists (pending or in_progress).

4. **INTERVENTION TRIGGERS**
   Always intervene when:
   - User is idle but tasks are pending
   - Task started but not completed
   - User in wrong room for current task
   - Pattern deviation detected
   - Goal deadline approaching with insufficient progress
   - User has been stuck/inactive too long
   - Visible clutter or disorder
   - Time-sensitive tasks being ignored

5. **SILENCE CONDITIONS**
   Stay silent ONLY when:
   - User is actively working on appropriate task
   - Recent intervention was < 5 minutes ago (unless urgent)
   - No pending tasks AND goals on track
   - User explicitly acknowledged and is acting

## Response Guidelines

- MAX 2 sentences for interventions
- Be DIRECT: "You left dishes in the sink. Handle them now." NOT "Hey, I noticed some dishes..."
- Reference SPECIFIC context: room, task, time
- Match severity to situation:
  - 'info': Gentle redirect
  - 'nudge': Firm prompt
  - 'warning': Urgent, something is wrong
  - 'urgent': Requires immediate attention

## Tools Available

1. **intervention**: Speak to the user (use for immediate needs)
2. **create_task**: Create a new task based on observation (use when you see something that needs doing)

You can use both tools in a single response - e.g., create a task AND tell the user about it.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input = await req.json() as LifeManagerInput;
    const authHeader = req.headers.get("Authorization");
    
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

    // Existing tasks (important for avoiding duplicates)
    const allTasks = input.tasks;
    const pendingTasks = allTasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
    if (allTasks.length > 0) {
      const taskList = allTasks.map(t => {
        const parts = [`- [${t.status.toUpperCase()}] [${t.priority.toUpperCase()}] ${t.title}`];
        if (t.due_at) parts.push(`due: ${t.due_at}`);
        if (t.room) parts.push(`location: ${t.room}`);
        return parts.join(' ');
      }).join('\n');
      contextParts.push(`EXISTING TASKS (check before creating new ones!):\n${taskList}`);
    } else {
      contextParts.push('EXISTING TASKS: None');
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

    // Recent observations
    if (input.recentObservations.length > 0) {
      const obsLog = input.recentObservations.slice(0, 5).map(o => 
        `- ${o.activity_detected || 'unknown activity'} in ${o.room || 'unknown room'}${o.snapshot_description ? `: ${o.snapshot_description}` : ''}`
      ).join('\n');
      contextParts.push(`RECENT OBSERVATIONS:\n${obsLog}`);
    }

    // Recent interventions
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

    // Camera instruction
    if (input.imageBase64) {
      contextParts.push(`\nCAMERA VIEW: Analyze the image for:
1. Things that need to be done (dishes, trash, laundry, clutter, etc.)
2. User's current activity
3. Room identification
If you see something that needs doing and no similar task exists, CREATE A TASK for it.`);
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

    const tools = [
      {
        type: "function",
        function: {
          name: "intervention",
          description: "Decide whether to intervene and what to say to the user",
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
                enum: ["idle_detection", "task_incomplete", "goal_reminder", "pattern_deviation", "routine_enforcement", "clutter_detected", "user_response", "time_based", "task_created"],
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
      {
        type: "function",
        function: {
          name: "create_task",
          description: "Create a new task based on camera observation. ONLY use if no similar task already exists.",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "Short, clear title for the task (e.g., 'Wash dishes', 'Take out trash')",
              },
              description: {
                type: "string",
                description: "Optional details about what was observed",
              },
              category: {
                type: "string",
                description: "Category: cleaning, laundry, kitchen, bathroom, organizing, errands, maintenance",
              },
              priority: {
                type: "string",
                enum: ["low", "medium", "high", "urgent"],
                description: "Priority based on urgency (overflowing trash = high, slight mess = low)",
              },
              room: {
                type: "string",
                description: "Room where the task should be done",
              },
              estimated_minutes: {
                type: "number",
                description: "Estimated time to complete in minutes",
              },
            },
            required: ["title", "priority"],
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
    const toolCalls = result.choices?.[0]?.message?.tool_calls;
    
    if (!toolCalls?.length) {
      return new Response(
        JSON.stringify({ shouldIntervene: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process tool calls
    let finalResponse: Record<string, unknown> = { shouldIntervene: false };
    const tasksToCreate: Array<Record<string, unknown>> = [];

    for (const toolCall of toolCalls) {
      const args = JSON.parse(toolCall.function.arguments);
      
      if (toolCall.function.name === "intervention") {
        finalResponse = { ...finalResponse, ...args };
      } else if (toolCall.function.name === "create_task") {
        tasksToCreate.push(args);
      }
    }

    // Create tasks if any
    if (tasksToCreate.length > 0 && authHeader) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        
        if (user && !userError) {
          const createdTasks: string[] = [];
          
          for (const task of tasksToCreate) {
            // Check if similar task already exists
            const { data: existingTasks } = await supabase
              .from('tasks')
              .select('id, title')
              .eq('user_id', user.id)
              .in('status', ['pending', 'in_progress'])
              .ilike('title', `%${task.title}%`);
            
            if (existingTasks && existingTasks.length > 0) {
              console.log(`Skipping duplicate task: ${task.title}`);
              continue;
            }

            const { error: insertError } = await supabase
              .from('tasks')
              .insert({
                user_id: user.id,
                title: task.title,
                description: task.description || `Auto-created from camera observation`,
                category: task.category || 'cleaning',
                priority: task.priority || 'medium',
                room: task.room || null,
                estimated_minutes: task.estimated_minutes || null,
                status: 'pending',
                requires_location: false,
                is_recurring: false,
                times_reminded: 0,
              });

            if (!insertError) {
              createdTasks.push(task.title as string);
            } else {
              console.error("Failed to create task:", insertError);
            }
          }

          if (createdTasks.length > 0) {
            finalResponse.tasksCreated = createdTasks;
            // If we created tasks but no intervention message, add one
            if (!finalResponse.shouldIntervene || !finalResponse.message) {
              finalResponse.shouldIntervene = true;
              finalResponse.message = createdTasks.length === 1
                ? `I noticed something and added "${createdTasks[0]}" to your tasks.`
                : `I noticed a few things and added ${createdTasks.length} tasks for you.`;
              finalResponse.severity = "info";
              finalResponse.triggerType = "task_created";
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
