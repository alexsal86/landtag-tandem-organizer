import { OnboardingDialog } from "./OnboardingDialog";
import { useOnboardingGate } from "@/hooks/useOnboardingGate";
import { useOnboardingChecklist } from "@/hooks/useOnboardingChecklist";

export function OnboardingHost(): React.JSX.Element | null {
  const { needsOnboarding, slides, markComplete } = useOnboardingGate();
  const { setItemDone } = useOnboardingChecklist();
  if (!needsOnboarding || slides.length === 0) return null;

  const finish = async (): Promise<void> => {
    await markComplete();
    void setItemDone("tour.complete", true);
  };

  return (
    <OnboardingDialog
      open={needsOnboarding}
      slides={slides}
      onComplete={finish}
      onSkip={finish}
    />
  );
}
