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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      body_metrics: {
        Row: {
          id: string
          measured_on: string
          notes: string | null
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          id?: string
          measured_on: string
          notes?: string | null
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          id?: string
          measured_on?: string
          notes?: string | null
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      cook_session_recipes: {
        Row: {
          recipe_id: string
          servings_produced: number
          session_id: string
        }
        Insert: {
          recipe_id: string
          servings_produced: number
          session_id: string
        }
        Update: {
          recipe_id?: string
          servings_produced?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cook_session_recipes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_macros"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "cook_session_recipes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cook_session_recipes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cook_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cook_sessions: {
        Row: {
          cook_date: string
          id: string
          notes: string | null
          plan_id: string
        }
        Insert: {
          cook_date: string
          id?: string
          notes?: string | null
          plan_id: string
        }
        Update: {
          cook_date?: string
          id?: string
          notes?: string | null
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cook_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          equipment: string | null
          id: string
          muscle_group: string
          name: string
          user_id: string
        }
        Insert: {
          equipment?: string | null
          id?: string
          muscle_group: string
          name: string
          user_id: string
        }
        Update: {
          equipment?: string | null
          id?: string
          muscle_group?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      foods: {
        Row: {
          carbs_100g: number
          cooked_yield: number | null
          created_at: string
          embedding: string | null
          fat_100g: number
          fiber_100g: number | null
          id: string
          is_excluded: boolean
          kcal_100g: number
          name: string
          protein_100g: number
          search_name: string
          source: Database["public"]["Enums"]["food_source"]
          source_detail: string | null
          source_ref: string | null
          user_id: string | null
        }
        Insert: {
          carbs_100g: number
          cooked_yield?: number | null
          created_at?: string
          embedding?: string | null
          fat_100g: number
          fiber_100g?: number | null
          id?: string
          is_excluded?: boolean
          kcal_100g: number
          name: string
          protein_100g: number
          search_name: string
          source?: Database["public"]["Enums"]["food_source"]
          source_detail?: string | null
          source_ref?: string | null
          user_id?: string | null
        }
        Update: {
          carbs_100g?: number
          cooked_yield?: number | null
          created_at?: string
          embedding?: string | null
          fat_100g?: number
          fiber_100g?: number | null
          id?: string
          is_excluded?: boolean
          kcal_100g?: number
          name?: string
          protein_100g?: number
          search_name?: string
          source?: Database["public"]["Enums"]["food_source"]
          source_detail?: string | null
          source_ref?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      meal_plan_slots: {
        Row: {
          eating_out: boolean
          id: string
          meal: Database["public"]["Enums"]["meal_type"]
          notes: string | null
          plan_id: string
          recipe_id: string | null
          servings: number
          slot_date: string
        }
        Insert: {
          eating_out?: boolean
          id?: string
          meal: Database["public"]["Enums"]["meal_type"]
          notes?: string | null
          plan_id: string
          recipe_id?: string | null
          servings?: number
          slot_date: string
        }
        Update: {
          eating_out?: boolean
          id?: string
          meal?: Database["public"]["Enums"]["meal_type"]
          notes?: string | null
          plan_id?: string
          recipe_id?: string | null
          servings?: number
          slot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_slots_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_slots_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_macros"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "meal_plan_slots_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string
          id: string
          status: string
          target_kcal: number
          target_protein: number
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          target_kcal?: number
          target_protein?: number
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          target_kcal?: number
          target_protein?: number
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      nutrition_targets: {
        Row: {
          carbs_g: number
          created_at: string
          effective_from: string
          fat_g: number
          id: string
          kcal: number
          notes: string | null
          protein_g: number
          user_id: string
        }
        Insert: {
          carbs_g: number
          created_at?: string
          effective_from: string
          fat_g: number
          id?: string
          kcal: number
          notes?: string | null
          protein_g: number
          user_id: string
        }
        Update: {
          carbs_g?: number
          created_at?: string
          effective_from?: string
          fat_g?: number
          id?: string
          kcal?: number
          notes?: string | null
          protein_g?: number
          user_id?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          food_id: string
          grams: number
          note: string | null
          recipe_id: string
        }
        Insert: {
          food_id: string
          grams: number
          note?: string | null
          recipe_id: string
        }
        Update: {
          food_id?: string
          grams?: number
          note?: string | null
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_macros"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          batch_friendly: boolean
          created_at: string
          freezer_ok: boolean
          fridge_days: number | null
          id: string
          instructions: string | null
          name: string
          prep_minutes: number | null
          servings: number
          source_url: string | null
          user_id: string
        }
        Insert: {
          batch_friendly?: boolean
          created_at?: string
          freezer_ok?: boolean
          fridge_days?: number | null
          id?: string
          instructions?: string | null
          name: string
          prep_minutes?: number | null
          servings: number
          source_url?: string | null
          user_id: string
        }
        Update: {
          batch_friendly?: boolean
          created_at?: string
          freezer_ok?: boolean
          fridge_days?: number | null
          id?: string
          instructions?: string | null
          name?: string
          prep_minutes?: number | null
          servings?: number
          source_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      workout_sets: {
        Row: {
          exercise_id: string
          id: string
          reps: number | null
          rir: number | null
          set_number: number
          weight_kg: number | null
          workout_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          reps?: number | null
          rir?: number | null
          set_number: number
          weight_kg?: number | null
          workout_id: string
        }
        Update: {
          exercise_id?: string
          id?: string
          reps?: number | null
          rir?: number | null
          set_number?: number
          weight_kg?: number | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sets_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          focus: string | null
          id: string
          notes: string | null
          perceived_effort: number | null
          performed_on: string
          user_id: string
        }
        Insert: {
          focus?: string | null
          id?: string
          notes?: string | null
          perceived_effort?: number | null
          performed_on: string
          user_id: string
        }
        Update: {
          focus?: string | null
          id?: string
          notes?: string | null
          perceived_effort?: number | null
          performed_on?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      plan_balance: {
        Row: {
          balance: number | null
          consumed: number | null
          plan_id: string | null
          produced: number | null
          recipe_id: string | null
        }
        Relationships: []
      }
      recipe_macros: {
        Row: {
          carbs_per_serving: number | null
          carbs_total: number | null
          fat_per_serving: number | null
          fat_total: number | null
          kcal_per_serving: number | null
          kcal_total: number | null
          protein_per_serving: number | null
          protein_total: number | null
          recipe_id: string | null
          servings: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      compute_recipe_macros: {
        Args: { p_food_ids: string[]; p_grams: number[]; p_servings: number }
        Returns: {
          carbs_per_serving: number
          fat_per_serving: number
          kcal_per_serving: number
          protein_per_serving: number
        }[]
      }
      normalize_search_name: { Args: { input: string }; Returns: string }
      search_foods: {
        Args: { query: string }
        Returns: {
          carbs_100g: number
          fat_100g: number
          id: string
          kcal_100g: number
          name: string
          protein_100g: number
          source_detail: string
        }[]
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      food_source: "bedca" | "openfoodfacts" | "manual"
      meal_type: "breakfast" | "midmorning" | "lunch" | "snack" | "dinner"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      food_source: ["bedca", "openfoodfacts", "manual"],
      meal_type: ["breakfast", "midmorning", "lunch", "snack", "dinner"],
    },
  },
} as const
