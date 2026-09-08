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
      channel_fees: {
        Row: {
          cap_amount: number | null
          channel_id: string
          created_at: string
          created_by: string | null
          fee_type: string
          floor_amount: number
          id: string
          min_order_threshold: number | null
          pct: number
        }
        Insert: {
          cap_amount?: number | null
          channel_id: string
          created_at?: string
          created_by?: string | null
          fee_type: string
          floor_amount?: number
          id?: string
          min_order_threshold?: number | null
          pct?: number
        }
        Update: {
          cap_amount?: number | null
          channel_id?: string
          created_at?: string
          created_by?: string | null
          fee_type?: string
          floor_amount?: number
          id?: string
          min_order_threshold?: number | null
          pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "channel_fees_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          id: string
          markup_pct: number | null
          notes: string | null
          store: string
        }
        Insert: {
          channel: string
          created_at?: string
          created_by?: string | null
          id?: string
          markup_pct?: number | null
          notes?: string | null
          store: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          markup_pct?: number | null
          notes?: string | null
          store?: string
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
            referencedRelation: "recipe_fit"
            referencedColumns: ["recipe_id"]
          },
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
          {
            foreignKeyName: "cook_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "shopping_list"
            referencedColumns: ["plan_id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_by: string | null
          equipment: string | null
          id: string
          muscle_group: string
          name: string
        }
        Insert: {
          created_by?: string | null
          equipment?: string | null
          id?: string
          muscle_group: string
          name: string
        }
        Update: {
          created_by?: string | null
          equipment?: string | null
          id?: string
          muscle_group?: string
          name?: string
        }
        Relationships: []
      }
      foods: {
        Row: {
          carbs_100g: number
          carbs_convention: string
          carbs_convention_source: string
          carbs_total_100g: number | null
          cooked_yield: number | null
          created_at: string
          created_by: string | null
          display_name: string | null
          embedding: string | null
          fat_100g: number
          fiber_100g: number | null
          id: string
          is_excluded: boolean
          is_staple: boolean
          kcal_100g: number
          macros_source_note: string | null
          name: string
          protein_100g: number
          search_name: string
          source: Database["public"]["Enums"]["food_source"]
          source_detail: string | null
          source_ref: string | null
          store_zone: string | null
        }
        Insert: {
          carbs_100g: number
          carbs_convention?: string
          carbs_convention_source?: string
          carbs_total_100g?: number | null
          cooked_yield?: number | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          embedding?: string | null
          fat_100g: number
          fiber_100g?: number | null
          id?: string
          is_excluded?: boolean
          is_staple?: boolean
          kcal_100g: number
          macros_source_note?: string | null
          name: string
          protein_100g: number
          search_name: string
          source?: Database["public"]["Enums"]["food_source"]
          source_detail?: string | null
          source_ref?: string | null
          store_zone?: string | null
        }
        Update: {
          carbs_100g?: number
          carbs_convention?: string
          carbs_convention_source?: string
          carbs_total_100g?: number | null
          cooked_yield?: number | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          embedding?: string | null
          fat_100g?: number
          fiber_100g?: number | null
          id?: string
          is_excluded?: boolean
          is_staple?: boolean
          kcal_100g?: number
          macros_source_note?: string | null
          name?: string
          protein_100g?: number
          search_name?: string
          source?: Database["public"]["Enums"]["food_source"]
          source_detail?: string | null
          source_ref?: string | null
          store_zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "foods_store_zone_fkey"
            columns: ["store_zone"]
            isOneToOne: false
            referencedRelation: "store_zones"
            referencedColumns: ["zone"]
          },
        ]
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
            foreignKeyName: "meal_plan_slots_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "shopping_list"
            referencedColumns: ["plan_id"]
          },
          {
            foreignKeyName: "meal_plan_slots_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_fit"
            referencedColumns: ["recipe_id"]
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
          target_kcal: number
          target_protein: number
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
      meal_rotation_slots: {
        Row: {
          eating_out: boolean
          meal: Database["public"]["Enums"]["meal_type"]
          recipe_id: string | null
          rotation_id: string
          servings: number
          weekday: number
        }
        Insert: {
          eating_out?: boolean
          meal: Database["public"]["Enums"]["meal_type"]
          recipe_id?: string | null
          rotation_id: string
          servings?: number
          weekday: number
        }
        Update: {
          eating_out?: boolean
          meal?: Database["public"]["Enums"]["meal_type"]
          recipe_id?: string | null
          rotation_id?: string
          servings?: number
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_rotation_slots_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_fit"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "meal_rotation_slots_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_macros"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "meal_rotation_slots_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_rotation_slots_rotation_id_fkey"
            columns: ["rotation_id"]
            isOneToOne: false
            referencedRelation: "meal_rotations"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_rotations: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          user_id?: string
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
      product_prices: {
        Row: {
          channel_id: string
          id: string
          observed_at: string
          price: number
          product_id: string
          source: string
        }
        Insert: {
          channel_id: string
          id?: string
          observed_at: string
          price: number
          product_id: string
          source: string
        }
        Update: {
          channel_id?: string
          id?: string
          observed_at?: string
          price?: number
          product_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          chosen_by_user: boolean
          created_at: string
          created_by: string | null
          edible_fraction: number | null
          food_id: string | null
          id: string
          image_path: string | null
          image_url: string | null
          kcal_100g_scraped: number | null
          kj_100g_scraped: number | null
          name: string
          pack_size_g: number | null
          pack_size_is_approx: boolean
          pack_size_raw: string | null
          price_per_kg: number | null
          protein_100g_scraped: number | null
          store: string
          url: string | null
        }
        Insert: {
          chosen_by_user?: boolean
          created_at?: string
          created_by?: string | null
          edible_fraction?: number | null
          food_id?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          kcal_100g_scraped?: number | null
          kj_100g_scraped?: number | null
          name: string
          pack_size_g?: number | null
          pack_size_is_approx?: boolean
          pack_size_raw?: string | null
          price_per_kg?: number | null
          protein_100g_scraped?: number | null
          store: string
          url?: string | null
        }
        Update: {
          chosen_by_user?: boolean
          created_at?: string
          created_by?: string | null
          edible_fraction?: number | null
          food_id?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          kcal_100g_scraped?: number | null
          kj_100g_scraped?: number | null
          name?: string
          pack_size_g?: number | null
          pack_size_is_approx?: boolean
          pack_size_raw?: string | null
          price_per_kg?: number | null
          protein_100g_scraped?: number | null
          store?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods_energy_check"
            referencedColumns: ["food_id"]
          },
          {
            foreignKeyName: "products_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "shopping_list"
            referencedColumns: ["food_id"]
          },
        ]
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
            foreignKeyName: "recipe_ingredients_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods_energy_check"
            referencedColumns: ["food_id"]
          },
          {
            foreignKeyName: "recipe_ingredients_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "shopping_list"
            referencedColumns: ["food_id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_fit"
            referencedColumns: ["recipe_id"]
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
          created_by: string | null
          freezer_ok: boolean
          fridge_days: number | null
          id: string
          instructions: string | null
          name: string
          prep_minutes: number | null
          servings: number
          source_url: string | null
          suits: Database["public"]["Enums"]["meal_type"][]
          variant: string | null
        }
        Insert: {
          batch_friendly?: boolean
          created_at?: string
          created_by?: string | null
          freezer_ok?: boolean
          fridge_days?: number | null
          id?: string
          instructions?: string | null
          name: string
          prep_minutes?: number | null
          servings: number
          source_url?: string | null
          suits?: Database["public"]["Enums"]["meal_type"][]
          variant?: string | null
        }
        Update: {
          batch_friendly?: boolean
          created_at?: string
          created_by?: string | null
          freezer_ok?: boolean
          fridge_days?: number | null
          id?: string
          instructions?: string | null
          name?: string
          prep_minutes?: number | null
          servings?: number
          source_url?: string | null
          suits?: Database["public"]["Enums"]["meal_type"][]
          variant?: string | null
        }
        Relationships: []
      }
      shopping_check: {
        Row: {
          checked_at: string
          food_id: string
          packs_checked: number
          plan_id: string
          user_id: string
        }
        Insert: {
          checked_at?: string
          food_id: string
          packs_checked: number
          plan_id: string
          user_id: string
        }
        Update: {
          checked_at?: string
          food_id?: string
          packs_checked?: number
          plan_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_check_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_check_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods_energy_check"
            referencedColumns: ["food_id"]
          },
          {
            foreignKeyName: "shopping_check_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "shopping_list"
            referencedColumns: ["food_id"]
          },
          {
            foreignKeyName: "shopping_check_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_check_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "shopping_list"
            referencedColumns: ["plan_id"]
          },
        ]
      }
      store_zones: {
        Row: {
          label: string
          zone: string
          zone_order: number
        }
        Insert: {
          label: string
          zone: string
          zone_order: number
        }
        Update: {
          label?: string
          zone?: string
          zone_order?: number
        }
        Relationships: []
      }
      work_location: {
        Row: {
          location: string
          user_id: string
          weekday: number
        }
        Insert: {
          location: string
          user_id: string
          weekday: number
        }
        Update: {
          location?: string
          user_id?: string
          weekday?: number
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
      cheapest_dia_proposal: {
        Row: {
          chosen_by_user: boolean | null
          edible_fraction: number | null
          effective_price_per_kg: number | null
          food_id: string | null
          food_kcal_100g: number | null
          food_name: string | null
          food_protein_100g: number | null
          image_path: string | null
          kcal_100g_scraped: number | null
          kj_100g_scraped: number | null
          kj_contradiction: boolean | null
          macro_check: string | null
          motivos: string[] | null
          nombre_solapa: boolean | null
          pack_size_g: number | null
          pack_size_is_approx: boolean | null
          precio_por_g_proteina: number | null
          price: number | null
          price_per_kg_ajustado: number | null
          product_id: string | null
          product_name: string | null
          protein_100g_scraped: number | null
          proteina_estimada: boolean | null
          sin_criterio_comparacion: boolean | null
          url: string | null
        }
        Relationships: []
      }
      foods_energy_check: {
        Row: {
          energy_impossible: boolean | null
          food_id: string | null
          kcal_100g: number | null
          kcal_atwater: number | null
          name: string | null
          residual_abs: number | null
          residual_pct: number | null
        }
        Insert: {
          energy_impossible?: never
          food_id?: string | null
          kcal_100g?: number | null
          kcal_atwater?: never
          name?: string | null
          residual_abs?: never
          residual_pct?: never
        }
        Update: {
          energy_impossible?: never
          food_id?: string | null
          kcal_100g?: number | null
          kcal_atwater?: never
          name?: string | null
          residual_abs?: never
          residual_pct?: never
        }
        Relationships: []
      }
      meal_plan_slot_details: {
        Row: {
          eating_out: boolean | null
          id: string | null
          meal: Database["public"]["Enums"]["meal_type"] | null
          plan_id: string | null
          recipe_id: string | null
          recipe_name: string | null
          recipe_variant: string | null
          servings: number | null
          slot_date: string | null
          variant_mismatch: boolean | null
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
            foreignKeyName: "meal_plan_slots_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "shopping_list"
            referencedColumns: ["plan_id"]
          },
          {
            foreignKeyName: "meal_plan_slots_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_fit"
            referencedColumns: ["recipe_id"]
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
      plan_cost_summary: {
        Row: {
          box_total: number | null
          plan_id: string | null
          prorated_total: number | null
        }
        Relationships: []
      }
      plan_day_totals: {
        Row: {
          carbs: number | null
          fat: number | null
          kcal: number | null
          kcal_gap: number | null
          meals_out: number | null
          plan_id: string | null
          protein: number | null
          protein_gap: number | null
          slot_date: string | null
          slots_vacios: number | null
          target_kcal: number | null
          target_protein: number | null
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
            foreignKeyName: "meal_plan_slots_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "shopping_list"
            referencedColumns: ["plan_id"]
          },
        ]
      }
      plan_prorated_cost: {
        Row: {
          cost: number | null
          food_id: string | null
          food_name: string | null
          grams: number | null
          needs_manual_check: boolean | null
          plan_id: string | null
          price_per_kg_ajustado: number | null
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
            foreignKeyName: "meal_plan_slots_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "shopping_list"
            referencedColumns: ["plan_id"]
          },
          {
            foreignKeyName: "recipe_ingredients_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods_energy_check"
            referencedColumns: ["food_id"]
          },
          {
            foreignKeyName: "recipe_ingredients_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "shopping_list"
            referencedColumns: ["food_id"]
          },
        ]
      }
      recipe_fit: {
        Row: {
          carbs_per_serving: number | null
          fat_excess: number | null
          fat_pct_kcal: number | null
          fat_per_serving: number | null
          kcal_per_serving: number | null
          name: string | null
          protein_gap: number | null
          protein_per_100kcal: number | null
          protein_per_serving: number | null
          recipe_id: string | null
          servings: number | null
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
      shopping_list: {
        Row: {
          chosen_by_user: boolean | null
          display_name: string | null
          estimated_cost: number | null
          food_id: string | null
          food_name: string | null
          grams_leftover: number | null
          grams_needed: number | null
          leftover_pct: number | null
          needs_manual_check: boolean | null
          pack_size_g: number | null
          pack_size_is_approx: boolean | null
          packs_to_buy: number | null
          plan_id: string | null
          precio_envase: number | null
          product_name: string | null
          store: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_rotation: {
        Args: { p_plan_id: string; p_rotation_id: string }
        Returns: number
      }
      channel_order_cost: {
        Args: { p_channel_id: string; p_subtotal: number }
        Returns: number
      }
      compute_recipe_macros: {
        Args: { p_food_ids: string[]; p_grams: number[]; p_servings: number }
        Returns: {
          carbs_per_serving: number
          fat_per_serving: number
          kcal_per_serving: number
          protein_per_serving: number
        }[]
      }
      create_cook_session: {
        Args: { p_cook_date: string; p_plan_id: string }
        Returns: string
      }
      create_meal_plan: { Args: { p_week_start: string }; Returns: string }
      gross_salary_equivalent: { Args: { net_amount: number }; Returns: number }
      normalize_search_name: { Args: { input: string }; Returns: string }
      plan_cook_batches: {
        Args: { p_plan_id: string }
        Returns: {
          prep_mode: string
          recipe_id: string
          recipe_name: string
          servings_consumed: number
          servings_leftover: number
          servings_per_batch: number
          servings_produced: number
          tandas: number
        }[]
      }
      save_week_as_rotation: {
        Args: { p_make_default?: boolean; p_name: string; p_plan_id: string }
        Returns: string
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
