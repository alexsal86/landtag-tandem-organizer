import { PlannerBoard } from "./PlannerBoard";
import { Themenspeicher } from "./Themenspeicher";
import { useRedaktionSpecialDays } from "@/features/redaktion/hooks/useRedaktionSpecialDays";
import styles from "./RedaktionFeature.module.css";

export function RedaktionFeature() {
  const { data: specialDays = [] } = useRedaktionSpecialDays();
  return (
    <div className={`${styles.workspace} p-4 pb-8`}>
      <PlannerBoard specialDays={specialDays} topicSidebar={<Themenspeicher compact />} />
    </div>
  );
}
