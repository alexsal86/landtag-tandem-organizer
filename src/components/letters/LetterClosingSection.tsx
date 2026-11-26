import type { ComponentProps } from "react";
import { LetterClosingBlock } from "./LetterContentBlocks";

/** Grußformel/Unterschrift der Seite mit DIN-typografischem Wrapper. */
export function LetterClosingSection(props: ComponentProps<typeof LetterClosingBlock>) {
  return (
    <div
      style={{
        color: "#000",
        fontFamily: 'Calibri,Carlito,"Segoe UI",Arial,sans-serif',
      }}
    >
      <LetterClosingBlock {...props} />
    </div>
  );
}
