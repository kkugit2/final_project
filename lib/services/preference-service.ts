import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export interface UserPreferences {
  user_id: string;
  quantity_tracking_enabled: boolean;
  expiry_notification_enabled: boolean;
  default_category: string | null;
}

export async function getUserPreferences(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  // 기본값 반환 (사용자가 아직 preferences를 설정하지 않은 경우)
  if (!data) {
    return {
      user_id: userId,
      quantity_tracking_enabled: true,
      expiry_notification_enabled: true,
      default_category: null,
    };
  }

  return data as UserPreferences;
}

export async function updateUserPreferences(
  supabase: SupabaseClient<Database>,
  userId: string,
  updates: Partial<Omit<UserPreferences, "user_id">>
): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: userId,
        ...updates,
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as UserPreferences;
}
