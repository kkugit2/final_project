import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, handleRouteError } from "@/lib/utils/api-response";
import { requireUser } from "@/lib/utils/require-user";
import { recommendQuerySchema } from "@/lib/validators/recipe.schema";
import { getRecommendedRecipes } from "@/lib/services/recipe-service";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await requireUser(supabase);

    const query = recommendQuerySchema.parse({
      filter: request.nextUrl.searchParams.get("filter") ?? undefined,
      category: request.nextUrl.searchParams.get("category") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      offset: request.nextUrl.searchParams.get("offset") ?? undefined,
    });

    const result = await getRecommendedRecipes(supabase, { userId: user.id, ...query });
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
