import { createClient } from "@/lib/supabase/server";
import { ok, handleRouteError } from "@/lib/utils/api-response";
import { requireUser } from "@/lib/utils/require-user";
import { getRecipeDetail } from "@/lib/services/recipe-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const user = await requireUser(supabase);
    const detail = await getRecipeDetail(supabase, user.id, id);
    return ok(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}
