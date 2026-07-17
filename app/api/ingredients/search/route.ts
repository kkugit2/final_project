import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, handleRouteError } from "@/lib/utils/api-response";
import { requireUser } from "@/lib/utils/require-user";
import { searchIngredientsQuerySchema } from "@/lib/validators/ingredient.schema";
import { searchIngredients } from "@/lib/services/ingredient-service";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    await requireUser(supabase);

    const { q } = searchIngredientsQuerySchema.parse({
      q: request.nextUrl.searchParams.get("q") ?? "",
    });

    const results = await searchIngredients(supabase, q, 10);
    return ok(results);
  } catch (error) {
    return handleRouteError(error);
  }
}
