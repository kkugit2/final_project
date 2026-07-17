import { z } from "zod";

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 합니다.");

// F2: 검색으로 찾은 마스터 재료(ingredientId) 또는 직접 추가한 커스텀 재료(customName) 중 하나만 지정
export const addIngredientSchema = z
  .object({
    ingredientId: z.string().uuid("올바른 재료 ID가 아닙니다.").optional(),
    customName: z.string().trim().min(1, "재료명을 입력해주세요.").max(50).optional(),
    expiryDate: dateStringSchema.optional(),
  })
  .refine((data) => Boolean(data.ingredientId) !== Boolean(data.customName), {
    message: "ingredientId 또는 customName 중 하나만 지정해야 합니다.",
  });

// F9: 보유 여부, 유통기한 중 하나 이상 수정
export const updateFridgeItemSchema = z
  .object({
    isOwned: z.boolean().optional(),
    expiryDate: dateStringSchema.nullable().optional(),
  })
  .refine((data) => data.isOwned !== undefined || data.expiryDate !== undefined, {
    message: "수정할 값이 없습니다.",
  });
