import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, handleRouteError } from "@/lib/utils/api-response";
import { requireUser } from "@/lib/utils/require-user";
import { updateFridgeItemSchema } from "@/lib/validators/fridge.schema";
import {
  assertFridgeItemOwnership,
  updateFridgeItem,
  deleteFridgeItem,
} from "@/lib/services/fridge-service";
import { ForbiddenError } from "@/lib/utils/errors";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const user = await requireUser(supabase);

    const isOwner = await assertFridgeItemOwnership(supabase, id, user.id);
    if (!isOwner) throw new ForbiddenError();

    const body = await request.json();
    const updates = updateFridgeItemSchema.parse(body);
    const item = await updateFridgeItem(supabase, id, updates);
    return ok(item);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const user = await requireUser(supabase);

    const isOwner = await assertFridgeItemOwnership(supabase, id, user.id);
    if (!isOwner) throw new ForbiddenError();

    await deleteFridgeItem(supabase, id);
    return ok({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}
