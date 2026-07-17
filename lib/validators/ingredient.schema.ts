import { z } from "zod";

export const searchIngredientsQuerySchema = z.object({
  q: z.string().trim().min(1, "검색어를 입력해주세요.").max(50),
});
