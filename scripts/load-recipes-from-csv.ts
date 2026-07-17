import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { createServiceRoleClientForScript } from "./supabase-admin";
import { parsePartsColumn, matchIngredientIds } from "../lib/services/ingredient-text-parser";

const CSV_PATH = path.resolve(process.cwd(), "food_recipes_data_fin.csv");
const BATCH_SIZE = 200;

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

function toNullableNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
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

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`[load-recipes] CSV 파일을 찾을 수 없습니다: ${CSV_PATH}`);
    process.exit(1);
  }

  const supabase = createServiceRoleClientForScript();

  const { data: ingredients, error: ingredientsError } = await supabase
    .from("ingredients_master")
    .select("id, name, synonyms");

  if (ingredientsError) {
    console.error("[load-recipes] ingredients_master 조회 실패:", ingredientsError.message);
    process.exit(1);
  }

  if (!ingredients || ingredients.length === 0) {
    console.error(
      "[load-recipes] ingredients_master가 비어 있습니다. 먼저 `npm run seed-ingredients`를 실행하세요."
    );
    process.exit(1);
  }

  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
  const rows: CsvRow[] = parse(csvContent, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
  });

  console.log(`[load-recipes] CSV ${rows.length}개 레시피 파싱 시작`);

  const recipeRows = rows.map((row) => {
    const parsedIngredients = parsePartsColumn(row.RCP_PARTS ?? "");
    const matchedIds = matchIngredientIds(parsedIngredients, ingredients);

    return {
      id: row.RCP_SEQ,
      name: row.RCP_NM,
      category: row.RCP_PAT2 || null,
      raw_ingredients_text: row.RCP_PARTS_DTLS ?? "",
      parsed_ingredients: parsedIngredients,
      matched_ingredient_ids: matchedIds,
      cooking_steps: extractCookingSteps(row),
      image_url: row.ATT_FILE_NO_MAIN || null,
      nutrition_kcal: toNullableNumber(row.INFO_ENG),
      nutrition_carb: toNullableNumber(row.INFO_CAR),
      nutrition_protein: toNullableNumber(row.INFO_PRO),
      nutrition_fat: toNullableNumber(row.INFO_FAT),
      nutrition_sodium: toNullableNumber(row.INFO_NA),
    };
  });

  let loaded = 0;
  for (let i = 0; i < recipeRows.length; i += BATCH_SIZE) {
    const batch = recipeRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("recipes_cache").upsert(batch, { onConflict: "id" });

    if (error) {
      console.error(`[load-recipes] ${i}~${i + batch.length} 적재 실패:`, error.message);
      process.exit(1);
    }

    loaded += batch.length;
    console.log(`[load-recipes] ${loaded}/${recipeRows.length} 적재 완료`);
  }

  console.log("[load-recipes] 전체 완료");
}

main();
