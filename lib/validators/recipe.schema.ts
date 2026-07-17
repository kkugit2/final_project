import { z } from "zod";

export const recommendQuerySchema = z.object({
  filter: z.enum(["complete", "partial", "all"]).default("all"),
  category: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

export type RecommendQuery = z.infer<typeof recommendQuerySchema>;
