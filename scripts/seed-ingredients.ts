import { createServiceRoleClientForScript } from "./supabase-admin";
import { INGREDIENTS_SEED, getDefaultShelfLifeDays } from "../lib/data/ingredients-seed";

async function main() {
  const supabase = createServiceRoleClientForScript();

  const rows = INGREDIENTS_SEED.map((seed) => ({
    name: seed.name,
    category: seed.category,
    synonyms: seed.synonyms,
    is_basic_seasoning: seed.isBasicSeasoning,
    default_shelf_life_days: getDefaultShelfLifeDays(seed),
  }));

  const { error, count } = await supabase
    .from("ingredients_master")
    .upsert(rows, { onConflict: "name", count: "exact" });

  if (error) {
    console.error("[seed-ingredients] 실패:", error.message);
    process.exit(1);
  }

  console.log(`[seed-ingredients] ${count ?? rows.length}개 재료를 적재했습니다.`);
}

main();
