import { createClient } from "@/lib/supabase/server";
import { requireUserForPage } from "@/lib/utils/require-user";
import { listFridgeItems } from "@/lib/services/fridge-service";
import { FridgeView } from "@/components/features/FridgeView";

export default async function FridgePage() {
  const supabase = await createClient();
  const user = await requireUserForPage(supabase);
  const items = await listFridgeItems(supabase, user.id);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-darkGray">나의 냉장고</h1>
      <FridgeView initialItems={items} />
    </div>
  );
}
