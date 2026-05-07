import { OnboardingDialog } from "./OnboardingDialog";
import { useOnboardingGate } from "@/hooks/useOnboardingGate";

export function OnboardingHost(): React.JSX.Element | null {
  const { needsOnboarding, slides, markComplete } = useOnboardingGate();
  if (!needsOnboarding || slides.length === 0) return null;
  return (
    <OnboardingDialog
      open={needsOnboarding}
      slides={slides}
      onComplete={markComplete}
      onSkip={markComplete}
    />
  );
}
