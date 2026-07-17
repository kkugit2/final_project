import { createClient } from "@/lib/supabase/server";
import { ok, handleRouteError } from "@/lib/utils/api-response";
import { requireUser } from "@/lib/utils/require-user";
import { addFavorite, removeFavorite } from "@/lib/services/recipe-interaction-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const user = await requireUser(supabase);
    await addFavorite(supabase, user.id, id);
    return ok({ recipeId: id, isFavorited: true }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const user = await requireUser(supabase);
    await removeFavorite(supabase, user.id, id);
    return ok({ recipeId: id, isFavorited: false });
  } catch (error) {
    return handleRouteError(error);
  }
}
