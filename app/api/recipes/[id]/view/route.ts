import { createClient } from "@/lib/supabase/server";
import { ok, handleRouteError } from "@/lib/utils/api-response";
import { requireUser } from "@/lib/utils/require-user";
import { recordRecipeView } from "@/lib/services/recipe-interaction-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const user = await requireUser(supabase);
    await recordRecipeView(supabase, user.id, id);
    return ok({ recipeId: id });
  } catch (error) {
    return handleRouteError(error);
  }
}
