import { RecipeDashboard } from "@/components/features/RecipeDashboard";

export default function RecipesPage() {
  return (
    <div>
      <h1 className="mb-4 text-3xl font-bold text-darkGray">레시피 추천</h1>
      <RecipeDashboard />
    </div>
  );
}
