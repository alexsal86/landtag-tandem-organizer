import { PlannerBoard } from "./PlannerBoard";
import { Themenspeicher } from "./Themenspeicher";
import { useRedaktionSpecialDays } from "@/features/redaktion/hooks/useRedaktionSpecialDays";

export function RedaktionFeature() {
  const { data: specialDays = [] } = useRedaktionSpecialDays();

  return (
    <div className="p-4 pb-8">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <PlannerBoard specialDays={specialDays} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <Themenspeicher />
        </div>
      </div>
    </div>
  );
}
