export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      behavioral_observations: {
        Row: {
          activity_confidence: number | null
          activity_detected: string | null
          ai_interpretation: string | null
          anomaly_score: number | null
          camera_id: string | null
          created_at: string
          id: string
          objects_detected: string[] | null
          observed_at: string
          room: string | null
          sensor_data: Json | null
          snapshot_description: string | null
          user_id: string
        }
        Insert: {
          activity_confidence?: number | null
          activity_detected?: string | null
          ai_interpretation?: string | null
          anomaly_score?: number | null
          camera_id?: string | null
          created_at?: string
          id?: string
          objects_detected?: string[] | null
          observed_at?: string
          room?: string | null
          sensor_data?: Json | null
          snapshot_description?: string | null
          user_id: string
        }
        Update: {
          activity_confidence?: number | null
          activity_detected?: string | null
          ai_interpretation?: string | null
          anomaly_score?: number | null
          camera_id?: string | null
          created_at?: string
          id?: string
          objects_detected?: string[] | null
          observed_at?: string
          room?: string | null
          sensor_data?: Json | null
          snapshot_description?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "behavioral_observations_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: false
            referencedRelation: "cameras"
            referencedColumns: ["id"]
          },
        ]
      }
      behavioral_patterns: {
        Row: {
          confidence: number | null
          created_at: string
          days_of_week: number[] | null
          description: string | null
          expected_behavior: string | null
          frequency_per_week: number | null
          id: string
          is_active: boolean | null
          last_observed_at: string | null
          pattern_name: string
          pattern_type: string
          room: string | null
          time_of_day: string[] | null
          times_observed: number | null
          typical_duration_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          days_of_week?: number[] | null
          description?: string | null
          expected_behavior?: string | null
          frequency_per_week?: number | null
          id?: string
          is_active?: boolean | null
          last_observed_at?: string | null
          pattern_name: string
          pattern_type: string
          room?: string | null
          time_of_day?: string[] | null
          times_observed?: number | null
          typical_duration_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          days_of_week?: number[] | null
          description?: string | null
          expected_behavior?: string | null
          frequency_per_week?: number | null
          id?: string
          is_active?: boolean | null
          last_observed_at?: string | null
          pattern_name?: string
          pattern_type?: string
          room?: string | null
          time_of_day?: string[] | null
          times_observed?: number | null
          typical_duration_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cameras: {
        Row: {
          created_at: string | null
          description: string | null
          http_url: string | null
          id: string
          ip_address: string | null
          is_active: boolean | null
          last_seen: string | null
          name: string
          password: string | null
          port: number | null
          room: string | null
          rtsp_url: string | null
          updated_at: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          http_url?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_seen?: string | null
          name: string
          password?: string | null
          port?: number | null
          room?: string | null
          rtsp_url?: string | null
          updated_at?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          http_url?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_seen?: string | null
          name?: string
          password?: string | null
          port?: number | null
          room?: string | null
          rtsp_url?: string | null
          updated_at?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      goal_logs: {
        Row: {
          goal_id: string
          id: string
          logged_at: string | null
          metadata: Json | null
          notes: string | null
          source: string | null
          user_id: string
          value: number | null
        }
        Insert: {
          goal_id: string
          id?: string
          logged_at?: string | null
          metadata?: Json | null
          notes?: string | null
          source?: string | null
          user_id: string
          value?: number | null
        }
        Update: {
          goal_id?: string
          id?: string
          logged_at?: string | null
          metadata?: Json | null
          notes?: string | null
          source?: string | null
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_logs_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          camera_id: string | null
          category: string | null
          created_at: string | null
          current_value: number | null
          description: string | null
          due_date: string | null
          id: string
          monitoring_type: string[] | null
          n8n_workflow_id: string | null
          status: string | null
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          camera_id?: string | null
          category?: string | null
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          monitoring_type?: string[] | null
          n8n_workflow_id?: string | null
          status?: string | null
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          camera_id?: string | null
          category?: string | null
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          monitoring_type?: string[] | null
          n8n_workflow_id?: string | null
          status?: string | null
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: false
            referencedRelation: "cameras"
            referencedColumns: ["id"]
          },
        ]
      }
      home_assistant_config: {
        Row: {
          created_at: string
          id: string
          instance_url: string
          is_active: boolean | null
          last_connected_at: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_url: string
          is_active?: boolean | null
          last_connected_at?: string | null
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_url?: string
          is_active?: boolean | null
          last_connected_at?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      home_assistant_entities: {
        Row: {
          attributes: Json | null
          created_at: string
          domain: string | null
          entity_id: string
          friendly_name: string | null
          id: string
          last_updated_at: string | null
          state: string | null
          user_id: string
        }
        Insert: {
          attributes?: Json | null
          created_at?: string
          domain?: string | null
          entity_id: string
          friendly_name?: string | null
          id?: string
          last_updated_at?: string | null
          state?: string | null
          user_id: string
        }
        Update: {
          attributes?: Json | null
          created_at?: string
          domain?: string | null
          entity_id?: string
          friendly_name?: string | null
          id?: string
          last_updated_at?: string | null
          state?: string | null
          user_id?: string
        }
        Relationships: []
      }
      home_assistant_events: {
        Row: {
          entity_id: string
          event_type: string | null
          id: string
          metadata: Json | null
          new_state: string | null
          occurred_at: string | null
          old_state: string | null
          user_id: string
        }
        Insert: {
          entity_id: string
          event_type?: string | null
          id?: string
          metadata?: Json | null
          new_state?: string | null
          occurred_at?: string | null
          old_state?: string | null
          user_id: string
        }
        Update: {
          entity_id?: string
          event_type?: string | null
          id?: string
          metadata?: Json | null
          new_state?: string | null
          occurred_at?: string | null
          old_state?: string | null
          user_id?: string
        }
        Relationships: []
      }
      interventions: {
        Row: {
          acknowledged_at: string | null
          action_taken: string | null
          context_snapshot: Json | null
          created_at: string
          effectiveness_score: number | null
          id: string
          message: string
          observation_id: string | null
          related_goal_id: string | null
          room: string | null
          severity: string
          trigger_reason: string
          trigger_type: string
          triggered_at: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          action_taken?: string | null
          context_snapshot?: Json | null
          created_at?: string
          effectiveness_score?: number | null
          id?: string
          message: string
          observation_id?: string | null
          related_goal_id?: string | null
          room?: string | null
          severity?: string
          trigger_reason: string
          trigger_type: string
          triggered_at?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          action_taken?: string | null
          context_snapshot?: Json | null
          created_at?: string
          effectiveness_score?: number | null
          id?: string
          message?: string
          observation_id?: string | null
          related_goal_id?: string | null
          room?: string | null
          severity?: string
          trigger_reason?: string
          trigger_type?: string
          triggered_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interventions_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "behavioral_observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_related_goal_id_fkey"
            columns: ["related_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      n8n_integrations: {
        Row: {
          config: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_sync: string | null
          name: string
          type: string | null
          updated_at: string | null
          user_id: string
          webhook_url: string
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync?: string | null
          name: string
          type?: string | null
          updated_at?: string | null
          user_id: string
          webhook_url: string
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync?: string | null
          name?: string
          type?: string | null
          updated_at?: string | null
          user_id?: string
          webhook_url?: string
        }
        Relationships: []
      }
      rule_executions: {
        Row: {
          actions_executed: Json | null
          all_conditions_met: boolean
          conditions_evaluated: Json | null
          created_at: string
          error_message: string | null
          execution_status: string
          explanation: string | null
          id: string
          rule_id: string
          trigger_data: Json | null
          triggered_at: string
          user_id: string
        }
        Insert: {
          actions_executed?: Json | null
          all_conditions_met: boolean
          conditions_evaluated?: Json | null
          created_at?: string
          error_message?: string | null
          execution_status?: string
          explanation?: string | null
          id?: string
          rule_id: string
          trigger_data?: Json | null
          triggered_at?: string
          user_id: string
        }
        Update: {
          actions_executed?: Json | null
          all_conditions_met?: boolean
          conditions_evaluated?: Json | null
          created_at?: string
          error_message?: string | null
          execution_status?: string
          explanation?: string | null
          id?: string
          rule_id?: string
          trigger_data?: Json | null
          triggered_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_executions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rules"
            referencedColumns: ["id"]
          },
        ]
      }
      rules: {
        Row: {
          actions: Json
          category: string | null
          conditions: Json | null
          cooldown_minutes: number | null
          created_at: string
          description: string | null
          escalation_action: Json | null
          escalation_after_minutes: number | null
          escalation_enabled: boolean | null
          excluded_rooms: string[] | null
          excluded_times: Json | null
          explanation_template: string | null
          id: string
          is_enabled: boolean | null
          last_fired_at: string | null
          last_reset_date: string | null
          max_fires_per_day: number | null
          name: string
          severity: string | null
          times_fired: number | null
          times_fired_today: number | null
          trigger_config: Json
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actions?: Json
          category?: string | null
          conditions?: Json | null
          cooldown_minutes?: number | null
          created_at?: string
          description?: string | null
          escalation_action?: Json | null
          escalation_after_minutes?: number | null
          escalation_enabled?: boolean | null
          excluded_rooms?: string[] | null
          excluded_times?: Json | null
          explanation_template?: string | null
          id?: string
          is_enabled?: boolean | null
          last_fired_at?: string | null
          last_reset_date?: string | null
          max_fires_per_day?: number | null
          name: string
          severity?: string | null
          times_fired?: number | null
          times_fired_today?: number | null
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actions?: Json
          category?: string | null
          conditions?: Json | null
          cooldown_minutes?: number | null
          created_at?: string
          description?: string | null
          escalation_action?: Json | null
          escalation_after_minutes?: number | null
          escalation_enabled?: boolean | null
          excluded_rooms?: string[] | null
          excluded_times?: Json | null
          explanation_template?: string | null
          id?: string
          is_enabled?: boolean | null
          last_fired_at?: string | null
          last_reset_date?: string | null
          max_fires_per_day?: number | null
          name?: string
          severity?: string | null
          times_fired?: number | null
          times_fired_today?: number | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          category: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_at: string | null
          estimated_minutes: number | null
          id: string
          is_recurring: boolean | null
          last_reminded_at: string | null
          priority: string
          recurrence_rule: string | null
          requires_location: boolean | null
          room: string | null
          started_at: string | null
          status: string
          times_reminded: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          estimated_minutes?: number | null
          id?: string
          is_recurring?: boolean | null
          last_reminded_at?: string | null
          priority?: string
          recurrence_rule?: string | null
          requires_location?: boolean | null
          room?: string | null
          started_at?: string | null
          status?: string
          times_reminded?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          estimated_minutes?: number | null
          id?: string
          is_recurring?: boolean | null
          last_reminded_at?: string | null
          priority?: string
          recurrence_rule?: string | null
          requires_location?: boolean | null
          room?: string | null
          started_at?: string | null
          status?: string
          times_reminded?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_context: {
        Row: {
          active_task_id: string | null
          activity_started_at: string | null
          current_activity: string | null
          current_room: string | null
          id: string
          idle_minutes: number | null
          idle_minutes_today: number | null
          interventions_today: number | null
          last_intervention_at: string | null
          last_movement_at: string | null
          productive_minutes_today: number | null
          room_entered_at: string | null
          session_started_at: string | null
          task_started_at: string | null
          tasks_completed_today: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_task_id?: string | null
          activity_started_at?: string | null
          current_activity?: string | null
          current_room?: string | null
          id?: string
          idle_minutes?: number | null
          idle_minutes_today?: number | null
          interventions_today?: number | null
          last_intervention_at?: string | null
          last_movement_at?: string | null
          productive_minutes_today?: number | null
          room_entered_at?: string | null
          session_started_at?: string | null
          task_started_at?: string | null
          tasks_completed_today?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_task_id?: string | null
          activity_started_at?: string | null
          current_activity?: string | null
          current_room?: string | null
          id?: string
          idle_minutes?: number | null
          idle_minutes_today?: number | null
          interventions_today?: number | null
          last_intervention_at?: string | null
          last_movement_at?: string | null
          productive_minutes_today?: number | null
          room_entered_at?: string | null
          session_started_at?: string | null
          task_started_at?: string | null
          tasks_completed_today?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_context_active_task_id_fkey"
            columns: ["active_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string | null
          id: string
          settings: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          settings?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          settings?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
