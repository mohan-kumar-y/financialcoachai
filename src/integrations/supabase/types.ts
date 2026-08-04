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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      brain_runs: {
        Row: {
          capability_calls: Json | null
          correlation_id: string
          created_at: string
          id: string
          iterations: number
          latency_ms: number | null
          model: string
          plan: Json | null
          prompt_version: string
          request_text: string | null
          token_cost: number | null
          trigger_type: string
          user_id: string | null
        }
        Insert: {
          capability_calls?: Json | null
          correlation_id: string
          created_at?: string
          id?: string
          iterations?: number
          latency_ms?: number | null
          model: string
          plan?: Json | null
          prompt_version: string
          request_text?: string | null
          token_cost?: number | null
          trigger_type: string
          user_id?: string | null
        }
        Update: {
          capability_calls?: Json | null
          correlation_id?: string
          created_at?: string
          id?: string
          iterations?: number
          latency_ms?: number | null
          model?: string
          plan?: Json | null
          prompt_version?: string
          request_text?: string | null
          token_cost?: number | null
          trigger_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      decisions: {
        Row: {
          action: string
          brain_version: string | null
          confidence: number
          contradicting_evidence_ids: string[] | null
          correlation_id: string
          counter_thesis: string | null
          created_at: string
          execution_proposal: Json | null
          id: string
          instrument: string | null
          invalidation_conditions: string[] | null
          missing_evidence: string[] | null
          monitoring_plan: string | null
          risks: string[] | null
          strategy: string | null
          supporting_evidence_ids: string[] | null
          thesis: string | null
          time_horizon: string | null
          validation_result: string | null
        }
        Insert: {
          action: string
          brain_version?: string | null
          confidence?: number
          contradicting_evidence_ids?: string[] | null
          correlation_id: string
          counter_thesis?: string | null
          created_at?: string
          execution_proposal?: Json | null
          id?: string
          instrument?: string | null
          invalidation_conditions?: string[] | null
          missing_evidence?: string[] | null
          monitoring_plan?: string | null
          risks?: string[] | null
          strategy?: string | null
          supporting_evidence_ids?: string[] | null
          thesis?: string | null
          time_horizon?: string | null
          validation_result?: string | null
        }
        Update: {
          action?: string
          brain_version?: string | null
          confidence?: number
          contradicting_evidence_ids?: string[] | null
          correlation_id?: string
          counter_thesis?: string | null
          created_at?: string
          execution_proposal?: Json | null
          id?: string
          instrument?: string | null
          invalidation_conditions?: string[] | null
          missing_evidence?: string[] | null
          monitoring_plan?: string | null
          risks?: string[] | null
          strategy?: string | null
          supporting_evidence_ids?: string[] | null
          thesis?: string | null
          time_horizon?: string | null
          validation_result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decisions_correlation_id_fkey"
            columns: ["correlation_id"]
            isOneToOne: false
            referencedRelation: "brain_runs"
            referencedColumns: ["correlation_id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          expense_date: string
          id: string
          notes: string | null
          payment_method: string
          subcategory: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string
          subcategory?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string
          subcategory?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      explanations: {
        Row: {
          action: string | null
          confidence: number | null
          counter_arguments: string[] | null
          counter_thesis: string | null
          created_at: string
          decision_id: string
          evidence: string[] | null
          id: string
          portfolio_impact: string | null
          recommendation: string | null
          risks: string[] | null
          thesis: string | null
          what_happened: string | null
          what_would_change_view: string[] | null
          why_it_matters: string | null
        }
        Insert: {
          action?: string | null
          confidence?: number | null
          counter_arguments?: string[] | null
          counter_thesis?: string | null
          created_at?: string
          decision_id: string
          evidence?: string[] | null
          id?: string
          portfolio_impact?: string | null
          recommendation?: string | null
          risks?: string[] | null
          thesis?: string | null
          what_happened?: string | null
          what_would_change_view?: string[] | null
          why_it_matters?: string | null
        }
        Update: {
          action?: string | null
          confidence?: number | null
          counter_arguments?: string[] | null
          counter_thesis?: string | null
          created_at?: string
          decision_id?: string
          evidence?: string[] | null
          id?: string
          portfolio_impact?: string | null
          recommendation?: string | null
          risks?: string[] | null
          thesis?: string | null
          what_happened?: string | null
          what_would_change_view?: string[] | null
          why_it_matters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "explanations_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_plans: {
        Row: {
          annual_increment_pct: number
          annual_salary: number
          checklist: Json
          created_at: string
          currency: string
          current_sip: number
          emergency_months: number
          id: string
          investment_horizon_years: number
          monthly_expenses: number
          risk_appetite: string
          sip_step_up_pct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_increment_pct?: number
          annual_salary?: number
          checklist?: Json
          created_at?: string
          currency?: string
          current_sip?: number
          emergency_months?: number
          id?: string
          investment_horizon_years?: number
          monthly_expenses?: number
          risk_appetite?: string
          sip_step_up_pct?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_increment_pct?: number
          annual_salary?: number
          checklist?: Json
          created_at?: string
          currency?: string
          current_sip?: number
          emergency_months?: number
          id?: string
          investment_horizon_years?: number
          monthly_expenses?: number
          risk_appetite?: string
          sip_step_up_pct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      holdings: {
        Row: {
          asset_type: string
          avg_buy_price: number
          category: string | null
          created_at: string
          current_price: number
          id: string
          name: string
          symbol: string | null
          units: number
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_type?: string
          avg_buy_price?: number
          category?: string | null
          created_at?: string
          current_price?: number
          id?: string
          name: string
          symbol?: string | null
          units?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_type?: string
          avg_buy_price?: number
          category?: string | null
          created_at?: string
          current_price?: number
          id?: string
          name?: string
          symbol?: string | null
          units?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      market_cache: {
        Row: {
          cache_key: string
          endpoint: string
          fetched_at: string
          payload: Json
          source: string
          status: string
        }
        Insert: {
          cache_key: string
          endpoint: string
          fetched_at?: string
          payload: Json
          source?: string
          status?: string
        }
        Update: {
          cache_key?: string
          endpoint?: string
          fetched_at?: string
          payload?: Json
          source?: string
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          created_at: string
          id: string
          name: string
          symbol: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          symbol: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
