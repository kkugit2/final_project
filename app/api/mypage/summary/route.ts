import { createClient } from "@/lib/supabase/server";
import { ok, handleRouteError } from "@/lib/utils/api-response";
import { requireUser } from "@/lib/utils/require-user";
import { getMypageSummary } from "@/lib/services/mypage-service";

export async function GET() {
  try {
    const supabase = await createClient();
    const user = await requireUser(supabase);
    const summary = await getMypageSummary(supabase, user.id);
    return ok(summary);
  } catch (error) {
    return handleRouteError(error);
  }
}
