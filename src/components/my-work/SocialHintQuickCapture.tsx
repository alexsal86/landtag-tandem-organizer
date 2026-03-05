import type { ComponentProps } from "react";
import { CaseItemInteractionQuickCapture } from "./CaseItemInteractionQuickCapture";

export function SocialHintQuickCapture(props: Omit<ComponentProps<typeof CaseItemInteractionQuickCapture>, "title" | "interactionType" | "defaultDirection">) {
  return <CaseItemInteractionQuickCapture {...props} title="Social-Hinweis erfassen" interactionType="social" defaultDirection="internal" />;
}
