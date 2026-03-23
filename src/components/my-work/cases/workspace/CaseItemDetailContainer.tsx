import type { ReactNode } from "react";

type CaseItemDetailContainerProps = {
  open: boolean;
  children: ReactNode;
};

export function CaseItemDetailContainer({ open, children }: CaseItemDetailContainerProps) {
  return (
    <div
      className={[
        "grid transition-all duration-300 ease-in-out",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      ].join(" ")}
    >
      <div className="overflow-hidden">{open ? children : null}</div>
    </div>
  );
}
