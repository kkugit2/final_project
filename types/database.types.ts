export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      ingredients_master: {
        Row: {
          id: string;
          name: string;
          category: string;
          synonyms: string[];
          is_basic_seasoning: boolean;
          default_shelf_life_days: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: string;
          synonyms?: string[];
          is_basic_seasoning?: boolean;
          default_shelf_life_days?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ingredients_master"]["Insert"]>;
        Relationships: [];
      };
      user_fridge: {
        Row: {
          id: string;
          user_id: string;
          ingredient_id: string | null;
          custom_name: string | null;
          is_owned: boolean;
          expiry_date: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          ingredient_id?: string | null;
          custom_name?: string | null;
          is_owned?: boolean;
          expiry_date?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_fridge"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "user_fridge_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients_master";
            referencedColumns: ["id"];
          }
        ];
      };
      recipes_cache: {
        Row: {
          id: string;
          name: string;
          category: string | null;
          raw_ingredients_text: string;
          parsed_ingredients: Json;
          matched_ingredient_ids: string[];
          cooking_steps: Json;
          image_url: string | null;
          nutrition_kcal: number | null;
          nutrition_carb: number | null;
          nutrition_protein: number | null;
          nutrition_fat: number | null;
          nutrition_sodium: number | null;
          loaded_at: string;
        };
        Insert: {
          id: string;
          name: string;
          category?: string | null;
          raw_ingredients_text: string;
          parsed_ingredients?: Json;
          matched_ingredient_ids?: string[];
          cooking_steps?: Json;
          image_url?: string | null;
          nutrition_kcal?: number | null;
          nutrition_carb?: number | null;
          nutrition_protein?: number | null;
          nutrition_fat?: number | null;
          nutrition_sodium?: number | null;
          loaded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recipes_cache"]["Insert"]>;
        Relationships: [];
      };
      user_profiles: {
        Row: {
          user_id: string;
          goal: string | null;
          daily_calorie_target: number | null;
        };
        Insert: {
          user_id: string;
          goal?: string | null;
          daily_calorie_target?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["user_profiles"]["Insert"]>;
        Relationships: [];
      };
      user_preferences: {
        Row: {
          user_id: string;
          quantity_tracking_enabled: boolean;
          expiry_notification_enabled: boolean;
          default_category: string | null;
        };
        Insert: {
          user_id: string;
          quantity_tracking_enabled?: boolean;
          expiry_notification_enabled?: boolean;
          default_category?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["user_preferences"]["Insert"]>;
        Relationships: [];
      };
      user_favorites: {
        Row: {
          id: string;
          user_id: string;
          recipe_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recipe_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_favorites"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "user_favorites_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes_cache";
            referencedColumns: ["id"];
          }
        ];
      };
      recipe_views: {
        Row: {
          id: string;
          user_id: string;
          recipe_id: string;
          viewed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recipe_id: string;
          viewed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recipe_views"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "recipe_views_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes_cache";
            referencedColumns: ["id"];
          }
        ];
      };
      recipe_completions: {
        Row: {
          id: string;
          user_id: string;
          recipe_id: string;
          completed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recipe_id: string;
          completed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recipe_completions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "recipe_completions_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes_cache";
            referencedColumns: ["id"];
          }
        ];
      };
      ingredient_consumption_log: {
        Row: {
          id: string;
          user_id: string;
          ingredient_name: string;
          consumed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          ingredient_name: string;
          consumed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ingredient_consumption_log"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type IngredientMaster = Database["public"]["Tables"]["ingredients_master"]["Row"];
export type UserFridgeRow = Database["public"]["Tables"]["user_fridge"]["Row"];
export type RecipeCacheRow = Database["public"]["Tables"]["recipes_cache"]["Row"];
export type UserFavoriteRow = Database["public"]["Tables"]["user_favorites"]["Row"];
export type RecipeViewRow = Database["public"]["Tables"]["recipe_views"]["Row"];
export type RecipeCompletionRow = Database["public"]["Tables"]["recipe_completions"]["Row"];
export type IngredientConsumptionLogRow =
  Database["public"]["Tables"]["ingredient_consumption_log"]["Row"];
