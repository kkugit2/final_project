import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, handleRouteError } from "@/lib/utils/api-response";
import { requireUser } from "@/lib/utils/require-user";
import { addIngredientSchema } from "@/lib/validators/fridge.schema";
import { listFridgeItems, addFridgeItem } from "@/lib/services/fridge-service";

export async function GET() {
  try {
    const supabase = await createClient();
    const user = await requireUser(supabase);
    const items = await listFridgeItems(supabase, user.id);
    return ok(items);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await requireUser(supabase);
    const body = await request.json();
    const params = addIngredientSchema.parse(body);
    const item = await addFridgeItem(supabase, user.id, params);
    return ok(item, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
