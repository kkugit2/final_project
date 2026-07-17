import { Badge } from "@/components/common/Badge";

export function IngredientTag({ name, isOwned }: { name: string; isOwned: boolean }) {
  return <Badge variant={isOwned ? "complete" : "partial"}>{name}</Badge>;
}
