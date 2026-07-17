// service_role 키 없이도 시딩할 수 있도록, DB에 직접 연결하지 않고
// Supabase SQL Editor에 붙여넣을 SQL 파일을 로컬에서 생성한다.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { parse } from "csv-parse/sync";
import { INGREDIENTS_SEED, getDefaultShelfLifeDays } from "../lib/data/ingredients-seed";
import { parsePartsColumn, matchIngredientIds } from "../lib/services/ingredient-text-parser";
import {
  sqlTextArray,
  sqlUuidArray,
  sqlJsonb,
  sqlNullableString,
  sqlNullableNumber,
  sqlString,
} from "./sql-format";

const CSV_PATH = path.resolve(process.cwd(), "food_recipes_data_fin.csv");
const OUTPUT_DIR = path.resolve(process.cwd(), "supabase", "seed");
const RECIPES_PER_FILE = 150;

interface CsvRow {
  RCP_SEQ: string;
  RCP_NM: string;
  RCP_PAT2: string;
  RCP_PARTS_DTLS: string;
  RCP_PARTS: string;
  ATT_FILE_NO_MAIN: string;
  INFO_ENG: string;
  INFO_CAR: string;
  INFO_PRO: string;
  INFO_FAT: string;
  INFO_NA: string;
  [key: string]: string;
}

function extractCookingSteps(row: CsvRow) {
  const steps: { step: number; text: string; imageUrl: string | null }[] = [];

  for (let i = 1; i <= 20; i++) {
    const num = String(i).padStart(2, "0");
    const rawText = row[`MANUAL${num}`]?.trim();
    if (!rawText) continue;

    const imageUrl = row[`MANUAL_IMG${num}`]?.trim() || null;
    steps.push({
      step: i,
      text: rawText.replace(/^\d+\.\s*/, ""),
      imageUrl,
    });
  }

  return steps;
}

function writeIngredientsSql(
  ingredientsWithId: {
    id: string;
    name: string;
    category: string;
    synonyms: string[];
    isBasicSeasoning: boolean;
    defaultShelfLifeDays: number | null;
  }[]
) {
  const values = ingredientsWithId
    .map(
      (ingredient) =>
        `  (${sqlString(ingredient.id)}, ${sqlString(ingredient.name)}, ${sqlString(
          ingredient.category
        )}, ${sqlTextArray(ingredient.synonyms)}, ${ingredient.isBasicSeasoning}, ${sqlNullableNumber(
          ingredient.defaultShelfLifeDays
        )})`
    )
    .join(",\n");

  const sql = `-- 자동 생성 파일 (scripts/generate-seed-sql.ts). Supabase SQL Editor에서 실행하세요.
insert into public.ingredients_master (id, name, category, synonyms, is_basic_seasoning, default_shelf_life_days)
values
${values}
on conflict (name) do nothing;
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, "001_ingredients.sql"), sql, "utf-8");
}

function writeRecipesSql(
  rows: CsvRow[],
  candidates: { id: string; name: string; synonyms: string[] }[]
) {
  const total = rows.length;
  const fileCount = Math.ceil(total / RECIPES_PER_FILE);

  for (let fileIndex = 0; fileIndex < fileCount; fileIndex++) {
    const batch = rows.slice(fileIndex * RECIPES_PER_FILE, (fileIndex + 1) * RECIPES_PER_FILE);

    const values = batch
      .map((row) => {
        const parsedIngredients = parsePartsColumn(row.RCP_PARTS ?? "");
        const matchedIds = matchIngredientIds(parsedIngredients, candidates);
        const cookingSteps = extractCookingSteps(row);

        return `  (${sqlString(row.RCP_SEQ)}, ${sqlString(row.RCP_NM)}, ${sqlNullableString(
          row.RCP_PAT2
        )}, ${sqlString(row.RCP_PARTS_DTLS ?? "")}, ${sqlJsonb(parsedIngredients)}, ${sqlUuidArray(
          matchedIds
        )}, ${sqlJsonb(cookingSteps)}, ${sqlNullableString(row.ATT_FILE_NO_MAIN)}, ${sqlNullableNumber(
          row.INFO_ENG
        )}, ${sqlNullableNumber(row.INFO_CAR)}, ${sqlNullableNumber(row.INFO_PRO)}, ${sqlNullableNumber(
          row.INFO_FAT
        )}, ${sqlNullableNumber(row.INFO_NA)})`;
      })
      .join(",\n");

    const fileNumber = String(fileIndex + 1).padStart(2, "0");
    const sql = `-- 자동 생성 파일 (scripts/generate-seed-sql.ts). ${fileNumber}/${String(fileCount).padStart(2, "0")}
-- 001_ingredients.sql을 먼저 실행한 뒤 순서대로 실행하세요.
insert into public.recipes_cache
  (id, name, category, raw_ingredients_text, parsed_ingredients, matched_ingredient_ids, cooking_steps, image_url,
   nutrition_kcal, nutrition_carb, nutrition_protein, nutrition_fat, nutrition_sodium)
values
${values}
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  raw_ingredients_text = excluded.raw_ingredients_text,
  parsed_ingredients = excluded.parsed_ingredients,
  matched_ingredient_ids = excluded.matched_ingredient_ids,
  cooking_steps = excluded.cooking_steps,
  image_url = excluded.image_url,
  nutrition_kcal = excluded.nutrition_kcal,
  nutrition_carb = excluded.nutrition_carb,
  nutrition_protein = excluded.nutrition_protein,
  nutrition_fat = excluded.nutrition_fat,
  nutrition_sodium = excluded.nutrition_sodium,
  loaded_at = now();
`;

    fs.writeFileSync(
      path.join(OUTPUT_DIR, `002_recipes_part${fileNumber}.sql`),
      sql,
      "utf-8"
    );
  }

  return fileCount;
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`[generate-seed-sql] CSV 파일을 찾을 수 없습니다: ${CSV_PATH}`);
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const ingredientsWithId = INGREDIENTS_SEED.map((seed) => ({
    id: randomUUID(),
    name: seed.name,
    category: seed.category,
    synonyms: seed.synonyms,
    isBasicSeasoning: seed.isBasicSeasoning,
    defaultShelfLifeDays: getDefaultShelfLifeDays(seed),
  }));

  writeIngredientsSql(ingredientsWithId);
  console.log(`[generate-seed-sql] supabase/seed/001_ingredients.sql 생성 (${ingredientsWithId.length}개 재료)`);

  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
  const rows: CsvRow[] = parse(csvContent, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
  });

  const candidates = ingredientsWithId.map(({ id, name, synonyms }) => ({ id, name, synonyms }));
  const fileCount = writeRecipesSql(rows, candidates);

  console.log(
    `[generate-seed-sql] supabase/seed/002_recipes_part01~${String(fileCount).padStart(
      2,
      "0"
    )}.sql 생성 (총 ${rows.length}개 레시피, 파일당 최대 ${RECIPES_PER_FILE}개)`
  );
}

main();
