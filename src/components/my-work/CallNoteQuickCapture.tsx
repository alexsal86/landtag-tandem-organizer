import type { ComponentProps } from "react";
import { CaseItemInteractionQuickCapture } from "./CaseItemInteractionQuickCapture";

export function CallNoteQuickCapture(props: Omit<ComponentProps<typeof CaseItemInteractionQuickCapture>, "title" | "interactionType" | "defaultDirection">) {
  return <CaseItemInteractionQuickCapture {...props} title="Anrufnotiz erfassen" interactionType="call" defaultDirection="inbound" />;
}
