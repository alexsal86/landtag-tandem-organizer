import type { ComponentProps } from "react";
import { CaseItemInteractionQuickCapture } from "./CaseItemInteractionQuickCapture";

export function EmailQuickCapture(props: Omit<ComponentProps<typeof CaseItemInteractionQuickCapture>, "title" | "interactionType" | "defaultDirection">) {
  return <CaseItemInteractionQuickCapture {...props} title="E-Mail dokumentieren" interactionType="email" defaultDirection="outbound" />;
}
