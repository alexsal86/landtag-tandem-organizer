import { useState } from "react";
import { ThemenspeicherPanel } from "./ThemenspeicherPanel";
import { SocialMediaPlannerPanel } from "./SocialMediaPlannerPanel";

export function MyWorkRedaktionTab() {
  const [contentRefreshToken, setContentRefreshToken] = useState(0);

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <ThemenspeicherPanel onContentCreated={() => setContentRefreshToken((prev) => prev + 1)} />
        </div>
        <div className="min-w-0">
          <SocialMediaPlannerPanel />
        </div>
      </div>
    </div>
  );
}
