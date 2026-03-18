import { MyWorkSocialPlannerBoard } from "./MyWorkSocialPlannerBoard";
import type { SpecialDay } from "@/utils/dashboard/specialDays";

interface SocialMediaPlannerPanelProps {
  specialDays: SpecialDay[];
}

export function SocialMediaPlannerPanel({ specialDays }: SocialMediaPlannerPanelProps) {
  return <MyWorkSocialPlannerBoard specialDays={specialDays} />;
}
