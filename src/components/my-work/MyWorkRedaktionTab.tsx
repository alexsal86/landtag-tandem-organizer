import { useState } from "react";
import { ThemenspeicherPanel } from "./ThemenspeicherPanel";
import { SocialMediaPlannerPanel } from "./SocialMediaPlannerPanel";
import type { SpecialDay } from "@/utils/dashboard/specialDays";

interface MyWorkRedaktionTabProps {
  specialDays: SpecialDay[];
}

export function MyWorkRedaktionTab({ specialDays }: MyWorkRedaktionTabProps) {
  const [, setContentRefreshToken] = useState(0);

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <SocialMediaPlannerPanel specialDays={specialDays} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <ThemenspeicherPanel onContentCreated={() => setContentRefreshToken((prev) => prev + 1)} />
        </div>
      </div>
    </div>
  );
}
