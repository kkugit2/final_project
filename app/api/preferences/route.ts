import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/utils/require-user";
import { getUserPreferences, updateUserPreferences } from "@/lib/services/preference-service";
import { apiResponse, apiError } from "@/lib/utils/api-response";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const user = await requireUser(supabase);

    const preferences = await getUserPreferences(supabase, user.id);
    return apiResponse(preferences);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const user = await requireUser(supabase);

    const body = await request.json();
    const preferences = await updateUserPreferences(supabase, user.id, body);

    return apiResponse(preferences);
  } catch (error) {
    return apiError(error);
  }
}
