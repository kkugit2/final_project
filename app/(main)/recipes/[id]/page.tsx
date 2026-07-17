import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUserForPage } from "@/lib/utils/require-user";
import { getRecipeDetail } from "@/lib/services/recipe-service";
import { RecipeDetailView } from "@/components/features/RecipeDetailView";
import { NotFoundError } from "@/lib/utils/errors";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await requireUserForPage(supabase);

  let detail;
  try {
    detail = await getRecipeDetail(supabase, user.id, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return <RecipeDetailView detail={detail} />;
}
